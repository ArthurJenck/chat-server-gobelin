import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
    KEY_CHANNEL_NAME,
    MESSAGE_REFRESH_MS,
    PATHS,
} from "../../shared/config";
import { ApiError } from "../../shared/http/ApiError";
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

const AVAILABLE_KEY: KeyState = { holderId: null, holderName: null };

export function useChannelChat(id: number, account: Account | null) {
    const navigate = useNavigate();
    const channel = account?.channels?.find(
        (item) => item.id === id && item.name !== KEY_CHANNEL_NAME,
    );
    const [messages, setMessages] = useState<Message[]>([]);
    const [keyChannelId, setKeyChannelId] = useState<number | null>(null);
    const [keyState, setKeyState] = useState<KeyState>(AVAILABLE_KEY);
    const [content, setContent] = useState("");
    const [busy, setBusy] = useState(false);
    const [keyBusy, setKeyBusy] = useState(false);
    const [error, setError] = useState("");

    function handleError(cause: unknown, fallback: string) {
        if (cause instanceof ApiError && cause.status === 401)
            void navigate(PATHS.welcome, { replace: true });
        else setError(cause instanceof Error ? cause.message : fallback);
    }

    const refresh = useCallback(
        async (technicalId: number) => {
            const [nextMessages, nextKey] = await Promise.all([
                getMessages(id),
                readKeyState(technicalId),
            ]);
            setMessages(
                nextMessages.filter(
                    (message) => !message.content.includes("clock tick"),
                ),
            );
            setKeyState(nextKey);
        },
        [id],
    );

    useEffect(() => {
        if (!account || !channel) return;
        let active = true;
        let timer: ReturnType<typeof setInterval> | undefined;
        ensureKeyChannel(account)
            .then(async (technical) => {
                if (!active) return;
                setKeyChannelId(technical.id);
                await refresh(technical.id);
                if (active)
                    timer = setInterval(() => {
                        if (document.visibilityState === "visible")
                            void refresh(technical.id).catch((cause: unknown) =>
                                handleError(cause, "Actualisation impossible."),
                            );
                    }, MESSAGE_REFRESH_MS);
            })
            .catch((cause: unknown) => {
                if (active) handleError(cause, "Chargement impossible.");
            });
        return () => {
            active = false;
            if (timer) clearInterval(timer);
        };
    }, [account, channel?.id, refresh]);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const text = content.trim();
        const instrument = account && accountInstrument(account);
        if (!text || !instrument || keyChannelId === null || busy) return;
        setBusy(true);
        setError("");
        try {
            await sendMessage(id, text, { instrument });
            setContent("");
            await refresh(keyChannelId);
        } catch (cause) {
            handleError(cause, "Envoi impossible.");
        } finally {
            setBusy(false);
        }
    }

    async function toggleKey() {
        if (!account || keyChannelId === null || keyBusy) return;
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
        messages,
        keyChannelId,
        keyState,
        content,
        setContent,
        busy,
        keyBusy,
        error,
        submit,
        toggleKey,
    };
}
