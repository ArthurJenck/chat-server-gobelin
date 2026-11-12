import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import MessageItem from "../../features/chat/MessageItem";
import { applyPageMusicKeys, buildChannelStaffs, pageGradientKey, paginateChannelStaffs } from "../../features/chat/channelPagination";
import { musicColor, type MusicKey } from "../../features/chat/conversationMusic";
import type { Message } from "../../features/messages/types";
import type { ChannelAudioEngine } from "../../features/sound/channelAudioEngine";
import type { Instrument } from "../../features/sound/soundConfig";
import { messageInstrument } from "../../features/chat/messageSound";
import { glissandoPerformance, messagePerformance, pagePerformances } from "../../features/chat/channelScore";
import { useChannelPlayback } from "../../features/chat/useChannelPlayback";
import type { MessageArrival } from "../../features/chat/useChannelChat";
import ChannelPagination from "./ChannelPagination";

export default function ChannelPages({
    messages,
    userId,
    audio,
    preloadEnabled,
    arrival,
    onKeyChange,
    onVisibleMessagesChange,
}: {
    messages: Message[];
    userId: number | null;
    audio: ChannelAudioEngine;
    preloadEnabled: boolean;
    arrival: MessageArrival | null;
    onKeyChange: (key: MusicKey) => void;
    onVisibleMessagesChange: (messages: Message[]) => void;
}) {
    const container = useRef<HTMLElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const sheets = useRef<(HTMLOListElement | null)[]>([]);
    const pressedStaff = useRef<HTMLButtonElement | null>(null);
    const pageIndex = useRef(0);
    const pageNavigation = useRef<gsap.core.Tween | null>(null);
    const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigation = useRef<{ start: number; gliss: boolean; sentIds: string[] | null } | null>(null);
    const initialPlayed = useRef(false);
    const handledArrival = useRef(0);
    const [size, setSize] = useState({ width: 360, height: 600 });
    const [sizeReady, setSizeReady] = useState(false);
    const [activePage, setActivePage] = useState(0);
    const playback = useChannelPlayback(audio);
    const blocks = useMemo(() => buildChannelStaffs(messages, size.width), [messages, size.width]);
    const pages = useMemo(() => applyPageMusicKeys(
        paginateChannelStaffs(blocks, size.height), size.width,
    ), [blocks, size.height, size.width]);

    const finishNavigation = () => {
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = null;
        const current = navigation.current;
        navigation.current = null;
        if (!current) return;
        const page = pages[pageIndex.current] ?? [];
        const performances = pagePerformances(page);
        const selected = current.sentIds
            ? performances.filter((item) => current.sentIds!.includes(item.id))
            : performances;
        if (current.gliss) playback.append(selected);
        else playback.replace(selected);
    };

    const scheduleSettle = () => {
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => {
            if (pageNavigation.current) return;
            finishNavigation();
        }, 700);
    };

    const startNavigation = (sentIds: string[] | null = null) => {
        if (settleTimer.current) clearTimeout(settleTimer.current);
        navigation.current = { start: pageIndex.current, gliss: false, sentIds };
        playback.cancel();
    };

    const maybeGlissando = (target: number) => {
        const current = navigation.current;
        if (!current || current.gliss || Math.abs(target - current.start) < 3) return;
        current.gliss = true;
        playback.replace([glissandoPerformance(target > current.start ? "older" : "newer")]);
    };

    const staffAtPoint = (x: number, y: number) => {
        for (const staff of sheets.current[pageIndex.current]?.querySelectorAll<HTMLButtonElement>(".channel-staff") ?? []) {
            if (staff.disabled) continue;
            const rect = staff.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right &&
                y >= rect.top && y <= rect.bottom) return staff;
        }
        return null;
    };

    const clearPressedStaff = () => {
        pressedStaff.current?.removeAttribute("data-pressed");
        pressedStaff.current = null;
    };

    const updateHoveredStaff = (stage: HTMLDivElement, x: number, y: number) => {
        stage.style.cursor = staffAtPoint(x, y) ? "pointer" : "";
    };

    const syncActivePage = (scrollLeft: number, width: number) => {
        const progress = width > 0
            ? Math.max(0, Math.min(pages.length - 1,
                pages.length - 1 - scrollLeft / width))
            : Math.min(pageIndex.current, pages.length - 1);
        const current = Math.min(
            pages.length - 1,
            Math.max(0, Math.round(progress)),
        );
        sheets.current.slice(0, pages.length).forEach((sheet, index) => {
            if (!sheet) return;
            const turn = Math.max(0, Math.min(1, progress - index));
            const depth = Math.max(0, Math.min(1, (progress - index) * 2));
            const front = index === 0 ? 13 : -index;
            const back = index === 0 ? -13 : index;
            gsap.set(sheet, {
                rotateY: (180 - index / 2) * turn,
                z: front + (back - front) * depth,
            });
            const hidden = index !== current;
            sheet.inert = hidden;
            sheet.setAttribute("aria-hidden", String(hidden));
        });
        if (pageIndex.current !== current) {
            clearPressedStaff();
            if (stage.current) stage.current.style.cursor = "";
            pageIndex.current = current;
            setActivePage(current);
        }
        maybeGlissando(current);
    };

    const goToPage = (target: number, maxDuration = Infinity, sentIds: string[] | null = null) => {
        const element = scroller.current;
        if (!element) return;
        pageNavigation.current?.kill();
        pageNavigation.current = null;
        const scrollLeft = (pages.length - 1 - target) * element.clientWidth;
        if (Math.abs(element.scrollLeft - scrollLeft) < 1) {
            if (sentIds) playback.replace(pagePerformances(pages[target] ?? [])
                .filter((item) => sentIds.includes(item.id)));
            return;
        }
        startNavigation(sentIds);
        maybeGlissando(target);
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            element.scrollLeft = scrollLeft;
            syncActivePage(scrollLeft, element.clientWidth);
            finishNavigation();
            return;
        }
        pageNavigation.current = gsap.to(element, {
            scrollLeft,
            duration: Math.min(maxDuration, Math.max(0.2, Math.abs(scrollLeft - element.scrollLeft) / Math.max(1, element.clientWidth) * 0.4)),
            ease: "none",
            onUpdate: () => syncActivePage(element.scrollLeft, element.clientWidth),
            onComplete: () => {
                pageNavigation.current = null;
                syncActivePage(element.scrollLeft, element.clientWidth);
                finishNavigation();
            },
        });
    };

    useEffect(() => {
        if (!preloadEnabled || !sizeReady || initialPlayed.current) return;
        initialPlayed.current = true;
        playback.replace(pagePerformances(pages[0] ?? []));
    }, [preloadEnabled, sizeReady]);

    useEffect(() => {
        if (!arrival || !sizeReady || handledArrival.current === arrival.sequence) return;
        handledArrival.current = arrival.sequence;
        if (arrival.source === "sent") {
            goToPage(0, 1.5, arrival.ids);
            return;
        }
        if (pageIndex.current !== 0 || navigation.current) return;
        playback.append(pagePerformances(pages[0] ?? []).filter((item) =>
            arrival.ids.includes(item.id)));
    }, [arrival, pages, sizeReady]);

    useEffect(() => () => {
        pageNavigation.current?.kill();
        if (settleTimer.current) clearTimeout(settleTimer.current);
    }, []);

    useEffect(() => {
        if (!preloadEnabled) return;
        const visible = new Set<Instrument>();
        for (const block of pages[activePage] ?? []) {
            if (block.plan.events.some((event) => event.midi !== null))
                visible.add(messageInstrument(block.message));
        }
        audio.preload(["piano", ...[...visible].filter((instrument) => instrument !== "piano")]);
    }, [activePage, audio, pages, preloadEnabled]);

    useEffect(() => {
        onKeyChange(pageGradientKey(pages[activePage] ?? []));
    }, [activePage, onKeyChange, pages]);

    useEffect(() => {
        const unique = new Map<string, Message>();
        for (const block of pages[activePage] ?? []) {
            const message = block.message;
            const identity = message.id ??
                `${message.creation_date}-${message.user_id}-${message.content}`;
            unique.set(String(identity), message);
        }
        onVisibleMessagesChange([...unique.values()]);
    }, [activePage, onVisibleMessagesChange, pages]);

    useEffect(() => {
        setActivePage((current) => Math.min(current, pages.length - 1));
    }, [pages.length]);

    useLayoutEffect(() => {
        const element = container.current;
        if (!element) return;
        const update = () => {
            const width = Math.max(1, (element.clientWidth || 400) - 40);
            const height = Math.max(1, (element.clientHeight || 650) - 50);
            setSize((current) => current.width === width && current.height === height
                ? current
                : { width, height });
            setSizeReady(true);
        };
        update();
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", update);
            return () => window.removeEventListener("resize", update);
        }
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
        const element = scroller.current;
        if (!element) return;
        pageNavigation.current?.kill();
        pageNavigation.current = null;
        const current = Math.min(pageIndex.current, pages.length - 1);
        element.scrollLeft = (pages.length - 1 - current) * element.clientWidth;
        pageIndex.current = current;
        setActivePage(current);
        syncActivePage(element.scrollLeft, element.clientWidth);
    }, [pages.length, size.width]);

    useLayoutEffect(() => {
        const element = scroller.current;
        if (!element || typeof window.matchMedia !== "function") return;
        gsap.registerPlugin(ScrollTrigger);
        const snap = pages.length > 1 ? ScrollTrigger.create({
            scroller: element,
            horizontal: true,
            start: 0,
            end: () => (pages.length - 1) * element.clientWidth,
            snap: {
                snapTo: 1 / (pages.length - 1),
                directional: false,
                inertia: false,
                delay: 0.25,
                duration: { min: 0.15, max: 0.3 },
                ease: "power2.out",
            },
        }) : null;
        ScrollTrigger.refresh();
        return () => {
            snap?.kill();
        };
    }, [pages.length, size.width]);

    useEffect(() => {
        const element = scroller.current;
        if (!element) return;
        const wheel = (event: WheelEvent) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || pages.length < 2) return;
            event.preventDefault();
            if (!navigation.current) startNavigation();
            pageNavigation.current?.kill();
            pageNavigation.current = null;
            element.scrollLeft = Math.max(0, Math.min(
                (pages.length - 1) * element.clientWidth,
                element.scrollLeft - event.deltaY,
            ));
            syncActivePage(element.scrollLeft, element.clientWidth);
            scheduleSettle();
        };
        const touchStart = () => {
            pageNavigation.current?.kill();
            pageNavigation.current = null;
        };
        element.addEventListener("wheel", wheel, { passive: false });
        element.addEventListener("touchstart", touchStart, { passive: true });
        return () => {
            element.removeEventListener("wheel", wheel);
            element.removeEventListener("touchstart", touchStart);
        };
    }, [pages.length]);

    return (
        <>
            <section
                ref={container}
                className="channel-messages"
            >
                <div
                    ref={scroller}
                    className="channel-messages-scroller"
                    role="region"
                    aria-label="Messages"
                    onScroll={(event) => {
                        if (!navigation.current && !pageNavigation.current) {
                            const expected = (pages.length - 1 - pageIndex.current) * event.currentTarget.clientWidth;
                            if (Math.abs(event.currentTarget.scrollLeft - expected) > 1) startNavigation();
                        }
                        syncActivePage(event.currentTarget.scrollLeft, event.currentTarget.clientWidth);
                        if (navigation.current && !pageNavigation.current) scheduleSettle();
                    }}
                >
                    <div className="channel-page-track" style={{ width: `${pages.length * 100}%` }}>
                        <div
                            className="channel-page-stage"
                            ref={stage}
                            style={{ width: `${100 / pages.length}%` }}
                            onPointerMove={(event) => {
                                if (event.pointerType !== "touch")
                                    updateHoveredStaff(event.currentTarget, event.clientX, event.clientY);
                            }}
                            onPointerDown={(event) => {
                                clearPressedStaff();
                                const staff = staffAtPoint(event.clientX, event.clientY);
                                if (!staff) return;
                                staff.setAttribute("data-pressed", "");
                                pressedStaff.current = staff;
                            }}
                            onPointerUp={clearPressedStaff}
                            onPointerCancel={clearPressedStaff}
                            onPointerLeave={(event) => {
                                clearPressedStaff();
                                event.currentTarget.style.cursor = "";
                            }}
                            onClick={(event) => {
                                if ((event.target as Element).closest(".channel-staff")) return;
                                staffAtPoint(event.clientX, event.clientY)?.click();
                            }}
                        >
                            {pages.map((page, sheetIndex) => (
                                <ol
                                    key={sheetIndex}
                                    ref={(node) => { sheets.current[sheetIndex] = node; }}
                                    className="channel-sheet"
                                    style={{ zIndex: pages.length - sheetIndex,
                                        "--channel-key-color": musicColor(pageGradientKey(page)),
                                    } as React.CSSProperties}
                                    aria-hidden={sheetIndex !== activePage}
                                    inert={sheetIndex !== activePage}
                                >
                                    {page.map((block) => (
                                        <MessageItem
                                            key={block.key}
                                            block={block}
                                            isOwn={block.message.user_id === userId}
                                            onPlay={(selected) => {
                                                pageNavigation.current?.kill();
                                                pageNavigation.current = null;
                                                if (settleTimer.current) clearTimeout(settleTimer.current);
                                                navigation.current = null;
                                                playback.replace([messagePerformance(selected, pages[pageIndex.current] ?? [])]);
                                            }}
                                            visual={playback.visuals.find((visual) => visual.blockKeys.includes(block.key)) ?? null}
                                            loading={playback.loadingKey === block.key}
                                            error={playback.error?.key === block.key ? playback.error.text : ""}
                                        />
                                    ))}
                                </ol>
                            ))}
                            {!blocks.length && <p className="channel-empty">Aucun message.</p>}
                        </div>
                    </div>
                </div>
            </section>
            <ChannelPagination
                activePage={activePage}
                pageCount={pages.length}
                onPageSelect={goToPage}
            />
        </>
    );
}
