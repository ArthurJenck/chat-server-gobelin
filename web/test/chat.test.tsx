import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { renderApp } from './render-app'
import { server } from './setup'

const api = 'http://localhost:4000'
const general = { id: 5, name: 'general', creation_date: '2026-11-02T09:43:22Z' }

async function signIn() {
    await userEvent.type(screen.getByLabelText('Nom d’utilisateur'), ' Alice ')
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('existing chat flows', () => {
    it('signs in a user and displays their channels', async () => {
        let credentials: unknown
        server.use(
            http.post(`${api}/login`, async ({ request }) => {
                credentials = await request.json()
                return HttpResponse.text('token-test')
            }),
            http.get(`${api}/me`, () => HttpResponse.json({ id: 1, username: 'Alice', channels: [general] })),
        )

        renderApp('/login')
        await signIn()

        expect(credentials).toEqual({ username: 'Alice', password: 'secret' })
        expect(await screen.findByText('Nom : Alice')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'general' })).toHaveAttribute('href', '/channels/5')
    })

    it('shows an error when sign-in fails', async () => {
        server.use(http.post(`${api}/login`, () => new HttpResponse(null, { status: 401 })))

        renderApp('/login')
        await signIn()

        expect(await screen.findByRole('alert')).toHaveTextContent('Identifiants invalides')
        expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled()
    })

    it('redirects to sign-in when there is no session', async () => {
        renderApp('/channels/5')

        expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    })

    it('returns to sign-in when the session expires', async () => {
        let accountRequests = 0
        server.use(
            http.post(`${api}/login`, () => HttpResponse.text('token-test')),
            http.get(`${api}/me`, () => {
                accountRequests += 1
                return new HttpResponse(null, { status: 401 })
            }),
        )

        renderApp('/login')
        await signIn()

        await waitFor(() => expect(accountRequests).toBe(1))
        expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    })

    it('signs a user out from their account', async () => {
        server.use(
            http.post(`${api}/login`, () => HttpResponse.text('token-test')),
            http.get(`${api}/me`, () => HttpResponse.json({ id: 1, username: 'Alice', channels: [general] })),
        )

        renderApp('/login')
        await signIn()
        await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }))

        expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    })

    it('registers a user and opens their account', async () => {
        let registration: unknown
        server.use(
            http.post(`${api}/user`, async ({ request }) => {
                registration = await request.json()
                return HttpResponse.json({ id: 2, username: 'Zoe', channels: [general] })
            }),
            http.post(`${api}/login`, () => HttpResponse.text('token-test')),
            http.get(`${api}/me`, () => HttpResponse.json({ id: 2, username: 'Zoe', channels: [general] })),
        )

        renderApp('/register')
        await userEvent.type(screen.getByLabelText('Nom d’utilisateur'), ' Zoe ')
        await userEvent.type(screen.getByLabelText('Mot de passe'), 'secret')
        await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))

        expect(registration).toEqual({ username: 'Zoe', password: 'secret' })
        expect(await screen.findByText('Nom : Zoe')).toBeInTheDocument()
    })

    it('creates and joins channels from the account', async () => {
        const channels = [general]
        const actions: unknown[] = []
        server.use(
            http.post(`${api}/login`, () => HttpResponse.text('token-test')),
            http.get(`${api}/me`, () => HttpResponse.json({ id: 1, username: 'Alice', channels })),
            http.post(`${api}/channel`, async ({ request }) => {
                actions.push(await request.json())
                const channel = { id: 6, name: 'studio', creation_date: '2026-11-02T10:00:00Z' }
                channels.push(channel)
                return HttpResponse.json(channel)
            }),
            http.post(`${api}/channel/enter`, async ({ request }) => {
                actions.push(await request.json())
                channels.push({ id: 7, name: 'music', creation_date: '2026-11-02T10:01:00Z' })
                return new HttpResponse(null, { status: 200 })
            }),
        )

        renderApp('/login')
        await signIn()
        await screen.findByRole('link', { name: 'general' })

        await userEvent.type(screen.getByLabelText('Nom du channel'), ' studio ')
        await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
        expect(await screen.findByRole('link', { name: 'studio' })).toBeInTheDocument()

        await userEvent.type(screen.getByLabelText('Nom du channel'), ' music ')
        await userEvent.click(screen.getByRole('button', { name: 'Rejoindre par nom' }))
        expect(await screen.findByRole('link', { name: 'music' })).toBeInTheDocument()
        expect(actions).toEqual([{ name: 'studio' }, { channel: 'music' }])
    })

    it('displays messages and sends a new text message', async () => {
        const messages = [{ content: 'Hello', user_id: 2, user: 'Zoe', creation_date: '2026-11-02T10:00:00Z' }]
        let sentMessage: unknown
        server.use(
            http.post(`${api}/login`, () => HttpResponse.text('token-test')),
            http.get(`${api}/me`, () => HttpResponse.json({ id: 1, username: 'Alice', channels: [general] })),
            http.get(`${api}/channel/message`, ({ request }) => {
                expect(new URL(request.url).searchParams.get('channel')).toBe('5')
                return HttpResponse.json(messages)
            }),
            http.post(`${api}/channel/message`, async ({ request }) => {
                sentMessage = await request.json()
                const message = { content: 'Hi', user_id: 1, user: 'Alice', creation_date: '2026-11-02T10:01:00Z' }
                messages.push(message)
                return HttpResponse.json(message)
            }),
        )

        renderApp('/login')
        await signIn()
        await userEvent.click(await screen.findByRole('link', { name: 'general' }))
        expect(await screen.findByText(/Hello/)).toBeInTheDocument()
        expect(await screen.findByText('Courbure')).toBeInTheDocument()
        const [staff] = screen.getAllByRole('img', { name: /portée de/i })
        expect(staff.querySelectorAll('path')).toHaveLength(5)
        const restingLine = staff.querySelector('path')?.getAttribute('d')
        const curvature = screen.getByRole('textbox', { name: 'Courbure' })
        await userEvent.clear(curvature)
        await userEvent.type(curvature, '20{enter}')
        await waitFor(() => expect(staff.querySelector('path')?.getAttribute('d')).not.toBe(restingLine))

        await userEvent.type(screen.getByLabelText('Message'), ' Hi ')
        await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }))

        expect(await screen.findByText(/Hi/)).toBeInTheDocument()
        const staffs = screen.getAllByRole('img', { name: /portée de/i })
        expect(staffs).toHaveLength(2)
        staffs.forEach((staff) => {
            const lines = staff.querySelectorAll('path')
            expect(lines).toHaveLength(5)
            lines.forEach((line) => expect(line).toHaveAttribute('stroke', 'black'))
        })
        expect(sentMessage).toEqual({ channel: 5, content: 'Hi' })
        expect(screen.getByLabelText('Message')).toHaveValue('')
    })

    it('refreshes the message list on demand', async () => {
        let requests = 0
        server.use(
            http.post(`${api}/login`, () => HttpResponse.text('token-test')),
            http.get(`${api}/me`, () => HttpResponse.json({ id: 1, username: 'Alice', channels: [general] })),
            http.get(`${api}/channel/message`, () => {
                requests += 1
                return HttpResponse.json(requests === 1 ? [] : [
                    { content: 'A new message', user_id: 2, user: 'Zoe', creation_date: '2026-11-02T10:00:00Z' },
                ])
            }),
        )

        renderApp('/login')
        await signIn()
        await userEvent.click(await screen.findByRole('link', { name: 'general' }))
        expect(await screen.findByText('Aucun message.')).toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Actualiser' }))

        expect(await screen.findByText(/A new message/)).toBeInTheDocument()
        expect(requests).toBe(2)
    })
})
