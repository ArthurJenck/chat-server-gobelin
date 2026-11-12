import { CacheStorage, Soundfont } from "smplr";
import { INSTRUMENTS, INSTRUMENT_PROFILES, type Instrument } from "./soundConfig";

export function randomPreviewNote(instrument: Instrument): number {
    const profile = INSTRUMENT_PROFILES[instrument];
    const center = 12 * (profile.octave + 1);
    const low = Math.max(profile.minMidi, center - 5);
    const high = Math.min(profile.maxMidi, center + 5);
    return low + Math.floor(Math.random() * (high - low + 1));
}

export async function playInstrumentPreview(
    instrument: Instrument,
    note: number,
    signal: AbortSignal,
): Promise<void> {
    if (typeof window === "undefined" || !window.AudioContext || signal.aborted) return;

    const context = new AudioContext();
    let soundfont: ReturnType<typeof Soundfont> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const stop = () => {
        if (stopped) return;
        stopped = true;
        if (timer) clearTimeout(timer);
        soundfont?.stop();
        soundfont?.dispose();
        void context.close();
        signal.removeEventListener("abort", stop);
    };

    signal.addEventListener("abort", stop, { once: true });
    try {
        await context.resume();
        if (signal.aborted) return;
        soundfont = Soundfont(context, {
            instrument: INSTRUMENTS[instrument].soundfont,
            kit: "MusyngKite",
            notesToLoad: { notes: [note] },
            storage: "caches" in window ? CacheStorage() : undefined,
        });
        await soundfont.ready;
        if (signal.aborted) return;
        soundfont.start({ note, time: context.currentTime, duration: 0.7, velocity: 90 });
        timer = setTimeout(stop, 1600);
    } catch {
        stop();
    }
}
