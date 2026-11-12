import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createChannelAudioEngine } from "../app/features/sound/channelAudioEngine";
import { DEFAULT_SOUND_SETTINGS } from "../app/features/sound/soundConfig";
import type { SoundPlan } from "../app/features/sound/soundPlan";

const sampler = vi.hoisted(() => ({
    create: vi.fn(),
    cache: vi.fn(() => ({ kind: "cache" })),
    start: vi.fn(),
    dispose: vi.fn(),
    stopVoice: vi.fn(),
}));

vi.mock("smplr", () => ({
    Soundfont: sampler.create,
    CacheStorage: sampler.cache,
}));

const close = vi.fn(async () => {});

class AudioContextStub {
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {});
    close = close;
    createGain() {
        return { gain: { value: 0 }, connect: vi.fn() };
    }
    createBiquadFilter() {
        return {
            type: "lowpass",
            frequency: { value: 0 },
            Q: { value: 0 },
            connect: vi.fn(),
        };
    }
}

const plan: SoundPlan = {
    events: [{ text: "la", wordId: 0, start: 0, midi: 57 }],
    tonicMidi: 57,
    density: 1,
};

beforeEach(() => {
    vi.stubGlobal("AudioContext", AudioContextStub);
    vi.stubGlobal("caches", {});
    sampler.create.mockImplementation(() => ({
        ready: Promise.resolve(),
        start: sampler.start,
        dispose: sampler.dispose,
    }));
    sampler.start.mockReturnValue(sampler.stopVoice);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

it("preloads only visible instruments and lets a click load another instrument immediately", async () => {
    let release: () => void = () => {};
    const firstReady = new Promise<void>((resolve) => { release = resolve; });
    sampler.create.mockImplementationOnce(() => ({
        ready: firstReady,
        start: sampler.start,
        dispose: sampler.dispose,
    }));
    const audio = createChannelAudioEngine(DEFAULT_SOUND_SETTINGS);

    audio.preload(["guitar"]);
    await vi.waitFor(() => expect(sampler.create).toHaveBeenCalledTimes(1));
    expect(sampler.create.mock.calls[0][1].instrument).toBe("acoustic_guitar_nylon");
    const piano = audio.play(plan, DEFAULT_SOUND_SETTINGS, vi.fn(), new AbortController().signal);
    await piano;
    expect(sampler.create.mock.calls[1][1].instrument).toBe("acoustic_grand_piano");
    release();
    await Promise.resolve();
    expect(sampler.create).toHaveBeenCalledTimes(2);
    audio.dispose();
});

it("reuses decoded samples across repeated channel playback", async () => {
    const audio = createChannelAudioEngine(DEFAULT_SOUND_SETTINGS);
    const settings = { ...DEFAULT_SOUND_SETTINGS, instrument: "guitar" as const };
    const first = await audio.play(plan, settings, vi.fn(), new AbortController().signal);
    const second = await audio.play(plan, settings, vi.fn(), new AbortController().signal);

    expect(sampler.create).toHaveBeenCalledOnce();
    expect(sampler.start).toHaveBeenCalledTimes(2);
    first();
    second();
    expect(sampler.stopVoice).toHaveBeenCalledTimes(2);
    audio.dispose();
    await Promise.resolve();
    expect(sampler.dispose).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
});

it("does not schedule an abandoned click while samples are loading", async () => {
    let release: () => void = () => {};
    const ready = new Promise<void>((resolve) => { release = resolve; });
    sampler.create.mockImplementationOnce(() => ({
        ready,
        start: sampler.start,
        dispose: sampler.dispose,
    }));
    const audio = createChannelAudioEngine(DEFAULT_SOUND_SETTINGS);
    const settings = { ...DEFAULT_SOUND_SETTINGS, instrument: "guitar" as const };
    const firstController = new AbortController();
    const first = audio.play(plan, settings, vi.fn(), firstController.signal);
    await Promise.resolve();
    firstController.abort();
    const second = audio.play(plan, settings, vi.fn(), new AbortController().signal);

    release();
    const firstStop = await first;
    const secondStop = await second;
    expect(sampler.create).toHaveBeenCalledOnce();
    expect(sampler.start).toHaveBeenCalledOnce();
    firstStop();
    secondStop();
    audio.dispose();
});
