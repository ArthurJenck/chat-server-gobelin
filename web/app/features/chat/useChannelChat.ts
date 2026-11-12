import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
    KEY_CHANNEL_NAME,
    NAMESPACE,
    PARIS_TIME_ZONE,
    PATHS,
} from "../../shared/config";
import { ApiError } from "../../shared/http/ApiError";
import { metadataForProject } from "../../shared/projectMetadata";
import {
    ensureKeyChannel,
    readKeyState,
    toggleKeyState,
} from "../key/keyChannel";
import type { KeyState } from "../key/keyState";
import { getMessages, sendMessage } from "../messages/api";
import type { Message } from "../messages/types";
import { accountInstrument } from "../users/instrument";
import type { Account } from "../users/types";
import { isConversationRest, latestMusicKey, publishDueConversationRest } from "./conversationMusic";
import { emotionCacheKey, readCachedEmotion, writeCachedEmotion } from "./emotionCache";
import { classifyEmotion } from "./emotionClient";
import { messageEmotion, type Emotion } from "./emotion";
import { messageIdentity } from "./channelScore";
import { watchChannelSocket } from "./channelSocket";

const AVAILABLE_KEY: KeyState = { holderId: null, holderName: null };
const parisDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

function untilParisMidnight() {
    const now = Date.now();
    const today = parisDay.format(now);
    let lower = now;
    let upper = now + 26 * 60 * 60 * 1000;
    while (upper - lower > 1_000) {
        const middle = Math.floor((lower + upper) / 2);
        if (parisDay.format(middle) === today) lower = middle;
        else upper = middle;
    }
    return Math.max(1, upper - now);
}

export type MessageArrival = {
    sequence: number;
    source: "poll" | "sent";
    ids: string[];
};

export function useChannelChat(id: number, account: Account | null) {
    const navigate = useNavigate();
    const channel = account?.channels?.find(
        (item) => item.id === id && item.name !== KEY_CHANNEL_NAME,
    );
    const hasKey = channel?.name === "general";
    const [messages, setMessages] = useState<Message[]>([]);
    const [visiblePage, setVisiblePage] = useState<{ channelId: number; messages: Message[] }>({
        channelId: id,
        messages: [],
    });
    const [keyChannelId, setKeyChannelId] = useState<number | null>(null);
    const [keyState, setKeyState] = useState<KeyState>(AVAILABLE_KEY);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState("");
    const [busy, setBusy] = useState(false);
    const [arrival, setArrival] = useState<MessageArrival | null>(null);
    const [classifying, setClassifying] = useState(false);
    const [keyBusy, setKeyBusy] = useState(false);
    const [error, setError] = useState("");
    const [localEmotions, setLocalEmotions] = useState<Record<string, Emotion>>({});
    const pendingEmotions = useRef(new Set<string>());
    const failedEmotions = useRef(new Set<string>());
    const knownMessages = useRef<Set<string> | null>(null);
    const sentIds = useRef(new Set<string>());
    const sending = useRef(false);
    const requestSyncRef = useRef<((messages: boolean, key: boolean) => Promise<void>) | null>(null);
    const arrivalSequence = useRef(0);

    useEffect(() => {
        knownMessages.current = null;
        sentIds.current.clear();
        setArrival(null);
    }, [id]);
    const setVisibleMessages = useCallback((pageMessages: Message[]) => {
        setVisiblePage({ channelId: id, messages: pageMessages });
    }, [id]);

    const displayMessages = useMemo(() => messages.map((message) => {
        if (isConversationRest(message) || messageEmotion(message)) return message;
        const key = emotionCacheKey(id, message);
        const emotion = localEmotions[key] ?? readCachedEmotion(key);
        if (!emotion) return message;
        return {
            ...message,
            metadata: {
                ...message.metadata,
                [NAMESPACE]: { ...metadataForProject(message.metadata), emotion },
            },
        };
    }), [id, localEmotions, messages]);

    useEffect(() => {
        if (visiblePage.channelId !== id) return;
        let active = true;
        const missing = [...visiblePage.messages].sort((a, b) =>
            Date.parse(b.creation_date) - Date.parse(a.creation_date),
        );
        void (async () => {
            for (const message of missing) {
                if (!active) break;
                if (isConversationRest(message) || messageEmotion(message)) continue;
                const key = emotionCacheKey(id, message);
                if (readCachedEmotion(key) || pendingEmotions.current.has(key) ||
                    failedEmotions.current.has(key)) continue;
                pendingEmotions.current.add(key);
                try {
                    const emotion = await classifyEmotion(message.content);
                    if (!active) break;
                    writeCachedEmotion(key, emotion);
                    setLocalEmotions((current) => ({ ...current, [key]: emotion }));
                } catch {
                    failedEmotions.current.add(key);
                } finally {
                    pendingEmotions.current.delete(key);
                }
            }
        })();
        return () => { active = false; };
    }, [id, visiblePage]);

    const handleError = useCallback((cause: unknown, fallback: string) => {
        if (cause instanceof ApiError && cause.status === 401)
            void navigate(PATHS.welcome, { replace: true });
        else setError(cause instanceof Error ? cause.message : fallback);
    }, [navigate]);

    useEffect(() => {
        if (!account || !channel) return;
        let active = true;
        let stopSocket: (() => void) | null = null;
        let midnightTimer: ReturnType<typeof setTimeout> | null = null;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        let running = false;
        let queuedMessages = false;
        let queuedKey = false;
        let retryMessages = false;
        let retryKey = false;
        let waiters: Array<{ resolve: () => void; reject: (cause: unknown) => void }> = [];
        setLoading(true);
        setKeyChannelId(null);

        const begin = async () => {
            const technicalId = hasKey ? (await ensureKeyChannel(account)).id : null;
            if (!active) return;
            setKeyChannelId(technicalId);

            const loadSnapshot = async (loadMessages: boolean, loadKey: boolean) => {
                const [nextMessages, nextKey] = await Promise.all([
                    loadMessages ? getMessages(id) : Promise.resolve(null),
                    loadKey && technicalId !== null
                        ? readKeyState(technicalId)
                        : Promise.resolve(null),
                ]);
                if (!active) return;
                if (nextMessages !== null) {
                    const filtered = nextMessages.filter((message) => !message.content.includes("clock tick"));
                    const previous = knownMessages.current;
                    const identities = new Set(filtered.map(messageIdentity));
                    knownMessages.current = identities;
                    setMessages((current) => JSON.stringify(current) === JSON.stringify(filtered)
                        ? current
                        : filtered);
                    if (previous) {
                        const ids = filtered.map(messageIdentity).filter((identity, index) =>
                            !previous.has(identity) && !sentIds.current.has(identity) &&
                            !(sending.current && filtered[index].user_id === account.id),
                        );
                        if (ids.length)
                            setArrival({ sequence: ++arrivalSequence.current, source: "poll", ids });
                    }
                }
                if (nextKey !== null) setKeyState(nextKey);
            };

            function scheduleRetry(loadMessages: boolean, loadKey: boolean, cause: unknown) {
                if (cause instanceof ApiError && cause.status === 401) return;
                retryMessages ||= loadMessages;
                retryKey ||= loadKey;
                if (retryTimer !== null) return;
                retryTimer = setTimeout(() => {
                    retryTimer = null;
                    if (!active || !navigator.onLine || document.visibilityState !== "visible") return;
                    const messages = retryMessages;
                    const key = retryKey;
                    retryMessages = false;
                    retryKey = false;
                    void requestSync(messages, key).catch((error: unknown) =>
                        handleError(error, "Actualisation impossible."),
                    );
                }, 15_000 + Math.random() * 10_000);
            }

            const drain = async () => {
                if (running) return;
                running = true;
                while (active && (queuedMessages || queuedKey)) {
                    const loadMessages = queuedMessages;
                    const loadKey = queuedKey;
                    queuedMessages = false;
                    queuedKey = false;
                    const currentWaiters = waiters;
                    waiters = [];
                    try {
                        await loadSnapshot(loadMessages, loadKey);
                        if (loadMessages) retryMessages = false;
                        if (loadKey) retryKey = false;
                        if (!retryMessages && !retryKey && retryTimer !== null) {
                            clearTimeout(retryTimer);
                            retryTimer = null;
                        }
                        currentWaiters.forEach(({ resolve }) => resolve());
                    } catch (cause) {
                        scheduleRetry(loadMessages, loadKey, cause);
                        currentWaiters.forEach(({ reject }) => reject(cause));
                    }
                }
                running = false;
            };
            const requestSync = (loadMessages: boolean, loadKey: boolean) =>
                new Promise<void>((resolve, reject) => {
                    if (!active) {
                        resolve();
                        return;
                    }
                    queuedMessages ||= loadMessages;
                    queuedKey ||= loadKey;
                    waiters.push({ resolve, reject });
                    void drain();
                });
            const syncOrReport = (loadMessages: boolean, loadKey: boolean) => {
                void requestSync(loadMessages, loadKey).catch((cause: unknown) =>
                    handleError(cause, "Actualisation impossible."),
                );
            };
            requestSyncRef.current = requestSync;
            stopSocket = watchChannelSocket(
                technicalId === null ? [id] : [id, technicalId],
                {
                    onOpen: () => syncOrReport(true, technicalId !== null),
                    onEvents: (events) => {
                        const mainChanged = events.some((event) => event.channelId === id);
                        const keyChanged = technicalId !== null &&
                            events.some((event) => event.channelId === technicalId);
                        if (mainChanged || keyChanged) syncOrReport(mainChanged, keyChanged);
                    },
                    onFallback: () => syncOrReport(true, technicalId !== null),
                },
            );
            const scheduleMidnight = () => {
                midnightTimer = setTimeout(() => {
                    if (!active) return;
                    setKeyState(AVAILABLE_KEY);
                    if (navigator.onLine && document.visibilityState === "visible")
                        syncOrReport(false, true);
                    scheduleMidnight();
                }, untilParisMidnight());
            };
            if (technicalId !== null) scheduleMidnight();
            await requestSync(true, technicalId !== null);
            if (active) setLoading(false);
        };
        void begin()
            .catch((cause: unknown) => {
                if (!active) return;
                setLoading(false);
                handleError(cause, "Chargement impossible.");
            });
        return () => {
            active = false;
            stopSocket?.();
            if (midnightTimer !== null) clearTimeout(midnightTimer);
            if (retryTimer !== null) clearTimeout(retryTimer);
            waiters.forEach(({ resolve }) => resolve());
            waiters = [];
            requestSyncRef.current = null;
        };
    }, [account, channel?.id, hasKey, handleError, id]);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const text = content.trim();
        const instrument = account && accountInstrument(account);
        if (!text || !instrument || (hasKey && keyChannelId === null) || busy) return;
        setBusy(true);
        setError("");
        try {
            setClassifying(true);
            const emotion = await classifyEmotion(text);
            setClassifying(false);
            await publishDueConversationRest(id).catch(() => false);
            const key = latestMusicKey(await getMessages(id));
            sending.current = true;
            const sent = await sendMessage(id, text, {
                instrument,
                music_root: key.root,
                music_mode: key.mode,
                emotion,
            });
            const sentIdentity = messageIdentity(sent);
            sentIds.current.add(sentIdentity);
            setContent("");
            await requestSyncRef.current?.(true, keyChannelId !== null);
            setArrival({ sequence: ++arrivalSequence.current, source: "sent", ids: [sentIdentity] });
        } catch (cause) {
            handleError(cause, "Envoi impossible.");
        } finally {
            sending.current = false;
            setClassifying(false);
            setBusy(false);
        }
    }

    async function toggleKey() {
        if (!hasKey || !account || keyChannelId === null || keyBusy) return;
        setKeyBusy(true);
        setError("");
        try {
            setKeyState(await toggleKeyState(keyChannelId, account, keyState));
            await requestSyncRef.current?.(false, true);
        } catch (cause) {
            handleError(cause, "Mise à jour de la clé impossible.");
        } finally {
            setKeyBusy(false);
        }
    }

    return {
        channel,
        hasKey,
        messages: displayMessages,
        setVisibleMessages,
        loading,
        keyChannelId,
        keyState,
        content,
        setContent,
        busy,
        arrival,
        classifying,
        keyBusy,
        error,
        submit,
        toggleKey,
    };
}
