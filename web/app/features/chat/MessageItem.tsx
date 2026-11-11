import { useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "../messages/types";
import { startPlayback } from "../sound/audioEngine";
import {
    DEFAULT_SOUND_SETTINGS,
    withInstrumentProfile,
} from "../sound/soundConfig";
import { createSoundPlan } from "../sound/soundPlan";
import { messageInstrument } from "./messageSound";

export default function MessageItem({
    message,
    hasKey,
}: {
    message: Message;
    hasKey: boolean;
}) {
    const instrument = messageInstrument(message);
    const settings = useMemo(
        () => withInstrumentProfile(DEFAULT_SOUND_SETTINGS, instrument),
        [instrument],
    );
    const plan = useMemo(
        () => createSoundPlan(message.content, settings),
        [message.content, settings],
    );
    const [playing, setPlaying] = useState(false);
    const [error, setError] = useState("");
    const stopRef = useRef<(() => void) | null>(null);
    const playId = useRef(0);

    useEffect(
        () => () => {
            playId.current += 1;
            stopRef.current?.();
        },
        [],
    );

    async function togglePlayback() {
        if (playing) {
            playId.current += 1;
            stopRef.current?.();
            stopRef.current = null;
            setPlaying(false);
            return;
        }
        const id = ++playId.current;
        setPlaying(true);
        setError("");
        try {
            const stop = await startPlayback(plan, settings, () => {
                if (playId.current === id) {
                    stopRef.current = null;
                    setPlaying(false);
                }
            });
            if (playId.current === id) stopRef.current = stop;
            else stop();
        } catch (cause) {
            if (playId.current === id) {
                setPlaying(false);
                setError(
                    cause instanceof Error
                        ? cause.message
                        : "Lecture impossible.",
                );
            }
        }
    }

    return (
        <li>
            <article>
                <header>
                    <h3 className="chat-message-user">
                        {message.user}
                        {hasKey ? " (détient la clé)" : ""}
                    </h3>
                    <time dateTime={message.creation_date}>
                        {new Date(message.creation_date).toLocaleString(
                            "fr-FR",
                        )}
                    </time>
                </header>
                <p className="chat-message-body">{message.content}</p>
                <figure>
                    <figcaption>Portée musicale du message</figcaption>
                </figure>
                <button
                    type="button"
                    onClick={() => void togglePlayback()}
                    disabled={!plan.events.length}
                >
                    {playing ? "Arrêter la lecture" : "Lire le message"}
                </button>
                {error && <p role="alert">{error}</p>}
            </article>
        </li>
    );
}
