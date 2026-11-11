import { apiFetch } from "../../shared/http/client";
import type { Instrument } from "../sound/soundConfig";

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

export async function register(username: string, password: string, instrument: Instrument) {
    await apiFetch(
        "/user",
        {
            method: "POST",
            body: JSON.stringify({ username, password, metadata: { instrument } }),
        },
        false,
    );
}
