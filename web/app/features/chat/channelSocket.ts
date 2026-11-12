import { getToken } from "../auth/token";
import { NAMESPACE } from "../../shared/config";
import { getApiUrl } from "../../shared/http/client";
import type { Message } from "../messages/types";

export type ChannelMessageEvent = {
    channelId: number;
    operation: "message.created" | "message.edited";
    message?: Message;
};

export function parseChannelEvents(data: unknown): ChannelMessageEvent[] {
    if (typeof data !== "string") return [];
    const events: ChannelMessageEvent[] = [];
    for (const line of data.split("\n")) {
        if (!line.trim()) continue;
        try {
            const value: unknown = JSON.parse(line);
            if (!value || typeof value !== "object") continue;
            const event = value as Record<string, unknown>;
            if (
                !Number.isSafeInteger(event.channel_id) ||
                (event.operation !== "message.created" && event.operation !== "message.edited")
            ) continue;
            events.push({
                channelId: event.channel_id as number,
                operation: event.operation,
                ...(Number.isSafeInteger(event.id) &&
                Number.isSafeInteger(event.user_id) &&
                typeof event.user === "string" &&
                typeof event.content === "string" &&
                typeof event.creation_date === "string"
                    ? { message: event as unknown as Message }
                    : {}),
            });
        } catch {
            continue;
        }
    }
    return events;
}

export function channelSocketUrl(channelIds: number[], token: string) {
    const url = new URL(`${getApiUrl()}/channel/socket`);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("namespace", NAMESPACE);
    url.searchParams.set("authorization", token);
    for (const id of channelIds) url.searchParams.append("channel", String(id));
    return url.toString();
}

type Callbacks = {
    onOpen: () => void;
    onEvents: (events: ChannelMessageEvent[]) => void;
    onFallback: () => void;
};

export function watchChannelSocket(channelIds: number[], callbacks: Callbacks) {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let eventTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingEvents: ChannelMessageEvent[] = [];
    let attempts = 0;
    let stopped = false;

    const ready = () => navigator.onLine && document.visibilityState === "visible";
    const clearTimer = (timer: ReturnType<typeof setTimeout> | null) => {
        if (timer !== null) clearTimeout(timer);
    };
    const scheduleFallback = () => {
        clearTimer(fallbackTimer);
        if (stopped || !ready() || socket?.readyState === 1) return;
        fallbackTimer = setTimeout(() => {
            fallbackTimer = null;
            if (!stopped && ready() && socket?.readyState !== 1)
                callbacks.onFallback();
            scheduleFallback();
        }, 15_000 + Math.random() * 10_000);
    };
    const scheduleReconnect = () => {
        clearTimer(reconnectTimer);
        if (stopped || !ready()) return;
        const cap = Math.min(30_000, 1_000 * 2 ** Math.min(attempts++, 5));
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, cap * (0.5 + Math.random() * 0.5));
    };
    const flushEvents = () => {
        eventTimer = null;
        const events = pendingEvents;
        pendingEvents = [];
        if (!stopped && events.length) callbacks.onEvents(events);
    };
    const connect = () => {
        if (stopped || !ready() || socket) return;
        const token = getToken();
        if (!token || typeof WebSocket === "undefined") {
            scheduleFallback();
            return;
        }
        try {
            const current = new WebSocket(channelSocketUrl(channelIds, token));
            socket = current;
            current.onopen = () => {
                if (stopped || socket !== current) return;
                attempts = 0;
                clearTimer(fallbackTimer);
                fallbackTimer = null;
                callbacks.onOpen();
            };
            current.onmessage = (event) => {
                if (stopped || socket !== current) return;
                pendingEvents.push(...parseChannelEvents(event.data));
                if (pendingEvents.length && eventTimer === null)
                    eventTimer = setTimeout(flushEvents, 40);
            };
            current.onerror = () => current.close();
            current.onclose = () => {
                if (stopped || socket !== current) return;
                socket = null;
                scheduleReconnect();
                scheduleFallback();
            };
        } catch {
            socket = null;
            scheduleReconnect();
            scheduleFallback();
        }
    };
    const resume = () => {
        if (stopped) return;
        if (!ready()) {
            clearTimer(reconnectTimer);
            clearTimer(fallbackTimer);
            reconnectTimer = null;
            fallbackTimer = null;
            const previous = socket;
            socket = null;
            previous?.close();
            return;
        }
        if (!socket) {
            clearTimer(reconnectTimer);
            reconnectTimer = null;
            attempts = 0;
            connect();
            scheduleFallback();
        }
    };

    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    document.addEventListener("visibilitychange", resume);
    resume();

    return () => {
        stopped = true;
        window.removeEventListener("online", resume);
        window.removeEventListener("offline", resume);
        document.removeEventListener("visibilitychange", resume);
        clearTimer(reconnectTimer);
        clearTimer(fallbackTimer);
        clearTimer(eventTimer);
        pendingEvents = [];
        const previous = socket;
        socket = null;
        previous?.close();
    };
}
