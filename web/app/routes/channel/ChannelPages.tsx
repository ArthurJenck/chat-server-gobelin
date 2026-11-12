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

export default function ChannelPages({
    messages,
    userId,
    audio,
    preloadEnabled,
    onKeyChange,
    onVisibleMessagesChange,
}: {
    messages: Message[];
    userId: number | null;
    audio: ChannelAudioEngine;
    preloadEnabled: boolean;
    onKeyChange: (key: MusicKey) => void;
    onVisibleMessagesChange: (messages: Message[]) => void;
}) {
    const container = useRef<HTMLElement>(null);
    const scroller = useRef<HTMLDivElement>(null);
    const sheets = useRef<(HTMLOListElement | null)[]>([]);
    const pageIndex = useRef(0);
    const pageNavigation = useRef<gsap.core.Tween | null>(null);
    const [size, setSize] = useState({ width: 360, height: 600 });
    const [activePage, setActivePage] = useState(0);
    const blocks = useMemo(() => buildChannelStaffs(messages, size.width), [messages, size.width]);
    const pages = useMemo(() => applyPageMusicKeys(
        paginateChannelStaffs(blocks, size.height), size.width,
    ), [blocks, size.height, size.width]);
    const firstVisiblePage = Math.max(0, Math.min(activePage - 2, pages.length - 5));

    const syncActivePage = (scrollLeft: number, width: number) => {
        const current = Math.min(
            pages.length - 1,
            Math.max(0, Math.round(pages.length - 1 - scrollLeft / (width || 1))),
        );
        if (pageIndex.current !== current) {
            pageIndex.current = current;
            setActivePage(current);
        }
    };

    const goToPage = (target: number) => {
        const element = scroller.current;
        if (!element) return;
        pageNavigation.current?.kill();
        const scrollLeft = (pages.length - 1 - target) * element.clientWidth;
        if (Math.abs(element.scrollLeft - scrollLeft) < 1) return;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            element.scrollLeft = scrollLeft;
            syncActivePage(scrollLeft, element.clientWidth);
            return;
        }
        pageNavigation.current = gsap.to(element, {
            scrollLeft,
            duration: Math.max(0.2, Math.abs(scrollLeft - element.scrollLeft) / Math.max(1, element.clientWidth) * 0.4),
            ease: "none",
            onUpdate: () => syncActivePage(element.scrollLeft, element.clientWidth),
            onComplete: () => { pageNavigation.current = null; },
        });
    };

    useEffect(() => () => { pageNavigation.current?.kill(); }, []);

    useEffect(() => {
        if (!preloadEnabled) return;
        const visible = new Set<Instrument>();
        for (const block of pages[activePage] ?? []) {
            if (block.plan.events.some((event) => event.midi !== null))
                visible.add(messageInstrument(block.message));
        }
        audio.preload([...visible]);
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
            const page = element.closest(".channel-page");
            if (page) {
                element.style.setProperty("--channel-messages-top", `${element.getBoundingClientRect().top - page.getBoundingClientRect().top}px`);
                element.style.setProperty("--channel-messages-height", `${element.clientHeight}px`);
            }
            setSize((current) => current.width === width && current.height === height
                ? current
                : { width, height });
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
    }, [pages.length, size.width]);

    useLayoutEffect(() => {
        const element = scroller.current;
        if (!element || typeof window.matchMedia !== "function") return;
        gsap.registerPlugin(ScrollTrigger);
        const animations: gsap.core.Tween[] = [];
        sheets.current.slice(0, pages.length).forEach((sheet, index) => {
            if (!sheet) return;
            gsap.set(sheet, { rotateY: 0, z: index === 0 ? 13 : -index });
            if (index === pages.length - 1) return;
            animations.push(gsap.fromTo(sheet, {
                rotateY: 180 - index / 2,
            }, {
                rotateY: 0,
                scrollTrigger: {
                    scroller: element,
                    horizontal: true,
                    scrub: true,
                    start: () => (pages.length - 2 - index) * element.clientWidth,
                    end: () => (pages.length - 1 - index) * element.clientWidth,
                },
            }));
            animations.push(gsap.fromTo(sheet, {
                z: index === 0 ? -13 : index,
            }, {
                z: index === 0 ? 13 : -index,
                scrollTrigger: {
                    scroller: element,
                    horizontal: true,
                    scrub: true,
                    start: () => (pages.length - 1.5 - index) * element.clientWidth,
                    end: () => (pages.length - 1 - index) * element.clientWidth,
                },
            }));
        });
        const snap = pages.length > 1 ? ScrollTrigger.create({
            scroller: element,
            horizontal: true,
            start: 0,
            end: () => (pages.length - 1) * element.clientWidth,
            snap: {
                snapTo: 1 / (pages.length - 1),
                directional: false,
                inertia: false,
                delay: 0,
                duration: { min: 0.15, max: 0.3 },
                ease: "power2.out",
            },
        }) : null;
        ScrollTrigger.refresh();
        return () => {
            snap?.kill();
            animations.forEach((animation) => {
                animation.scrollTrigger?.kill();
                animation.kill();
            });
        };
    }, [pages]);

    useEffect(() => {
        const element = scroller.current;
        if (!element) return;
        const wheel = (event: WheelEvent) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || pages.length < 2) return;
            event.preventDefault();
            pageNavigation.current?.kill();
            pageNavigation.current = null;
            element.scrollLeft = Math.max(0, Math.min(
                (pages.length - 1) * element.clientWidth,
                element.scrollLeft - event.deltaY,
            ));
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
                        syncActivePage(event.currentTarget.scrollLeft, event.currentTarget.clientWidth);
                    }}
                >
                    <div className="channel-page-track" style={{ width: `${pages.length * 100}%` }}>
                        <div className="channel-page-stage" style={{ width: `${100 / pages.length}%` }}>
                            {pages.map((page, pageIndex) => (
                                <ol
                                    key={page.map((block) => block.key).join("|") || "empty"}
                                    ref={(node) => { sheets.current[pageIndex] = node; }}
                                    className="channel-sheet"
                                    style={{ zIndex: pages.length - pageIndex,
                                        "--channel-key-color": musicColor(pageGradientKey(page)),
                                    } as React.CSSProperties}
                                    aria-hidden={pageIndex !== activePage}
                                    inert={pageIndex !== activePage}
                                >
                                    {page.map((block) => (
                                        <MessageItem
                                            key={block.key}
                                            block={block}
                                            isOwn={block.message.user_id === userId}
                                            audio={audio}
                                        />
                                    ))}
                                </ol>
                            ))}
                            {!blocks.length && <p className="channel-empty">Aucun message.</p>}
                        </div>
                    </div>
                </div>
            </section>
            {pages.length > 1 && (
                <nav className="channel-pagination" aria-label="Pages des messages">
                    {pages.slice(firstVisiblePage, firstVisiblePage + 5).map((_, index) => {
                        const targetPage = firstVisiblePage + index;
                        return (
                            <button
                                key={targetPage}
                                type="button"
                                className="channel-page-dot"
                                aria-label={`Aller à la page ${targetPage + 1} sur ${pages.length}`}
                                aria-current={targetPage === activePage ? "page" : undefined}
                                onClick={() => goToPage(targetPage)}
                            />
                        );
                    })}
                </nav>
            )}
        </>
    );
}
