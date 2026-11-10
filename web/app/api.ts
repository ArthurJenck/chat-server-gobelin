import { NAMESPACE } from "./config";

const TOKEN_KEY = "gobelin_token";

function getApiUrl() {
    return (
        import.meta.env.VITE_API_URL ||
        `${window.location.protocol}//${window.location.hostname}:4000`
    ).replace(/\/$/, "");
}

export type Channel = {
    id: number;
    name: string;
    creation_date: string;
};

export type Account = {
    id: number;
    username: string;
    channels: Channel[] | null;
    metadata?: Record<string, unknown> | null;
};

export type Message = {
    id?: number;
    content: string;
    user_id: number;
    user: string;
    creation_date: string;
    posted_at?: string;
    metadata?: Record<string, unknown> | null;
};

export class ApiError extends Error {
    constructor(public status: number) {
        super(
            status === 401
                ? "Identifiants invalides ou session expirée."
                : "La requête a échoué. Réessaie plus tard.",
        );
    }
}

export function getToken() {
    return typeof window === "undefined"
        ? null
        : window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    window.localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(
    path: string,
    options: RequestInit = {},
    authenticated = true,
) {
    const token = authenticated ? getToken() : null;
    if (authenticated && !token) throw new ApiError(401);

    const url = new URL(`${getApiUrl()}${path}`);
    url.searchParams.set("namespace", NAMESPACE);
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!response.ok) {
        if (authenticated && response.status === 401) clearToken();
        throw new ApiError(response.status);
    }

    return response;
}

export async function login(username: string, password: string) {
    const response = await apiFetch(
        "/login",
        {
            method: "POST",
            body: JSON.stringify({ username, password }),
        },
        false,
    );
    return response.text();
}

export async function register(username: string, password: string) {
    await apiFetch(
        "/user",
        {
            method: "POST",
            body: JSON.stringify({ username, password }),
        },
        false,
    );
}

export async function getAccount(): Promise<Account> {
    const response = await apiFetch("/me");
    return response.json() as Promise<Account>;
}

export async function editUserMetadata(
    metadata: Record<string, unknown>,
): Promise<void> {
    await apiFetch("/user/edit", {
        method: "POST",
        body: JSON.stringify({ metadata }),
    });
}

export async function createChannel(name: string): Promise<Channel> {
    const response = await apiFetch("/channel", {
        method: "POST",
        body: JSON.stringify({ name, metadata: {} }),
    });
    return response.json() as Promise<Channel>;
}

export async function enterChannel(name: string): Promise<Channel> {
    const response = await apiFetch("/channel/enter", {
        method: "POST",
        body: JSON.stringify({ channel: name }),
    });
    return response.json() as Promise<Channel>;
}

export async function getMessages(channelId: number): Promise<Message[]> {
    const response = await apiFetch(`/channel/message?channel=${channelId}`);
    const messages = (await response.json()) as Message[] | null;
    return messages ?? [];
}

export async function sendMessage(
    channelId: number,
    content: string,
    metadata?: Record<string, unknown>,
): Promise<Message> {
    const response = await apiFetch("/channel/message", {
        method: "POST",
        body: JSON.stringify({
            channel: channelId,
            content,
            ...(metadata ? { metadata } : {}),
        }),
    });
    return response.json() as Promise<Message>;
}
