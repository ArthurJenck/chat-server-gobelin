import { isEmotion, type Emotion } from "./emotion";

type WorkerResult = { id: number; emotion?: unknown; error?: string };

let worker: Worker | null = null;
let unavailable = false;
let nextId = 0;
let preloadPromise: Promise<void> | null = null;
const pending = new Map<number, {
    resolve: (emotion: Emotion) => void;
    reject: (error: Error) => void;
}>();

function getWorker() {
    if (unavailable || typeof Worker === "undefined")
        throw new Error("Analyse des émotions indisponible.");
    if (worker) return worker;
    worker = new Worker(new URL("./emotion.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
        const request = pending.get(event.data.id);
        if (!request) return;
        pending.delete(event.data.id);
        if (isEmotion(event.data.emotion)) request.resolve(event.data.emotion);
        else request.reject(new Error(event.data.error ?? "Réponse du modèle invalide."));
    };
    worker.onerror = (event) => {
        unavailable = true;
        worker?.terminate();
        worker = null;
        for (const request of pending.values())
            request.reject(new Error(event.message || "Analyse des émotions indisponible."));
        pending.clear();
    };
    return worker;
}

export function classifyEmotion(text: string): Promise<Emotion> {
    try {
        const instance = getWorker();
        const id = ++nextId;
        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            try {
                instance.postMessage({ id, text });
            } catch (cause) {
                pending.delete(id);
                reject(cause);
            }
        });
    } catch (cause) {
        return Promise.reject(cause);
    }
}

export function preloadEmotionModel(): Promise<void> {
    preloadPromise ??= classifyEmotion("Bonjour.").then(() => undefined);
    return preloadPromise;
}
