import { CacheStorage, Soundfont } from "smplr";
import { createArrangement } from "./arrangement";
import { INSTRUMENTS, type SoundSettings } from "./soundConfig";
import type { SoundPlan } from "./soundPlan";

export async function startPlayback(
    plan: SoundPlan,
    settings: SoundSettings,
    onFinished: () => void,
    onScheduled?: (getPlayhead: () => number | null) => void,
): Promise<() => void> {
    if (typeof window === "undefined" || !window.AudioContext)
        throw new Error("Audio indisponible sur ce navigateur.");
    const arrangement = createArrangement(plan, settings);
    const notes = [...new Set(arrangement.map((event) => event.note))];
    if (notes.length === 0) {
        onFinished();
        return () => {};
    }

    const context = new AudioContext();
    try {
        await context.resume();
    } catch {
        void context.close();
        throw new Error("La lecture audio a échoué.");
    }

    const filter = context.createBiquadFilter();
    const master = context.createGain();
    const delay = context.createDelay(1);
    const feedback = context.createGain();
    const wet = context.createGain();
    const dry = context.createGain();

    filter.type = "lowpass";
    filter.frequency.value = settings.filterFrequency;
    filter.Q.value = settings.resonance;
    filter.connect(dry);
    dry.connect(master);
    dry.gain.value = 1;
    filter.connect(delay);
    delay.delayTime.value = settings.echoDelay;
    delay.connect(feedback);
    feedback.connect(delay);
    feedback.gain.value = settings.echoEnabled ? settings.echoFeedback : 0;
    delay.connect(wet);
    wet.connect(master);
    wet.gain.value = settings.echoEnabled ? settings.echoMix : 0;
    master.gain.value = settings.volume;
    master.connect(context.destination);

    let soundfont: ReturnType<typeof Soundfont> | undefined;
    try {
        soundfont = Soundfont(context, {
            instrument: INSTRUMENTS[settings.instrument].soundfont,
            kit: "MusyngKite",
            destination: filter,
            notesToLoad: { notes },
            storage: "caches" in window ? CacheStorage() : undefined,
        });
        await soundfont.ready;
    } catch {
        soundfont?.dispose();
        void context.close();
        throw new Error("Chargement des sons impossible.");
    }

    try {
        await context.suspend();
    } catch {
        soundfont.dispose();
        void context.close();
        throw new Error("La lecture audio a échoué.");
    }

    const origin = context.currentTime + 0.04;
    let latestVoiceEnd = 0;
    try {
        for (const event of arrangement) {
            soundfont.start({
                note: event.note,
                time: origin + event.start,
                duration: event.duration,
                velocity: event.velocity,
            });
            latestVoiceEnd = Math.max(
                latestVoiceEnd,
                event.start + event.duration + 1.5,
            );
        }
    } catch {
        soundfont.dispose();
        void context.close();
        throw new Error("La lecture audio a échoué.");
    }

    try {
        await context.resume();
    } catch {
        soundfont.dispose();
        void context.close();
        throw new Error("La lecture audio a échoué.");
    }

    const repeats =
        settings.echoFeedback > 0
            ? Math.ceil(Math.log(0.001) / Math.log(settings.echoFeedback))
            : 0;
    const echoTail =
        settings.echoEnabled && settings.echoMix > 0
            ? settings.echoDelay * (1 + repeats)
            : 0;
    let finished = false;
    const finish = (notify: boolean) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setValueAtTime(0, context.currentTime);
        soundfont.stop();
        soundfont.dispose();
        void context.close();
        if (notify) onFinished();
    };
    const timer = setTimeout(
        () => finish(true),
        Math.ceil(
            (origin - context.currentTime + latestVoiceEnd + echoTail + 0.1) *
                1000,
        ),
    );
    onScheduled?.(() => {
        if (finished) return null;
        const timestamp = context.getOutputTimestamp?.();
        const outputTime =
            timestamp?.performanceTime !== undefined &&
            timestamp.performanceTime > 0 &&
            timestamp.contextTime !== undefined
                ? timestamp.contextTime
                : context.currentTime -
                  (context.baseLatency ?? 0) -
                  (context.outputLatency ?? 0);
        return outputTime - origin;
    });
    return () => finish(false);
}
