import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import MessageItem from "../../features/chat/MessageItem";
import { buildChannelStaffs, paginateChannelStaffs } from "../../features/chat/channelPagination";
import type { Message } from "../../features/messages/types";

export default function ChannelPages({
    messages,
    userId,
}: {
    messages: Message[];
    userId: number | null;
}) {
    const scroller = useRef<HTMLElement>(null);
    const sheets = useRef<(HTMLOListElement | null)[]>([]);
    const pageIndex = useRef(0);
    const [size, setSize] = useState({ width: 360, height: 600 });
    const [activePage, setActivePage] = useState(0);
    const blocks = useMemo(() => buildChannelStaffs(messages, size.width), [messages, size.width]);
    const pages = useMemo(() => paginateChannelStaffs(blocks, size.height), [blocks, size.height]);

    useEffect(() => {
        setActivePage((current) => Math.min(current, pages.length - 1));
    }, [pages.length]);

    useLayoutEffect(() => {
        const element = scroller.current;
        if (!element) return;
        const update = () => {
            const width = Math.max(1, (element.clientWidth || 400) - 40);
            const height = Math.max(1, (element.clientHeight || 650) - 50);
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
            element.scrollLeft = Math.max(0, Math.min(
                (pages.length - 1) * element.clientWidth,
                element.scrollLeft - event.deltaY,
            ));
        };
        element.addEventListener("wheel", wheel, { passive: false });
        return () => element.removeEventListener("wheel", wheel);
    }, [pages.length]);

    return (
        <section
            ref={scroller}
            className="channel-messages"
            aria-label="Messages"
            onScroll={(event) => {
                const current = Math.min(
                    pages.length - 1,
                    Math.max(0, Math.round(
                        pages.length - 1 - event.currentTarget.scrollLeft / (event.currentTarget.clientWidth || 1),
                    )),
                );
                pageIndex.current = current;
                setActivePage(current);
            }}
        >
            <div className="channel-page-track" style={{ width: `${pages.length * 100}%` }}>
                <div className="channel-page-stage" style={{ width: `${100 / pages.length}%` }}>
                    {pages.map((page, pageIndex) => (
                        <ol
                            key={page.map((block) => block.key).join("|") || "empty"}
                            ref={(node) => { sheets.current[pageIndex] = node; }}
                            className="channel-sheet"
                            style={{ zIndex: pages.length - pageIndex }}
                            aria-hidden={pageIndex !== activePage}
                            inert={pageIndex !== activePage}
                        >
                            {page.map((block) => (
                                <MessageItem
                                    key={block.key}
                                    block={block}
                                    isOwn={block.message.user_id === userId}
                                />
                            ))}
                        </ol>
                    ))}
                    {!blocks.length && <p className="channel-empty">Aucun message.</p>}
                </div>
            </div>
        </section>
    );
}
