import { apiFetch } from "../../shared/http/client";

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
