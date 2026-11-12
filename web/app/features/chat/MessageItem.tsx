import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { ChannelStaffBlock } from "./channelPagination";
import { isConversationRest, musicColor } from "./conversationMusic";
import type { ChannelVisual } from "./useChannelPlayback";

export default function MessageItem({
    block,
    isOwn,
    hasClassroomKey = false,
    onPlay,
    visual,
    loading,
    error,
}: {
    block: ChannelStaffBlock;
    isOwn: boolean;
    hasClassroomKey?: boolean;
    onPlay: (block: ChannelStaffBlock) => void;
    visual: ChannelVisual | null;
    loading: boolean;
    error: string;
}) {
    const { message, plan, row, first } = block;
    const silent = isConversationRest(message);
    const nodes = useRef(new Map<number, HTMLSpanElement>());
    const playing = Boolean(visual?.blockKeys.includes(block.key));

    useEffect(() => {
        if (!playing || !visual) return;
        const animationSettings = visual.settings;
        const timeline = gsap.timeline({ paused: true });
        const animated: HTMLSpanElement[] = [];
        for (const group of row) {
            const start = visual.eventStarts[group.eventIndex];
            const node = nodes.current.get(group.eventIndex);
            if (start === undefined || !node) continue;
            animated.push(node);
            gsap.set(node, { y: -animationSettings.visualRise, opacity: 0 });
            timeline.fromTo(node,
                { y: -animationSettings.visualRise, opacity: 0 },
                { y: 0, opacity: 1, duration: animationSettings.visualDuration, ease: animationSettings.visualEase },
                start,
            );
        }
        let frame = 0;
        const update = () => {
            const playhead = visual.getPlayhead();
            if (playhead === null) return;
            const time = Math.max(0, playhead - animationSettings.visualDelayMs / 1000);
            timeline.time(time);
            if (time < timeline.duration()) frame = requestAnimationFrame(update);
        };
        update();
        return () => {
            cancelAnimationFrame(frame);
            timeline.kill();
            gsap.set(animated, { y: 0, opacity: 1 });
        };
    }, [playing, visual]);

    return (
        <li
            className="channel-message"
            style={
                {
                    "--channel-key-color": musicColor({
                        root: block.pageKey.root,
                        mode: block.mode,
                    }),
                } as React.CSSProperties
            }
        >
            {first && !silent && (
                <div
                    className={`channel-message-author${isOwn ? " channel-message-author-own" : ""}`}
                    data-user-id={message.user_id}
                >
                    <span>{isOwn ? "Moi" : message.user}</span>
                    {isOwn && <img src="/pictos/note.svg" alt="" />}
                    {hasClassroomKey && <img className="channel-author-key" src="/pictos/key.svg" alt="Clé détenue" />}
                </div>
            )}
            <button
                className="channel-staff"
                type="button"
                aria-label={
                    silent
                        ? "Pause"
                        : loading
                          ? "Chargement du son, réessayer"
                        : playing
                          ? "Rejouer le message"
                          : "Lire le message"
                }
                disabled={
                    silent ||
                    !plan.events.some(
                        (event) => event.midi !== null || event.rest,
                    )
                }
                onPointerDown={(event) => event.currentTarget.setPointerCapture?.(event.pointerId)}
                onClick={() => onPlay(block)}
            >
                <svg
                    className="channel-staff-lines"
                    aria-hidden="true"
                    viewBox="0 0 360 40"
                    preserveAspectRatio="none"
                >
                    <g className="channel-staff-lines-blur">
                        {[0, 10, 20, 30, 40].map((y) => (
                            <line key={y} x1="0" x2="360" y1={y} y2={y} />
                        ))}
                    </g>
                    <g>
                        {[0, 10, 20, 30, 40].map((y) => (
                            <line key={y} x1="0" x2="360" y1={y} y2={y} />
                        ))}
                    </g>
                </svg>
                <img
                    className="channel-staff-coda channel-staff-coda-left"
                    src="/pictos/coda.svg"
                    alt=""
                />
                {row.map((group) => (
                    <span
                        key={group.eventIndex}
                        ref={(node) => {
                            if (node) nodes.current.set(group.eventIndex, node);
                            else nodes.current.delete(group.eventIndex);
                        }}
                        className={
                            group.rest
                                ? "channel-syllable channel-rest"
                                : "channel-syllable"
                        }
                        style={{ left: `${group.x}px`, top: `${group.y}px` }}
                    >
                        {group.rest ? (
                            <img
                                src={
                                    group.rest === "quarter"
                                        ? "/pictos/breath.svg"
                                        : "/pictos/silence.svg"
                                }
                                alt=""
                                width={group.rest === "quarter" ? 10 : 15}
                                height={group.rest === "quarter" ? 23 : 5}
                            />
                        ) : (
                            <p>{group.text}</p>
                        )}
                    </span>
                ))}
                <img
                    className="channel-staff-coda channel-staff-coda-right"
                    src="/pictos/coda.svg"
                    alt=""
                />
            </button>
            {error && <p role="alert">{error}</p>}
        </li>
    );
}
