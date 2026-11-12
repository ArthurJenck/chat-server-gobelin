import { useRef, useState } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import KeyControl from "../app/features/key/KeyControl";
import KeyFlight from "../app/features/key/KeyFlight";

const animation = vi.hoisted(() => ({ timeline: vi.fn(), to: vi.fn(), kill: vi.fn() }));
vi.mock("gsap", () => ({ default: { timeline: animation.timeline } }));

function Fixture({
    holderId,
    active = [],
    inactive = [],
}: {
    holderId: number | null;
    active?: number[];
    inactive?: number[];
}) {
    const page = useRef<HTMLElement>(null);
    const [flyingHolderId, setFlyingHolderId] = useState<number | null>(null);
    return (
        <main ref={page} data-key-flying={flyingHolderId !== null || undefined}>
            <KeyControl state={{ holderId, holderName: holderId === null ? null : "Louis" }}
                userId={1} ready busy={false} onChange={vi.fn()} />
            <ol className="channel-sheet" aria-hidden="false">
                {active.map((top) => (
                    <li className="channel-message-author" data-user-id="2" key={top}>
                        <img className="channel-author-key" src="/pictos/key.svg" alt="" data-top={top} />
                    </li>
                ))}
            </ol>
            <ol className="channel-sheet" aria-hidden="true">
                {inactive.map((top) => (
                    <li className="channel-message-author" data-user-id="2" key={top}>
                        <img className="channel-author-key" src="/pictos/key.svg" alt="" data-top={top} />
                    </li>
                ))}
            </ol>
            <KeyFlight pageRef={page} holderId={holderId} ready onFlyingChange={setFlyingHolderId} />
        </main>
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    animation.to.mockReturnValue({ to: animation.to });
    animation.timeline.mockReturnValue({ to: animation.to, kill: animation.kill });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
        const left = this.classList.contains("channel-key-symbol") ? 300 : 100;
        const top = this.classList.contains("channel-key-symbol") ? 40 : Number(this.getAttribute("data-top"));
        const width = this.classList.contains("channel-key-symbol") ? 36 : 9;
        const height = this.classList.contains("channel-key-symbol") ? 78 : 20;
        return { left, top, width, height, right: left + width, bottom: top + height,
            x: left, y: top, toJSON: () => ({}) };
    });
});

afterEach(() => vi.restoreAllMocks());

it("does not replay the animation when a held key is loaded", () => {
    const { container } = render(<Fixture holderId={2} active={[130]} />);
    expect(container.querySelector(".channel-key-flight")).toBeNull();
    expect(animation.timeline).not.toHaveBeenCalled();
    expect(container.querySelector(".channel-key-symbol")).not.toBeVisible();
});

it("tilts clockwise, lands on the highest visible name, and removes the flying key", () => {
    const view = render(<Fixture holderId={null} active={[180, 130]} inactive={[50]} />);
    view.rerender(<Fixture holderId={2} active={[180, 130]} inactive={[50]} />);

    expect(view.container.querySelector(".channel-key-flight")).toBeInTheDocument();
    expect(view.container.querySelector("main")).toHaveAttribute("data-key-flying", "true");
    expect(animation.to).toHaveBeenCalledTimes(2);
    expect(animation.to.mock.calls[0][1]).toMatchObject({ rotation: 10 });
    expect(animation.to.mock.calls[1][1]).toMatchObject({
        x: -213.5, y: 31.5, scale: 0.25, rotation: 0,
    });

    act(() => animation.timeline.mock.calls[0][0].onComplete());
    expect(view.container.querySelector(".channel-key-flight")).toBeNull();
    expect(view.container.querySelector("main")).not.toHaveAttribute("data-key-flying");
    expect(view.container.querySelectorAll(".channel-author-key")).toHaveLength(3);
});

it("continues off the left edge when the holder has no message, then shows a later message", () => {
    const view = render(<Fixture holderId={null} />);
    view.rerender(<Fixture holderId={2} />);

    expect(view.container.querySelector(".channel-key-flight")).toBeInTheDocument();
    expect(animation.to.mock.calls[1][1]).toMatchObject({ x: -369.5, rotation: 0 });
    act(() => animation.timeline.mock.calls[0][0].onComplete());
    expect(view.container.querySelector(".channel-key-flight")).toBeNull();

    view.rerender(<Fixture holderId={2} active={[130]} />);
    expect(view.container.querySelector(".channel-sheet[aria-hidden='false'] .channel-author-key"))
        .toBeInTheDocument();
    expect(animation.timeline).toHaveBeenCalledOnce();
});

it("ignores holder messages on an inactive page", () => {
    const view = render(<Fixture holderId={null} inactive={[50]} />);
    view.rerender(<Fixture holderId={2} inactive={[50]} />);

    expect(animation.to.mock.calls[1][1]).toMatchObject({ x: -369.5, rotation: 0 });
    expect(view.container.querySelector(".channel-key-flight")).toBeInTheDocument();
});
