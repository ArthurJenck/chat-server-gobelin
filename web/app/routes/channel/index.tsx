import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useAccount } from "../../features/auth/useAccount";
import { useChannelChat } from "../../features/chat/useChannelChat";
import KeyControl from "../../features/key/KeyControl";
import { PATHS } from "../../shared/config";
import ChannelPages from "./ChannelPages";
import { createChannelAudioEngine, type ChannelAudioEngine } from "../../features/sound/channelAudioEngine";
import { CHANNEL_SOUND_SETTINGS } from "../../features/chat/channelPagination";
import {
    DEFAULT_MUSIC_KEY,
    musicColor,
} from "../../features/chat/conversationMusic";
import "./channel.css";

export default function ChannelPage() {
    const { channelId } = useParams();
    const id = Number(channelId);
    const {
        account,
        loading: accountLoading,
        error: accountError,
    } = useAccount();
    const {
        channel,
        hasKey,
        messages,
        setVisibleMessages,
        loading,
        keyChannelId,
        keyState,
        content,
        setContent,
        busy,
        classifying,
        keyBusy,
        error,
        submit,
        toggleKey,
    } = useChannelChat(id, account);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
    const [activeMusicKey, setActiveMusicKey] = useState(DEFAULT_MUSIC_KEY);
    const largestViewportHeight = useRef<number | null>(null);
    const [audioState, setAudioState] = useState<{
        channelId: number;
        engine: ChannelAudioEngine;
    } | null>(null);

    useEffect(() => {
        const engine = createChannelAudioEngine(CHANNEL_SOUND_SETTINGS);
        setAudioState({ channelId: id, engine });
        return () => engine.dispose();
    }, [id]);

    useEffect(() => {
        const htmlOverflow = document.documentElement.style.overflow;
        const bodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";

        const update = () => {
            const height = window.visualViewport?.height ?? window.innerHeight;
            const top = window.visualViewport?.offsetTop ?? 0;
            largestViewportHeight.current = Math.max(
                largestViewportHeight.current ?? height,
                height,
            );
            setViewport((current) => current?.height === height && current.top === top
                ? current
                : { height, top });
        };
        update();
        window.addEventListener("resize", update);
        window.visualViewport?.addEventListener("resize", update);
        window.visualViewport?.addEventListener("scroll", update);
        return () => {
            document.documentElement.style.overflow = htmlOverflow;
            document.body.style.overflow = bodyOverflow;
            window.removeEventListener("resize", update);
            window.visualViewport?.removeEventListener("resize", update);
            window.visualViewport?.removeEventListener("scroll", update);
        };
    }, []);

    useEffect(() => {
        const element = textarea.current;
        if (!element) return;
        element.style.height = "40px";
        element.style.height = `${Math.max(40, element.scrollHeight)}px`;
    }, [content]);

    if (!accountLoading && account && !channel)
        return (
            <main>
                <p>Groupe introuvable.</p>
                <Link to={PATHS.home}>Retour</Link>
            </main>
        );

    return (
        <main
            className="channel-page"
            data-keyboard-open={
                viewport !== null &&
                viewport.height <
                    (largestViewportHeight.current ?? viewport.height) - 100
            }
            style={
                {
                    ...(viewport
                        ? { height: `${viewport.height}px`, top: `${viewport.top}px` }
                        : {}),
                    "--channel-key-color": musicColor(activeMusicKey),
                } as React.CSSProperties
            }
        >
            <header className="channel-header">
                <Link
                    className="channel-back"
                    to={PATHS.home}
                    aria-label="Retour aux channels"
                >
                    <img src="/pictos/arrow.svg" alt="" />
                </Link>
                <h1 className="channel-title">{channel?.name ?? "Groupe"}</h1>
                {hasKey && account && keyChannelId !== null && (
                    <KeyControl
                        state={keyState}
                        userId={account.id}
                        busy={keyBusy}
                        onChange={() => void toggleKey()}
                    />
                )}
            </header>
            {(accountLoading || (channel && loading && !error)) && (
                <p className="channel-status">Chargement des messages…</p>
            )}
            {(accountError || error) && (
                <p className="channel-status" role="alert">
                    {accountError || error}
                </p>
            )}
            {classifying && (
                <p className="channel-status" role="status">
                    Analyse de l’émotion…
                </p>
            )}
            {audioState?.channelId === id && (
                <ChannelPages
                    messages={messages}
                    userId={account?.id ?? null}
                    audio={audioState.engine}
                    preloadEnabled={Boolean(channel && !loading)}
                    onKeyChange={setActiveMusicKey}
                    onVisibleMessagesChange={setVisibleMessages}
                />
            )}
            {channel && (
                <form
                    className="channel-composer"
                    onSubmit={(event) => void submit(event)}
                >
                    <label
                        className="channel-screen-reader"
                        htmlFor="message-content"
                    >
                        Message
                    </label>
                    <textarea
                        ref={textarea}
                        id="message-content"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder="Écris ton message..."
                        rows={1}
                        required
                    />
                    <button
                        className="channel-send"
                        type="submit"
                        aria-label="Envoyer"
                        disabled={
                            !content.trim() ||
                            busy ||
                            (hasKey && keyChannelId === null)
                        }
                    />
                </form>
            )}
        </main>
    );
}
