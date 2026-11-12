import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import gsap from "gsap";

type Position = Pick<DOMRect, "left" | "top" | "width" | "height">;
type Flight = { start: Position; end: Position | null };

export default function KeyFlight({
    pageRef,
    holderId,
    ready,
    onFlyingChange,
}: {
    pageRef: RefObject<HTMLElement | null>;
    holderId: number | null;
    ready: boolean;
    onFlyingChange: (holderId: number | null) => void;
}) {
    const previous = useRef({ ready: false, holderId: null as number | null });
    const image = useRef<HTMLImageElement>(null);
    const [flight, setFlight] = useState<Flight | null>(null);

    useLayoutEffect(() => {
        const was = previous.current;
        previous.current = { ready, holderId };
        if (!was.ready || was.holderId !== null || !ready || holderId === null ||
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            setFlight(null);
            onFlyingChange(null);
            return;
        }

        const page = pageRef.current;
        const source = page?.querySelector<HTMLImageElement>(".channel-key-symbol");
        if (!page || !source) return;
        const start = source.getBoundingClientRect();
        if (!start.width || !start.height) return;
        const targets = page.querySelectorAll<HTMLImageElement>(
            `.channel-sheet[aria-hidden="false"] .channel-message-author[data-user-id="${holderId}"] .channel-author-key`,
        );
        const end = [...targets].map((target) => target.getBoundingClientRect())
            .sort((a, b) => a.top - b.top)[0] ?? null;
        setFlight({ start, end });
        onFlyingChange(holderId);
    }, [holderId, ready, pageRef, onFlyingChange]);

    useLayoutEffect(() => {
        const node = image.current;
        if (!flight || !node) return;
        const { start, end } = flight;
        const scale = end ? end.width / start.width : 0.25;
        const left = end?.left ?? -start.width - 20;
        const top = end?.top ?? start.top + 80;
        const x = left - start.left - (1 - scale) * start.width / 2;
        const y = top - start.top - (1 - scale) * start.height;
        const timeline = gsap.timeline({
            onComplete: () => {
                setFlight(null);
                onFlyingChange(null);
            },
        });
        timeline.to(node, {
            x: x * 0.28,
            y: y * 0.28,
            scale: 1 - (1 - scale) * 0.28,
            rotation: 10,
            duration: 0.22,
            ease: "power1.in",
        }).to(node, {
            x,
            y,
            scale,
            rotation: 0,
            duration: 0.58,
            ease: "power2.out",
        });
        return () => { timeline.kill(); };
    }, [flight, onFlyingChange]);

    useEffect(() => () => onFlyingChange(null), [onFlyingChange]);

    if (!flight) return null;
    return <img ref={image} className="channel-key-flight" src="/pictos/key.svg" alt=""
        aria-hidden="true" style={{ left: flight.start.left, top: flight.start.top,
            width: flight.start.width, height: flight.start.height }} />;
}
