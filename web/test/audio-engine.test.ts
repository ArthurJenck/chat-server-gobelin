import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { startPlayback } from '../app/sound/audioEngine'
import { DEFAULT_SOUND_SETTINGS, type Instrument } from '../app/sound/soundConfig'
import type { SoundPlan } from '../app/sound/soundPlan'

const sampler = vi.hoisted(() => ({
    create: vi.fn(),
    cache: vi.fn(() => ({ kind: 'cache' })),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
}))

vi.mock('smplr', () => ({ Soundfont: sampler.create, CacheStorage: sampler.cache }))

const close = vi.fn(async () => {})
const connect = vi.fn()

class AudioContextStub {
    currentTime = 0
    destination = {}
    resume = async () => {}
    close = close
    createGain() {
        return { gain: { value: 0, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn() }, connect }
    }
    createBiquadFilter() {
        return { type: 'lowpass', frequency: { value: 0 }, Q: { value: 0 }, connect }
    }
    createDelay() {
        return { delayTime: { value: 0 }, connect }
    }
}

const plan: SoundPlan = {
    events: [
        { text: 'a', wordId: 0, start: 0, midi: 57 },
        { text: 'b', wordId: 0, start: 0.2, midi: null },
        { text: 'c', wordId: 0, start: 0.4, midi: 60 },
        { text: 'd', wordId: 0, start: 0.6, midi: 57 },
    ],
    tonicMidi: 57,
    density: 4,
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('AudioContext', AudioContextStub)
    vi.stubGlobal('caches', {})
    sampler.create.mockReturnValue({ ready: Promise.resolve(), start: sampler.start, stop: sampler.stop, dispose: sampler.dispose })
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
})

it.each([
    ['piano', 'acoustic_grand_piano'],
    ['guitar', 'acoustic_guitar_nylon'],
    ['trumpet', 'trumpet'],
] as const)('loads %s soundfont samples for the planned notes', async (instrument: Instrument, name: string) => {
    const stop = await startPlayback(plan, { ...DEFAULT_SOUND_SETTINGS, instrument }, vi.fn())

    expect(sampler.create).toHaveBeenCalledWith(expect.any(AudioContextStub), expect.objectContaining({
        instrument: name,
        kit: 'MusyngKite',
        notesToLoad: { notes: [57, 60] },
        storage: { kind: 'cache' },
    }))
    expect(sampler.start).toHaveBeenCalledTimes(3)
    expect(sampler.start).toHaveBeenCalledWith(expect.objectContaining({ note: 60, time: expect.any(Number), duration: expect.any(Number) }))
    stop()
})

it('stops and disposes the sampler when playback finishes', async () => {
    const finished = vi.fn()
    await startPlayback(plan, DEFAULT_SOUND_SETTINGS, finished)

    await vi.runAllTimersAsync()

    expect(sampler.stop).toHaveBeenCalledOnce()
    expect(sampler.dispose).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
    expect(finished).toHaveBeenCalledOnce()
})

it('releases audio resources if soundfont loading fails', async () => {
    sampler.create.mockReturnValue({ ready: Promise.reject(new Error('network')), start: sampler.start, stop: sampler.stop, dispose: sampler.dispose })

    await expect(startPlayback(plan, DEFAULT_SOUND_SETTINGS, vi.fn())).rejects.toThrow('Chargement des sons impossible.')
    expect(sampler.dispose).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
})
