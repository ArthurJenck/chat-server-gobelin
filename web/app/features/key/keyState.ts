import { NAMESPACE, PARIS_TIME_ZONE } from "../../shared/config";
import type { Message } from "../messages/types";

export type KeyState = { holderId: number | null; holderName: string | null };
export const AVAILABLE_KEY: KeyState = { holderId: null, holderName: null };

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

export function parisDay(date: Date) {
    return dayFormatter.format(date);
}

function isTodayKeyEvent(message: Message, today: string): message is Message & { id: number } {
    const metadata = message.metadata?.[NAMESPACE];
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
    const event = metadata as Record<string, unknown>;
    const date = new Date(message.posted_at ?? message.creation_date);
    return Number.isSafeInteger(message.id) && Number.isSafeInteger(message.user_id) &&
        typeof message.user === "string" &&
        event.type === "classroom_key" &&
        (event.action === "claim" || event.action === "release") &&
        !Number.isNaN(date.getTime()) && parisDay(date) === today;
}

export function mergeKeyMessages(current: Message[], incoming: Message[], now = new Date()) {
    const today = parisDay(now);
    const byId = new Map<number, Message & { id: number }>();
    for (const message of [...current, ...incoming]) {
        if (isTodayKeyEvent(message, today) && !byId.has(message.id))
            byId.set(message.id, message);
    }
    return [...byId.values()].sort((a, b) => a.id - b.id).slice(-100);
}

export function keyStateFromMessages(messages: Message[], now = new Date()): KeyState {
    const events = mergeKeyMessages([], messages, now);
    if (events.length === 100) return AVAILABLE_KEY;
    let state: KeyState = AVAILABLE_KEY;
    for (const message of events) {
        const action = (message.metadata?.[NAMESPACE] as Record<string, unknown>).action;
        if (action === "claim" && state.holderId === null)
            state = { holderId: message.user_id, holderName: message.user };
        else if (action === "release" && state.holderId === message.user_id)
            state = { holderId: null, holderName: null };
    }
    return state;
}
