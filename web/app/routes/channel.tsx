import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ApiError, getMessages, sendMessage, type Message } from "../api";
import KeyControl from "../components/KeyControl";
import MessageItem from "../components/MessageItem";
import PageHeader from "../components/PageHeader";
import { KEY_CHANNEL_NAME, MESSAGE_REFRESH_MS, PATHS } from "../config";
import {
    ensureKeyChannel,
    readKeyState,
    toggleKeyState,
    type KeyState,
} from "../managers/key";
import { accountInstrument } from "../managers/profile";
import { useAccount } from "../managers/useAccount";

const AVAILABLE_KEY: KeyState = { holderId: null, holderName: null };

export default function ChannelPage() {
    const { channelId } = useParams();
    const id = Number(channelId);
    const navigate = useNavigate();
    const {
        account,
        loading: accountLoading,
        error: accountError,
    } = useAccount();
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
            void navigate(PATHS.login, { replace: true });
        else setError(cause instanceof Error ? cause.message : fallback);
    }

    const refresh = useCallback(
        async (technicalId: number) => {
            const [nextMessages, nextKey] = await Promise.all([
                getMessages(id),
                readKeyState(technicalId),
            ]);
            setMessages(nextMessages);
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

    if (!accountLoading && account && !channel)
        return (
            <main>
                <p>Groupe introuvable.</p>
                <Link to={PATHS.home}>Retour</Link>
            </main>
        );

    return (
        <main>
            <PageHeader title={channel?.name ?? "Groupe"} back={PATHS.home} />
            {account && keyChannelId !== null && (
                <KeyControl
                    state={keyState}
                    userId={account.id}
                    busy={keyBusy}
                    onChange={() => void toggleKey()}
                />
            )}
            {(accountLoading ||
                (channel && keyChannelId === null && !error)) && (
                <p>Chargement des messages…</p>
            )}
            {(accountError || error) && (
                <p role="alert">{accountError || error}</p>
            )}
            <section aria-labelledby="messages-heading">
                <h2 id="messages-heading">Messages</h2>
                {messages.length ? (
                    <ol>
                        {[...messages].reverse().map((message, index) => (
                            <MessageItem
                                key={
                                    message.id ??
                                    `${message.creation_date}-${message.user_id}-${index}`
                                }
                                message={message}
                                hasKey={keyState.holderId === message.user_id}
                            />
                        ))}
                    </ol>
                ) : (
                    keyChannelId !== null && <p>Aucun message.</p>
                )}
            </section>
            {channel && (
                <form onSubmit={(event) => void submit(event)}>
                    <label htmlFor="message-content">Message</label>
                    <textarea
                        id="message-content"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        required
                    />
                    <button
                        type="submit"
                        disabled={
                            !content.trim() || busy || keyChannelId === null
                        }
                    >
                        Envoyer
                    </button>
                </form>
            )}
        </main>
    );
}
