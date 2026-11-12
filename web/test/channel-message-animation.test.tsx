import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildChannelStaffs } from "../app/features/chat/channelPagination";
import type { ChannelVisual } from "../app/features/chat/useChannelPlayback";
import MessageItem from "../app/features/chat/MessageItem";
import { DEFAULT_SOUND_SETTINGS } from "../app/features/sound/soundConfig";

const animation = vi.hoisted(() => ({
    timeline: vi.fn(),
    fromTo: vi.fn(),
    time: vi.fn(),
    duration: vi.fn(),
    kill: vi.fn(),
    set: vi.fn(),
}));

vi.mock("gsap", () => ({ default: { timeline: animation.timeline, set: animation.set } }));

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    animation.duration.mockReturnValue(1);
    animation.timeline.mockReturnValue({
        fromTo: animation.fromTo,
        time: animation.time,
        duration: animation.duration,
        kill: animation.kill,
    });
});

afterEach(() => vi.unstubAllGlobals());

it("reveals channel syllables at their audio onset and leaves them visible afterward", () => {
    const block = buildChannelStaffs([{
        id: 1, content: "Bonjour", user_id: 2, user: "Alice",
        creation_date: "2026-11-11T10:00:00Z",
    }], 360)[0];
    const visual: ChannelVisual = {
        token: 1,
        blockKeys: [block.key],
        eventStarts: Object.fromEntries(block.row.map((group) => [group.eventIndex, block.plan.events[group.eventIndex].start])),
        getPlayhead: () => 0.3,
        settings: DEFAULT_SOUND_SETTINGS,
    };
    const view = render(<MessageItem block={block} isOwn={false} onPlay={vi.fn()}
        visual={visual} loading={false} error="" />);

    expect(animation.fromTo).toHaveBeenCalledTimes(block.row.length);
    expect(animation.fromTo.mock.calls.map((call) => call[3]))
        .toEqual(block.row.map((group) => visual.eventStarts[group.eventIndex]));
    expect(animation.fromTo.mock.calls[0][1]).toEqual({ y: -DEFAULT_SOUND_SETTINGS.visualRise, opacity: 0 });
    expect(animation.time).toHaveBeenCalledWith(0.3);

    view.rerender(<MessageItem block={block} isOwn={false} onPlay={vi.fn()}
        visual={null} loading={false} error="" />);
    expect(animation.kill).toHaveBeenCalledOnce();
    expect(animation.set).toHaveBeenLastCalledWith(expect.any(Array), { y: 0, opacity: 1 });
});
