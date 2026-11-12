import { useEffect, useMemo, useRef, useState } from "react";
import EmphasizedText from "../../components/EmphasizedText";
import type { ChannelAudioEngine } from "../sound/channelAudioEngine";
import { withInstrumentProfile } from "../sound/soundConfig";
import { CHANNEL_SOUND_SETTINGS, type ChannelStaffBlock } from "./channelPagination";
import { messageInstrument } from "./messageSound";
import { isConversationRest, musicColor } from "./conversationMusic";

export default function MessageItem({
    block,
    isOwn,
    audio,
}: {
    block: ChannelStaffBlock;
    isOwn: boolean;
    audio: ChannelAudioEngine;
}) {
    const { message, plan, row, first } = block;
    const silent = isConversationRest(message);
    const settings = useMemo(
        () => withInstrumentProfile({ ...CHANNEL_SOUND_SETTINGS, ...block.pageKey, mode: block.mode }, messageInstrument(message)),
        [message, block.pageKey, block.mode],
    );
    const [playing, setPlaying] = useState(false);
    const [error, setError] = useState("");
    const stopRef = useRef<(() => void) | null>(null);
    const controllerRef = useRef<AbortController | null>(null);
    const playId = useRef(0);

    useEffect(
        () => () => {
            playId.current += 1;
            controllerRef.current?.abort();
            stopRef.current?.();
        },
        [],
    );

    async function togglePlayback() {
        controllerRef.current?.abort();
        stopRef.current?.();
        stopRef.current = null;
        const controller = new AbortController();
        controllerRef.current = controller;
        const id = ++playId.current;
        setPlaying(true);
        setError("");
        try {
            const stop = await audio.play(plan, settings, () => {
                if (playId.current === id) {
                    stopRef.current = null;
                    setPlaying(false);
                }
            }, controller.signal);
            if (playId.current === id) stopRef.current = stop;
            else stop();
        } catch (cause) {
            if (playId.current === id) {
                setPlaying(false);
                setError(cause instanceof Error ? cause.message : "Lecture impossible.");
            }
        }
    }

    return (
        <li
            className="channel-message"
            style={{ "--channel-key-color": musicColor({ root: block.pageKey.root, mode: block.mode }) } as React.CSSProperties}
        >
            {first && !silent && (
                <div className={`channel-message-author${isOwn ? " channel-message-author-own" : ""}`}>
                    <span>{isOwn ? "Moi" : message.user}</span>
                    {isOwn && <img src="/pictos/note.svg" alt="" />}
                </div>
            )}
            <button
                className="channel-staff"
                type="button"
                aria-label={silent ? "Pause" : playing ? "Rejouer le message" : "Lire le message"}
                disabled={silent || !plan.events.some((event) => event.midi !== null || event.rest)}
                onClick={() => void togglePlayback()}
            >
                <svg className="channel-staff-lines" aria-hidden="true" viewBox="0 0 360 40" preserveAspectRatio="none">
                    <g className="channel-staff-lines-blur">
                        {[0, 10, 20, 30, 40].map((y) => <line key={y} x1="0" x2="360" y1={y} y2={y} />)}
                    </g>
                    <g>
                        {[0, 10, 20, 30, 40].map((y) => <line key={y} x1="0" x2="360" y1={y} y2={y} />)}
                    </g>
                </svg>
                <img className="channel-staff-coda channel-staff-coda-left" src="/pictos/coda.svg" alt="" />
                {row.map((group) => (
                    <span
                        key={group.eventIndex}
                        className={group.rest ? "channel-syllable channel-rest" : "channel-syllable"}
                        style={{ left: `${group.x}px`, top: `${group.y}px` }}
                    >
                        {group.rest ? (
                            <img
                                src={group.rest === "quarter" ? "/pictos/breath.svg" : "/pictos/silence.svg"}
                                alt=""
                                width={group.rest === "quarter" ? 10 : 15}
                                height={group.rest === "quarter" ? 23 : 5}
                            />
                        ) : <EmphasizedText>{group.text}</EmphasizedText>}
                    </span>
                ))}
                <img className="channel-staff-coda channel-staff-coda-right" src="/pictos/coda.svg" alt="" />
            </button>
            {error && <p role="alert">{error}</p>}
        </li>
    );
}
