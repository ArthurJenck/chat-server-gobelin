import { CacheStorage, Soundfont } from "smplr";
import { createArrangement } from "./arrangement";
import { INSTRUMENTS, INSTRUMENT_PROFILES, type Instrument, type SoundSettings } from "./soundConfig";
import type { SoundPlan } from "./soundPlan";

type ChannelSoundfont = ReturnType<typeof Soundfont>;

export function createChannelAudioEngine(settings: SoundSettings) {
    let context: AudioContext | null = null;
    let filter: BiquadFilterNode | null = null;
    let disposed = false;
    let preloadQueue = Promise.resolve();
    const soundfonts = new Map<Instrument, Promise<ChannelSoundfont>>();
    const queued = new Set<Instrument>();
    const active = new Set<() => void>();

    function audioContext() {
        if (disposed)
            throw new Error("La lecture audio a été interrompue.");
        if (typeof window === "undefined" || !window.AudioContext)
            throw new Error("Audio indisponible sur ce navigateur.");
        if (!context) {
            context = new AudioContext();
            filter = context.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.value = settings.filterFrequency;
            filter.Q.value = settings.resonance;
            const master = context.createGain();
            master.gain.value = settings.volume;
            filter.connect(master);
            master.connect(context.destination);
        }
        return context;
    }

    async function load(instrument: Instrument) {
        const existing = soundfonts.get(instrument);
        if (existing) return existing;
        const current = audioContext();
        const profile = INSTRUMENT_PROFILES[instrument];
        const notes = Array.from(
            { length: Math.min(127, profile.maxMidi + 5) - Math.max(0, profile.minMidi - 5) + 1 },
            (_, index) => Math.max(0, profile.minMidi - 5) + index,
        );
        const soundfont = Soundfont(current, {
            instrument: INSTRUMENTS[instrument].soundfont,
            kit: "MusyngKite",
            destination: filter!,
            notesToLoad: { notes },
            storage: "caches" in window ? CacheStorage() : undefined,
        });
        const ready = soundfont.ready.then(() => {
            if (disposed) {
                soundfont.dispose();
                throw new Error("Chargement des sons interrompu.");
            }
            return soundfont;
        }).catch((error: unknown) => {
            soundfonts.delete(instrument);
            if (!disposed) soundfont.dispose();
            throw error;
        });
        soundfonts.set(instrument, ready);
        return ready;
    }

    function preload(visible: Instrument[]) {
        if (disposed || typeof window === "undefined" || !window.AudioContext) return;
        for (const instrument of visible) {
            if (queued.has(instrument) || soundfonts.has(instrument)) continue;
            queued.add(instrument);
            preloadQueue = preloadQueue.then(async () => {
                queued.delete(instrument);
                if (disposed || soundfonts.has(instrument)) return;
                try {
                    await load(instrument);
                } catch {
                    return;
                }
            });
        }
    }

    async function play(
        plan: SoundPlan,
        playbackSettings: SoundSettings,
        onFinished: () => void,
        signal: AbortSignal,
    ): Promise<() => void> {
        const arrangement = createArrangement(plan, playbackSettings);
        if (arrangement.length === 0) {
            const duration = Math.max(0, ...plan.events.map((event) =>
                event.start + (event.rest === "half" ? 2 : event.rest === "whole" ? 4 : event.rest === "quarter" ? 1 : 0) * (plan.noteStep ?? playbackSettings.intervalMs / 1000),
            ));
            const timer = setTimeout(onFinished, duration * 1000);
            return () => clearTimeout(timer);
        }
        const current = audioContext();
        try {
            await current.resume();
        } catch {
            throw new Error("La lecture audio a échoué.");
        }
        if (signal.aborted || disposed) return () => {};
        let soundfont: ChannelSoundfont;
        try {
            soundfont = await load(playbackSettings.instrument);
        } catch {
            throw new Error("Chargement des sons impossible.");
        }
        if (signal.aborted || disposed) return () => {};

        const origin = current.currentTime + 0.1;
        const stops: Array<() => void> = [];
        let latestVoiceEnd = Math.max(0, ...plan.events.map((event) =>
            event.start + (event.rest === "half" ? 2 : event.rest === "whole" ? 4 : event.rest === "quarter" ? 1 : 0) * (plan.noteStep ?? playbackSettings.intervalMs / 1000),
        ));
        try {
            for (const event of arrangement) {
                stops.push(soundfont.start({
                    note: event.note,
                    time: origin + event.start,
                    duration: event.duration,
                    velocity: event.velocity,
                }));
                latestVoiceEnd = Math.max(latestVoiceEnd, event.start + event.duration + 1.5);
            }
        } catch {
            stops.forEach((stop) => stop());
            throw new Error("La lecture audio a échoué.");
        }
        let finished = false;
        const finish = (notify: boolean) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            stops.forEach((stop) => stop());
            active.delete(stop);
            if (notify) onFinished();
        };
        const stop = () => finish(false);
        const timer = setTimeout(() => finish(true),
            Math.ceil((origin - current.currentTime + latestVoiceEnd + 0.1) * 1000));
        active.add(stop);
        return stop;
    }

    function dispose() {
        if (disposed) return;
        disposed = true;
        for (const stop of active) stop();
        for (const ready of soundfonts.values()) {
            void ready.then((soundfont) => soundfont.dispose()).catch(() => {});
        }
        soundfonts.clear();
        if (context) void context.close();
        context = null;
        filter = null;
    }

    return { preload, play, dispose };
}

export type ChannelAudioEngine = ReturnType<typeof createChannelAudioEngine>;
