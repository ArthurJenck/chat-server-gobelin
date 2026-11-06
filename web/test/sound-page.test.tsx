import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { renderApp } from './render-app'

const playback = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }))
vi.mock('../app/sound/audioEngine', () => ({
    startPlayback: playback.start,
}))

it('opens the sound workshop without signing in', async () => {
    renderApp('/login')

    await userEvent.click(screen.getByRole('link', { name: 'Atelier son' }))

    expect(screen.getByRole('textbox', { name: 'Texte' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Retour' })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
})

it('starts and stops a text melody from the workshop', async () => {
    playback.start.mockResolvedValue(playback.stop)
    renderApp('/atelier-son')

    await userEvent.type(screen.getByRole('textbox', { name: 'Texte' }), 'Bonjour')
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    await waitFor(() => expect(playback.start).toHaveBeenCalledOnce())
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))

    expect(playback.stop).toHaveBeenCalledOnce()
})

it('plays with the selected instrument', async () => {
    playback.start.mockResolvedValue(playback.stop)
    renderApp('/atelier-son')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Instrument' }), 'guitar')
    await userEvent.type(screen.getByRole('textbox', { name: 'Texte' }), 'Bonjour')
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))

    await waitFor(() => expect(playback.start).toHaveBeenCalledWith(
        expect.anything(), expect.objectContaining({ instrument: 'guitar' }), expect.any(Function),
    ))
})

it('starts playback when Enter is pressed in the text field', async () => {
    playback.start.mockResolvedValue(playback.stop)
    renderApp('/atelier-son')

    await userEvent.type(screen.getByRole('textbox', { name: 'Texte' }), 'Bonjour{Enter}')

    await waitFor(() => expect(playback.start).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
})

it('restarts from the beginning when Play is pressed during playback', async () => {
    const firstStop = vi.fn()
    const secondStop = vi.fn()
    playback.start.mockResolvedValueOnce(firstStop).mockResolvedValueOnce(secondStop)
    renderApp('/atelier-son')

    await userEvent.type(screen.getByRole('textbox', { name: 'Texte' }), 'Bonjour')
    const playButton = screen.getByRole('button', { name: 'Play' })
    await userEvent.click(playButton)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled())

    expect(playButton).toBeEnabled()
    await userEvent.click(playButton)

    await waitFor(() => expect(playback.start).toHaveBeenCalledTimes(2))
    expect(firstStop).toHaveBeenCalledOnce()
    expect(playback.start.mock.calls[1][0].events).toEqual(playback.start.mock.calls[0][0].events)
})
