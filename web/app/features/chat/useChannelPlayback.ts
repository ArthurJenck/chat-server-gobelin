import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelAudioEngine } from "../sound/channelAudioEngine";
import type { SoundSettings } from "../sound/soundConfig";
import type { ChannelPerformance } from "./channelScore";

export type ChannelVisual = {
    token: number;
    blockKeys: string[];
    eventStarts: Record<number, number>;
    getPlayhead: () => number | null;
    settings: SoundSettings;
};

export function useChannelPlayback(audio: ChannelAudioEngine) {
    const generation = useRef(0);
    const queue = useRef<ChannelPerformance[]>([]);
    const running = useRef(false);
    const controller = useRef<AbortController | null>(null);
    const stop = useRef<(() => void) | null>(null);
    const finish = useRef<(() => void) | null>(null);
    const visualSerial = useRef(0);
    const [visuals, setVisuals] = useState<ChannelVisual[]>([]);
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [error, setError] = useState<{ key: string; text: string } | null>(null);

    const cancel = useCallback(() => {
        generation.current += 1;
        queue.current = [];
        controller.current?.abort();
        stop.current?.();
        audio.stopAll?.();
        finish.current?.();
        controller.current = null;
        stop.current = null;
        finish.current = null;
        running.current = false;
        setVisuals([]);
        setLoadingKey(null);
    }, [audio]);

    const run = useCallback(async (token: number) => {
        if (running.current) return;
        running.current = true;
        if (queue.current.length)
            await audio.prepare?.(queue.current.map((item) => item.settings.instrument));
        if (generation.current !== token) return;
        while (generation.current === token && queue.current.length) {
            const item = queue.current.shift()!;
            const nextController = new AbortController();
            controller.current = nextController;
            setLoadingKey(item.blockKeys[0] ?? null);
            let resolveFinished = () => {};
            const finished = new Promise<void>((resolve) => { resolveFinished = resolve; });
            finish.current = resolveFinished;
            const visualToken = ++visualSerial.current;
            try {
                const nextStop = await audio.play(
                    item.plan,
                    item.settings,
                    resolveFinished,
                    nextController.signal,
                    (getPlayhead) => {
                        if (generation.current !== token) return;
                        setLoadingKey(null);
                        if (item.blockKeys.length)
                            setVisuals((current) => [...current, { token: visualToken, blockKeys: item.blockKeys, eventStarts: item.eventStarts, getPlayhead, settings: item.settings }]);
                    },
                    item.maxNoteDuration,
                    () => {
                        if (generation.current === token)
                            setVisuals((current) => current.filter((visual) => visual.token !== visualToken));
                    },
                );
                if (generation.current !== token || nextController.signal.aborted) {
                    nextStop();
                    break;
                }
                stop.current = nextStop;
                await finished;
            } catch (cause) {
                if (generation.current === token && item.manual)
                    setError({ key: item.blockKeys[0], text: cause instanceof Error ? cause.message : "Lecture impossible." });
            }
            if (generation.current !== token) break;
            stop.current = null;
            finish.current = null;
            controller.current = null;
            setLoadingKey(null);
        }
        if (generation.current === token) running.current = false;
    }, [audio]);

    const replace = useCallback((items: ChannelPerformance[]) => {
        cancel();
        setError(null);
        queue.current = [...items];
        if (items.length) void run(generation.current);
    }, [cancel, run]);

    const append = useCallback((items: ChannelPerformance[]) => {
        if (!items.length) return;
        queue.current.push(...items);
        if (running.current)
            void audio.prepare?.(items.map((item) => item.settings.instrument));
        void run(generation.current);
    }, [audio, run]);

    useEffect(() => () => {
        controller.current?.abort();
        stop.current?.();
        audio.stopAll?.();
        finish.current?.();
        generation.current += 1;
    }, [audio]);

    return { replace, append, cancel, visuals, visual: visuals.at(-1) ?? null, loadingKey, error };
}
