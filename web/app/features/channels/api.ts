import { apiFetch } from "../../shared/http/client";
import type { Channel } from "./types";

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
