import { useEffect, useMemo, useRef, useState } from "react";
import EmphasizedText from "../../components/EmphasizedText";
import { startPlayback } from "../sound/audioEngine";
import { withInstrumentProfile } from "../sound/soundConfig";
import { CHANNEL_SOUND_SETTINGS, type ChannelStaffBlock } from "./channelPagination";
import { messageInstrument } from "./messageSound";

export default function MessageItem({
    block,
    isOwn,
}: {
    block: ChannelStaffBlock;
    isOwn: boolean;
}) {
    const { message, plan, row, first } = block;
    const settings = useMemo(
        () => withInstrumentProfile(CHANNEL_SOUND_SETTINGS, messageInstrument(message)),
        [message],
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
                setError(cause instanceof Error ? cause.message : "Lecture impossible.");
            }
        }
    }

    return (
        <li className="channel-message">
            {first && (
                <div className={`channel-message-author${isOwn ? " channel-message-author-own" : ""}`}>
                    <span>{isOwn ? "Moi" : message.user}</span>
                    {isOwn && <img src="/pictos/note.svg" alt="" />}
                </div>
            )}
            <button
                className="channel-staff"
                type="button"
                aria-label={playing ? "Arrêter la lecture" : "Lire le message"}
                disabled={!plan.events.length}
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
                        className="channel-syllable"
                        style={{ left: `${group.x}px`, top: `${group.y}px` }}
                    >
                        <EmphasizedText>{group.text}</EmphasizedText>
                    </span>
                ))}
                <img className="channel-staff-coda channel-staff-coda-right" src="/pictos/coda.svg" alt="" />
            </button>
            {error && <p role="alert">{error}</p>}
        </li>
    );
}
