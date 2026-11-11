import { clearToken, getToken } from "../../features/auth/token";
import { NAMESPACE } from "../config";
import { ApiError } from "./ApiError";

function getApiUrl() {
    return (
        import.meta.env.VITE_API_URL ||
        `${window.location.protocol}//${window.location.hostname}:4000`
    ).replace(/\/$/, "");
}

export async function apiFetch(
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
