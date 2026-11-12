import { CacheStorage, Soundfont } from "smplr";
import { createArrangement } from "./arrangement";
import { INSTRUMENTS, INSTRUMENT_PROFILES, type Instrument, type SoundSettings } from "./soundConfig";
import type { SoundPlan } from "./soundPlan";

type ChannelSoundfont = ReturnType<typeof Soundfont>;

export function channelScoreDuration(plan: SoundPlan, settings: SoundSettings) {
    const step = plan.noteStep ?? settings.intervalMs / 1000;
    return Math.max(0, ...plan.events.map((event) =>
        event.start + (event.rest === "whole" ? 4 : event.rest === "half" ? 2 : 1) * step,
    ));
}

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

    async function prepare(instruments: Instrument[]) {
        await Promise.allSettled([...new Set(instruments)].map((instrument) => load(instrument)));
    }

    async function play(
        plan: SoundPlan,
        playbackSettings: SoundSettings,
        onFinished: () => void,
        signal: AbortSignal,
        onScheduled?: (getPlayhead: () => number | null) => void,
        maxNoteDuration?: number,
        onEnded?: () => void,
    ): Promise<() => void> {
        const arrangement = createArrangement(plan, playbackSettings);
        if (arrangement.length === 0) {
            if (signal.aborted || disposed) return () => {};
            const started = performance.now();
            let finished = false;
            const stop = () => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                active.delete(stop);
                onEnded?.();
            };
            const timer = setTimeout(() => {
                stop();
                onFinished();
            }, channelScoreDuration(plan, playbackSettings) * 1000);
            active.add(stop);
            onScheduled?.(() => finished ? null : (performance.now() - started) / 1000);
            return stop;
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

        const origin = current.currentTime + 0.01;
        const stops: Array<() => void> = [];
        const scoreDuration = channelScoreDuration(plan, playbackSettings);
        let latestVoiceEnd = scoreDuration;
        try {
            for (const event of arrangement) {
                const duration = maxNoteDuration === undefined
                    ? event.duration
                    : Math.min(event.duration, maxNoteDuration);
                stops.push(soundfont.start({
                    note: event.note,
                    time: origin + event.start,
                    duration,
                    velocity: event.velocity,
                }));
                latestVoiceEnd = Math.max(latestVoiceEnd, event.start + duration);
            }
        } catch {
            stops.forEach((stop) => stop());
            throw new Error("La lecture audio a échoué.");
        }
        let finished = false;
        let scoreNotified = false;
        const notifyScore = () => {
            if (scoreNotified || finished) return;
            scoreNotified = true;
            onFinished();
        };
        const finish = (notify: boolean) => {
            if (finished) return;
            if (notify) notifyScore();
            finished = true;
            clearTimeout(scoreTimer);
            clearTimeout(tailTimer);
            stops.forEach((stop) => stop());
            active.delete(stop);
            onEnded?.();
        };
        const stop = () => finish(false);
        const scoreTimer = setTimeout(notifyScore,
            Math.ceil((origin - current.currentTime + scoreDuration) * 1000));
        const tailTimer = setTimeout(() => finish(true),
            Math.ceil((origin - current.currentTime + latestVoiceEnd + 0.05) * 1000));
        active.add(stop);
        onScheduled?.(() => {
            if (finished) return null;
            const timestamp = current.getOutputTimestamp?.();
            const outputTime = timestamp?.performanceTime !== undefined &&
                timestamp.performanceTime > 0 && timestamp.contextTime !== undefined
                ? timestamp.contextTime
                : current.currentTime - (current.baseLatency ?? 0) - (current.outputLatency ?? 0);
            return outputTime - origin;
        });
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

    function stopAll() {
        for (const stop of [...active]) stop();
    }

    return { preload, prepare, play, stopAll, dispose };
}

export type ChannelAudioEngine = ReturnType<typeof createChannelAudioEngine>;
