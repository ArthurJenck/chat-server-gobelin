import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_SOUND_SETTINGS } from "../app/sound/soundConfig";
import type { SoundPlan } from "../app/sound/soundPlan";
import SoundStaff from "../app/sound/visual/SoundStaff";

const animation = vi.hoisted(() => ({
    fromTo: vi.fn(),
    time: vi.fn(),
    duration: vi.fn(),
    kill: vi.fn(),
    timeline: vi.fn(),
}));
vi.mock("gsap", () => ({ default: { timeline: animation.timeline } }));

let frame: FrameRequestCallback | undefined;

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn((callback: FrameRequestCallback) => {
            frame = callback;
            return 1;
        }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    animation.duration.mockReturnValue(1.1);
    animation.timeline.mockReturnValue({
        fromTo: animation.fromTo,
        time: animation.time,
        duration: animation.duration,
        kill: animation.kill,
    });
});

afterEach(() => vi.unstubAllGlobals());

it("animates each planned group from above at its note onset and kills the timeline on stop", () => {
    let playhead = -0.04;
    const plan: SoundPlan = {
        tonicMidi: 60,
        density: 2,
        events: [
            { text: "La", wordId: 0, start: 0, midi: 60 },
            { text: "lune", wordId: 1, start: 0.5, midi: 64 },
        ],
    };
    const view = render(
        <SoundStaff
            plan={plan}
            settings={DEFAULT_SOUND_SETTINGS}
            getPlayhead={() => playhead}
        />,
    );

    expect(animation.timeline).toHaveBeenCalledWith({ paused: true });
    expect(animation.fromTo).toHaveBeenCalledTimes(2);
    expect(animation.fromTo.mock.calls.map((call) => call[3])).toEqual([
        0, 0.5,
    ]);
    expect(animation.fromTo.mock.calls[0][1]).toEqual({
        y: -DEFAULT_SOUND_SETTINGS.visualRise,
        opacity: 0,
    });
    expect(animation.fromTo.mock.calls[0][2]).toEqual(
        expect.objectContaining({
            opacity: 1,
            ease: DEFAULT_SOUND_SETTINGS.visualEase,
        }),
    );
    expect(animation.time).toHaveBeenCalledWith(0);
    playhead = 0.5;
    frame?.(0);
    expect(animation.time).toHaveBeenCalledWith(0.5);
    view.unmount();
    expect(animation.kill).toHaveBeenCalledOnce();
});

it("delays the visual timeline without changing note times", () => {
    const plan: SoundPlan = {
        tonicMidi: 60,
        density: 1,
        events: [{ text: "La", wordId: 0, start: 0.4, midi: 60 }],
    };
    const view = render(
        <SoundStaff
            plan={plan}
            settings={{ ...DEFAULT_SOUND_SETTINGS, visualDelayMs: 60 }}
            getPlayhead={() => 0.46}
        />,
    );

    expect(animation.time).toHaveBeenCalledWith(0.4);
    expect(animation.fromTo.mock.calls[0][3]).toBe(0.4);
    view.unmount();
});
