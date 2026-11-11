import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startPlayback } from "../app/features/sound/audioEngine";
import {
    DEFAULT_SOUND_SETTINGS,
    type Instrument,
} from "../app/features/sound/soundConfig";
import type { SoundPlan } from "../app/features/sound/soundPlan";

const sampler = vi.hoisted(() => ({
    create: vi.fn(),
    cache: vi.fn(() => ({ kind: "cache" })),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
}));

vi.mock("smplr", () => ({
    Soundfont: sampler.create,
    CacheStorage: sampler.cache,
}));

const close = vi.fn(async () => {});
const connect = vi.fn();

class AudioContextStub {
    currentTime = 0;
    destination = {};
    running = true;
    resume = vi.fn(async () => {
        this.running = true;
    });
    suspend = vi.fn(async () => {
        this.running = false;
    });
    close = close;
    createGain() {
        return {
            gain: {
                value: 0,
                cancelScheduledValues: vi.fn(),
                setValueAtTime: vi.fn(),
            },
            connect,
        };
    }
    createBiquadFilter() {
        return {
            type: "lowpass",
            frequency: { value: 0 },
            Q: { value: 0 },
            connect,
        };
    }
    createDelay() {
        return { delayTime: { value: 0 }, connect };
    }
}

const plan: SoundPlan = {
    events: [
        { text: "a", wordId: 0, start: 0, midi: 57 },
        { text: "b", wordId: 0, start: 0.2, midi: null },
        { text: "c", wordId: 0, start: 0.4, midi: 60 },
        { text: "d", wordId: 0, start: 0.6, midi: 57 },
    ],
    tonicMidi: 57,
    density: 4,
};

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("AudioContext", AudioContextStub);
    vi.stubGlobal("caches", {});
    sampler.create.mockReturnValue({
        ready: Promise.resolve(),
        start: sampler.start,
        stop: sampler.stop,
        dispose: sampler.dispose,
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    sampler.start.mockReset();
});

it.each([
    ["piano", "acoustic_grand_piano"],
    ["guitar", "acoustic_guitar_nylon"],
    ["trumpet", "trumpet"],
    ["electric_guitar", "electric_guitar_clean"],
] as const)(
    "loads %s soundfont samples for the planned notes",
    async (instrument: Instrument, name: string) => {
        const stop = await startPlayback(
            plan,
            { ...DEFAULT_SOUND_SETTINGS, instrument },
            vi.fn(),
        );

        expect(sampler.create).toHaveBeenCalledWith(
            expect.any(AudioContextStub),
            expect.objectContaining({
                instrument: name,
                kit: "MusyngKite",
                notesToLoad: { notes: [57, 60] },
                storage: { kind: "cache" },
            }),
        );
        expect(sampler.start).toHaveBeenCalledTimes(3);
        expect(sampler.start).toHaveBeenCalledWith(
            expect.objectContaining({
                note: 60,
                time: expect.any(Number),
                duration: expect.any(Number),
            }),
        );
        stop();
    },
);

it("stops and disposes the sampler when playback finishes", async () => {
    const finished = vi.fn();
    await startPlayback(plan, DEFAULT_SOUND_SETTINGS, finished);

    await vi.runAllTimersAsync();

    expect(sampler.stop).toHaveBeenCalledOnce();
    expect(sampler.dispose).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(finished).toHaveBeenCalledOnce();
});

it("does not sustain a note through a pause between words", async () => {
    const words: SoundPlan = {
        tonicMidi: 60,
        density: 2,
        events: [
            { text: "la", wordId: 0, start: 0, midi: 60 },
            { text: "lune", wordId: 1, start: 0.36, midi: 62 },
        ],
    };
    const stop = await startPlayback(
        words,
        { ...DEFAULT_SOUND_SETTINGS, intervalMs: 240, wordGap: 120, gate: 0.5 },
        vi.fn(),
    );

    expect(sampler.start.mock.calls[0][0].duration).toBeCloseTo(0.12);
    stop();
});

it("provides the audio playhead after the notes are queued", async () => {
    const scheduled = vi.fn();
    const stop = await startPlayback(
        plan,
        DEFAULT_SOUND_SETTINGS,
        vi.fn(),
        scheduled,
    );

    expect(sampler.start).toHaveBeenCalledTimes(3);
    expect(scheduled).toHaveBeenCalledOnce();
    expect(scheduled.mock.calls[0][0]()).toBeCloseTo(-0.04);
    stop();
    expect(scheduled.mock.calls[0][0]()).toBeNull();
});

it("holds the audio clock while scheduling every note", async () => {
    sampler.start.mockImplementation(() => {
        const context = sampler.create.mock.calls[0][0] as AudioContextStub;
        if (context.running) context.currentTime += 0.03;
    });
    const stop = await startPlayback(plan, DEFAULT_SOUND_SETTINGS, vi.fn());
    const context = sampler.create.mock.calls[0][0] as AudioContextStub;

    expect(context.suspend).toHaveBeenCalledOnce();
    expect(context.resume).toHaveBeenCalledTimes(2);
    expect(context.currentTime).toBe(0);
    expect(sampler.start.mock.calls[0][0].time).toBeGreaterThan(
        context.currentTime,
    );
    stop();
});

it("tracks the audio output position as it advances", async () => {
    let outputTime = 0;
    vi.stubGlobal(
        "AudioContext",
        class extends AudioContextStub {
            getOutputTimestamp() {
                return { contextTime: outputTime, performanceTime: 1000 };
            }
        },
    );
    const scheduled = vi.fn();
    const stop = await startPlayback(
        plan,
        DEFAULT_SOUND_SETTINGS,
        vi.fn(),
        scheduled,
    );
    const getPlayhead = scheduled.mock.calls[0][0] as () => number | null;

    expect(getPlayhead()).toBeCloseTo(-0.04);
    outputTime = 0.3;
    expect(getPlayhead()).toBeCloseTo(0.26);
    stop();
});

it("uses reported output latency when output timestamps are unavailable", async () => {
    vi.stubGlobal(
        "AudioContext",
        class extends AudioContextStub {
            baseLatency = 0.02;
            outputLatency = 0.08;
        },
    );
    const scheduled = vi.fn();
    const stop = await startPlayback(
        plan,
        DEFAULT_SOUND_SETTINGS,
        vi.fn(),
        scheduled,
    );
    const context = sampler.create.mock.calls[0][0] as AudioContextStub;
    const getPlayhead = scheduled.mock.calls[0][0] as () => number | null;

    context.currentTime = 0.5;
    expect(getPlayhead()).toBeCloseTo(0.36);
    stop();
});

it("releases audio resources if soundfont loading fails", async () => {
    sampler.create.mockReturnValue({
        ready: Promise.reject(new Error("network")),
        start: sampler.start,
        stop: sampler.stop,
        dispose: sampler.dispose,
    });

    await expect(
        startPlayback(plan, DEFAULT_SOUND_SETTINGS, vi.fn()),
    ).rejects.toThrow("Chargement des sons impossible.");
    expect(sampler.dispose).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
});
