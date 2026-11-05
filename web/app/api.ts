const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')
const TOKEN_KEY = 'gobelin_token'

export type Channel = {
    id: number
    name: string
    creation_date: string
}

export type Account = {
    id: number
    username: string
    channels: Channel[] | null
}

export type Message = {
    content: string
    user_id: number
    user: string
    creation_date: string
}

export class ApiError extends Error {
    constructor(public status: number) {
        super(status === 401 ? 'Identifiants invalides ou session expirée.' : 'La requête a échoué. Réessaie plus tard.')
    }
}

export function getToken() {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
    window.localStorage.removeItem(TOKEN_KEY)
}

async function apiFetch(path: string, options: RequestInit = {}, authenticated = true) {
    const token = authenticated ? getToken() : null
    if (authenticated && !token) throw new ApiError(401)

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    })

    if (!response.ok) {
        if (authenticated && response.status === 401) clearToken()
        throw new ApiError(response.status)
    }

    return response
}

export async function login(username: string, password: string) {
    const response = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    }, false)
    return response.text()
}

export async function register(username: string, password: string) {
    await apiFetch('/user', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    }, false)
}

export async function getAccount(): Promise<Account> {
    const response = await apiFetch('/me')
    return response.json() as Promise<Account>
}

export async function createChannel(name: string): Promise<Channel> {
    const response = await apiFetch('/channel', {
        method: 'POST',
        body: JSON.stringify({ name }),
    })
    return response.json() as Promise<Channel>
}

export async function enterChannel(name: string): Promise<Channel> {
    const response = await apiFetch('/channel/enter', {
        method: 'POST',
        body: JSON.stringify({ channel: name }),
    })
    return response.json() as Promise<Channel>
}

export async function getMessages(channelId: number): Promise<Message[]> {
    const response = await apiFetch(`/channel/message?channel=${channelId}`)
    const messages = await response.json() as Message[] | null
    return messages ?? []
}

export async function sendMessage(channelId: number, content: string): Promise<Message> {
    const response = await apiFetch('/channel/message', {
        method: 'POST',
        body: JSON.stringify({ channel: channelId, content }),
    })
    return response.json() as Promise<Message>
}
