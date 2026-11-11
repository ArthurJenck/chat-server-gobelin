import { apiFetch } from "../../shared/http/client";
import type { Message } from "./types";

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
