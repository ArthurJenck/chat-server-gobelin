import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
    KEY_CHANNEL_NAME,
    MESSAGE_REFRESH_MS,
    NAMESPACE,
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

const AVAILABLE_KEY: KeyState = { holderId: null, holderName: null };

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

    function handleError(cause: unknown, fallback: string) {
        if (cause instanceof ApiError && cause.status === 401)
            void navigate(PATHS.welcome, { replace: true });
        else setError(cause instanceof Error ? cause.message : fallback);
    }

    const refresh = useCallback(
        async (technicalId: number | null, source: "initial" | "poll" | "sent" = "poll") => {
            const [nextMessages, nextKey] = await Promise.all([
                getMessages(id),
                technicalId === null
                    ? Promise.resolve(AVAILABLE_KEY)
                    : readKeyState(technicalId),
            ]);
            const filtered = nextMessages.filter((message) => !message.content.includes("clock tick"));
            const previous = knownMessages.current;
            const identities = new Set(filtered.map(messageIdentity));
            knownMessages.current = identities;
            setMessages((current) => JSON.stringify(current) === JSON.stringify(filtered)
                ? current
                : filtered);
            if (source === "poll" && previous) {
                const ids = filtered.map(messageIdentity).filter((identity) =>
                    !previous.has(identity) && !sentIds.current.has(identity),
                );
                if (ids.length)
                    setArrival({ sequence: ++arrivalSequence.current, source: "poll", ids });
            }
            setKeyState(nextKey);
        },
        [id],
    );

    useEffect(() => {
        if (!account || !channel) return;
        let active = true;
        let timer: ReturnType<typeof setInterval> | undefined;
        setLoading(true);
        setKeyChannelId(null);
        (async () => {
            const technicalId = hasKey ? (await ensureKeyChannel(account)).id : null;
            if (!active) return;
            setKeyChannelId(technicalId);
            await refresh(technicalId, "initial");
            if (active) {
                setLoading(false);
                timer = setInterval(() => {
                    if (document.visibilityState === "visible")
                        void refresh(technicalId, "poll").catch((cause: unknown) =>
                            handleError(cause, "Actualisation impossible."),
                        );
                }, MESSAGE_REFRESH_MS);
            }
        })()
            .catch((cause: unknown) => {
                if (!active) return;
                setLoading(false);
                handleError(cause, "Chargement impossible.");
            });
        return () => {
            active = false;
            if (timer) clearInterval(timer);
        };
    }, [account, channel?.id, hasKey, refresh]);

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
            const sent = await sendMessage(id, text, {
                instrument,
                music_root: key.root,
                music_mode: key.mode,
                emotion,
            });
            const sentIdentity = messageIdentity(sent);
            sentIds.current.add(sentIdentity);
            setContent("");
            await refresh(keyChannelId, "sent");
            setArrival({ sequence: ++arrivalSequence.current, source: "sent", ids: [sentIdentity] });
        } catch (cause) {
            handleError(cause, "Envoi impossible.");
        } finally {
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
