import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ChannelPages from "../app/routes/channel/ChannelPages";
import type { Message } from "../app/features/messages/types";
import type { ChannelAudioEngine } from "../app/features/sound/channelAudioEngine";
import type { SoundPlan } from "../app/features/sound/soundPlan";

function message(id: number): Message {
    return {
        id, content: `Message ${id}`, user_id: 2, user: "Alice",
        creation_date: `2026-11-11T10:${String(id).padStart(2, "0")}:00Z`,
    };
}

const onKeyChange = vi.fn();
const onVisibleMessagesChange = vi.fn();
const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");

beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get() { return this.classList.contains("channel-messages") || this.classList.contains("channel-messages-scroller") ? 360 : 0; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
        configurable: true,
        get() { return this.classList.contains("channel-messages") ? 110 : 0; },
    });
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});

afterEach(() => {
    if (originalWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalWidth);
    if (originalHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", originalHeight);
    vi.unstubAllGlobals();
});

function audio() {
    const finishes: Array<() => void> = [];
    const play = vi.fn(async (
        _plan: SoundPlan, _settings: unknown, onFinished: () => void,
        _signal: AbortSignal, onScheduled?: (getPlayhead: () => number | null) => void,
    ) => {
        finishes.push(onFinished);
        onScheduled?.(() => null);
        return vi.fn();
    });
    return { engine: { play, preload: vi.fn(), dispose: vi.fn() } as unknown as ChannelAudioEngine, play, finishes };
}

it("plays the recent page on entry and queues new polling messages without replaying old ones", async () => {
    const sound = audio();
    const view = render(<ChannelPages messages={[message(1)]} userId={1} audio={sound.engine}
        preloadEnabled arrival={null} onKeyChange={onKeyChange}
        onVisibleMessagesChange={onVisibleMessagesChange} />);
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(1));

    view.rerender(<ChannelPages messages={[message(1), message(2)]} userId={1} audio={sound.engine}
        preloadEnabled arrival={{ sequence: 1, source: "poll", ids: ["2"] }}
        onKeyChange={onKeyChange} onVisibleMessagesChange={onVisibleMessagesChange} />);
    expect(sound.play).toHaveBeenCalledTimes(1);
    act(() => sound.finishes[0]());
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(2));
    expect((sound.play.mock.calls[1][0] as SoundPlan).events.map((event) => event.text).join(""))
        .toContain("Message2");
});

it("keeps an old page visible when polling adds a recent message", async () => {
    const sound = audio();
    const view = render(<ChannelPages messages={[message(1), message(2)]} userId={1} audio={sound.engine}
        preloadEnabled arrival={null} onKeyChange={onKeyChange}
        onVisibleMessagesChange={onVisibleMessagesChange} />);
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Aller à la page 1 sur 2" }));
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(2));

    view.rerender(<ChannelPages messages={[message(1), message(2), message(3)]} userId={1} audio={sound.engine}
        preloadEnabled arrival={{ sequence: 1, source: "poll", ids: ["3"] }}
        onKeyChange={onKeyChange} onVisibleMessagesChange={onVisibleMessagesChange} />);
    expect(screen.getByRole("button", { name: "Aller à la page 2 sur 3" }))
        .toHaveAttribute("aria-current", "page");
    expect(sound.play).toHaveBeenCalledTimes(2);
});

it("returns to the recent page and plays only the sent message", async () => {
    const sound = audio();
    const view = render(<ChannelPages messages={[message(1), message(2)]} userId={1} audio={sound.engine}
        preloadEnabled arrival={null} onKeyChange={onKeyChange}
        onVisibleMessagesChange={onVisibleMessagesChange} />);
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Aller à la page 1 sur 2" }));
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(2));
    const previousSignal = sound.play.mock.calls[1][3] as AbortSignal;

    view.rerender(<ChannelPages messages={[message(1), message(2), message(3)]} userId={1} audio={sound.engine}
        preloadEnabled arrival={{ sequence: 1, source: "sent", ids: ["3"] }}
        onKeyChange={onKeyChange} onVisibleMessagesChange={onVisibleMessagesChange} />);
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(3));
    expect(previousSignal.aborted).toBe(true);
    expect((sound.play.mock.calls[2][0] as SoundPlan).events.map((event) => event.text).join(""))
        .toContain("Message3");
    expect(screen.getByRole("button", { name: "Aller à la page 3 sur 3" }))
        .toHaveAttribute("aria-current", "page");
});

it("plays a descending piano glissando on a three-page jump, then the destination score", async () => {
    const sound = audio();
    render(<ChannelPages messages={[1, 2, 3, 4, 5].map(message)} userId={1} audio={sound.engine}
        preloadEnabled arrival={null} onKeyChange={onKeyChange}
        onVisibleMessagesChange={onVisibleMessagesChange} />);
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("button", { name: "Aller à la page 2 sur 5" }));
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(2));
    const glissando = sound.play.mock.calls[1][0] as SoundPlan;
    expect(glissando.events[0].midi).toBe(84);
    expect(glissando.events.at(-1)?.midi).toBe(60);
    expect(sound.play).toHaveBeenCalledTimes(2);
    act(() => sound.finishes[1]());
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(3));
    expect((sound.play.mock.calls[2][0] as SoundPlan).events.map((event) => event.text).join(""))
        .toContain("Message2");

    await userEvent.click(screen.getByRole("button", { name: "Aller à la page 5 sur 5" }));
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(4));
    const returnGlissando = sound.play.mock.calls[3][0] as SoundPlan;
    expect(returnGlissando.events[0].midi).toBe(60);
    expect(returnGlissando.events.at(-1)?.midi).toBe(84);
    act(() => sound.finishes[3]());
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(5));
    expect((sound.play.mock.calls[4][0] as SoundPlan).events.map((event) => event.text).join(""))
        .toContain("Message5");
});

it("restarts a glissando after each three-page movement, including reversals", async () => {
    const sound = audio();
    render(<ChannelPages messages={[1, 2, 3, 4, 5, 6, 7].map(message)} userId={1} audio={sound.engine}
        preloadEnabled arrival={null} onKeyChange={onKeyChange}
        onVisibleMessagesChange={onVisibleMessagesChange} />);
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(1));
    const scroller = screen.getByRole("region", { name: "Messages" });

    fireEvent.wheel(scroller, { deltaY: 1080 });
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(2));
    expect((sound.play.mock.calls[1][0] as SoundPlan).events[0].midi).toBe(84);
    const firstSignal = sound.play.mock.calls[1][3] as AbortSignal;

    fireEvent.wheel(scroller, { deltaY: 1080 });
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(3));
    expect(firstSignal.aborted).toBe(true);
    expect((sound.play.mock.calls[2][0] as SoundPlan).events[0].midi).toBe(84);
    const secondSignal = sound.play.mock.calls[2][3] as AbortSignal;

    fireEvent.wheel(scroller, { deltaY: -1080 });
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(4));
    expect(secondSignal.aborted).toBe(true);
    expect((sound.play.mock.calls[3][0] as SoundPlan).events[0].midi).toBe(60);
});

it("starts the glissando during an animated turn and waits to play the destination", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const sound = audio();
    render(<ChannelPages messages={[1, 2, 3, 4].map(message)} userId={1} audio={sound.engine}
        preloadEnabled arrival={null} onKeyChange={onKeyChange}
        onVisibleMessagesChange={onVisibleMessagesChange} />);
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Aller à la page 1 sur 4" }));
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(2));
    expect((sound.play.mock.calls[1][0] as SoundPlan).events[0].midi).toBe(84);
    expect(sound.play).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByRole("button", { name: "Aller à la page 1 sur 4" }))
        .toHaveAttribute("aria-current", "page"), { timeout: 2500 });
    expect(sound.play).toHaveBeenCalledTimes(2);

    act(() => sound.finishes[1]());
    await waitFor(() => expect(sound.play).toHaveBeenCalledTimes(3));
    expect((sound.play.mock.calls[2][0] as SoundPlan).events.map((event) => event.text).join(""))
        .toContain("Message1");
});
