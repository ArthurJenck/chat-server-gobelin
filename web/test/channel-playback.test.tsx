import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ChannelAudioEngine } from "../app/features/sound/channelAudioEngine";
import { DEFAULT_SOUND_SETTINGS } from "../app/features/sound/soundConfig";
import type { SoundPlan } from "../app/features/sound/soundPlan";
import type { ChannelPerformance } from "../app/features/chat/channelScore";
import { useChannelPlayback } from "../app/features/chat/useChannelPlayback";

function performance(id: string, manual = false): ChannelPerformance {
    return {
        id,
        blockKeys: [id],
        plan: { events: [{ text: id, wordId: 0, start: 0, midi: 60 }], tonicMidi: 60, density: 1 },
        settings: DEFAULT_SOUND_SETTINGS,
        eventStarts: { 0: 0 },
        manual,
    };
}

function engine(play: ReturnType<typeof vi.fn>) {
    return { play, preload: vi.fn(), dispose: vi.fn() } as unknown as ChannelAudioEngine;
}

it("queues incoming messages after the current performance", async () => {
    const finishes: Array<() => void> = [];
    const ends: Array<() => void> = [];
    const play = vi.fn(async (
        _plan: unknown, _settings: unknown, onFinished: () => void,
        _signal: AbortSignal, onScheduled?: (getPlayhead: () => number | null) => void,
        _maxNoteDuration?: number, onEnded?: () => void,
    ) => {
        finishes.push(onFinished);
        if (onEnded) ends.push(onEnded);
        onScheduled?.(() => null);
        return vi.fn();
    });
    const sound = engine(play);
    const { result } = renderHook(() => useChannelPlayback(sound));

    act(() => result.current.replace([performance("first"), performance("second")]));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    act(() => result.current.append([performance("third")]));
    expect(play).toHaveBeenCalledTimes(1);

    act(() => finishes[0]());
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    expect(result.current.visuals.map((visual) => visual.blockKeys[0])).toEqual(["first", "second"]);
    act(() => ends[0]());
    expect(result.current.visuals.map((visual) => visual.blockKeys[0])).toEqual(["second"]);
    act(() => finishes[1]());
    await waitFor(() => expect(play).toHaveBeenCalledTimes(3));
    expect(play.mock.calls.map((call) => (call[0] as SoundPlan).events[0].text))
        .toEqual(["first", "second", "third"]);
});

it("prepares the page instruments before starting its uninterrupted sequence", async () => {
    let ready = () => {};
    const prepare = vi.fn(() => new Promise<void>((resolve) => { ready = resolve; }));
    const play = vi.fn(async () => vi.fn());
    const sound = { ...engine(play), prepare };
    const guitar = { ...performance("guitar"), settings: { ...DEFAULT_SOUND_SETTINGS, instrument: "guitar" as const } };
    const { result } = renderHook(() => useChannelPlayback(sound));

    act(() => result.current.replace([performance("piano"), guitar]));
    expect(prepare).toHaveBeenCalledWith(["piano", "guitar"]);
    expect(play).not.toHaveBeenCalled();
    await act(async () => { ready(); });
    expect(play).toHaveBeenCalledTimes(1);
});

it("starts a replacement immediately and discards an abandoned loading result", async () => {
    let release = (_stop: () => void) => {};
    const oldStop = vi.fn();
    const play = vi.fn()
        .mockImplementationOnce(() => new Promise<() => void>((resolve) => { release = resolve; }))
        .mockImplementationOnce(async () => vi.fn());
    const sound = engine(play);
    const { result } = renderHook(() => useChannelPlayback(sound));

    act(() => result.current.replace([performance("old")]));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    const signal = play.mock.calls[0][3] as AbortSignal;
    act(() => result.current.replace([performance("new")]));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    expect(signal.aborted).toBe(true);
    await act(async () => { release(oldStop); });
    expect(oldStop).toHaveBeenCalledOnce();
});

it("exposes the playhead for animation and hides automatic playback errors", async () => {
    const play = vi.fn()
        .mockImplementationOnce(async (
            _plan: unknown, _settings: unknown, _finished: () => void,
            _signal: AbortSignal, onScheduled: (getPlayhead: () => number | null) => void,
        ) => {
            onScheduled(() => 0.25);
            return vi.fn();
        })
        .mockRejectedValue(new Error("Audio bloqué"));
    const sound = engine(play);
    const { result } = renderHook(() => useChannelPlayback(sound));

    act(() => result.current.replace([performance("visible")]));
    await waitFor(() => expect(result.current.visual?.getPlayhead()).toBe(0.25));
    expect(result.current.visual?.blockKeys).toEqual(["visible"]);
    act(() => result.current.replace([performance("auto")]));
    await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
    expect(result.current.error).toBeNull();
    act(() => result.current.replace([performance("manual", true)]));
    await waitFor(() => expect(result.current.error?.text).toBe("Audio bloqué"));
});
