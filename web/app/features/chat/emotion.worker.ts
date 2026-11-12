import { pipeline } from "@huggingface/transformers";
import { EMOTION_MODEL, EMOTION_MODEL_REVISION, selectEmotion } from "./emotion";

const classifier = pipeline("text-classification", EMOTION_MODEL, {
    dtype: "q8",
    revision: EMOTION_MODEL_REVISION,
});
let queue = Promise.resolve();

self.onmessage = (event: MessageEvent<{ id: number; text: string }>) => {
    const { id, text } = event.data;
    const run = async () => {
        try {
            const result = await (await classifier)(text, { top_k: 28 });
            const scores = Array.isArray(result) ? result.flat() : [result];
            self.postMessage({ id, emotion: selectEmotion(scores) });
        } catch (cause) {
            self.postMessage({
                id,
                error: cause instanceof Error ? cause.message : "Analyse impossible.",
            });
        }
    };
    queue = queue.then(run, run);
};
