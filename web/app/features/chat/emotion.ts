import { metadataForProject } from "../../shared/projectMetadata";
import type { Message } from "../messages/types";

export const EMOTION_MODEL = "kamaludeen/multilingual_go_emotions-ONNX";
export const EMOTION_MODEL_REVISION = "521738dcb7ab13f3a6ab3a3cd8b1d0b90da3d3a4";

const EMOTIONS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval",
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief",
    "joy", "love", "nervousness", "optimism", "pride", "realization",
    "relief", "remorse", "sadness", "surprise", "neutral",
] as const;

export type Emotion = typeof EMOTIONS[number];
export type EmotionMode = "major" | "minor";

const EMOTION_SET = new Set<string>(EMOTIONS);
const MINOR_EMOTIONS = new Set<Emotion>([
    "anger", "annoyance", "confusion", "disappointment", "disapproval",
    "disgust", "embarrassment", "fear", "grief", "nervousness",
    "remorse", "sadness", "surprise",
]);

export function isEmotion(value: unknown): value is Emotion {
    return typeof value === "string" && EMOTION_SET.has(value);
}

export function emotionMode(emotion: Emotion | null): EmotionMode {
    return emotion && MINOR_EMOTIONS.has(emotion) ? "minor" : "major";
}

export function messageEmotion(message: Message): Emotion | null {
    const value = metadataForProject(message.metadata).emotion;
    return isEmotion(value) ? value : null;
}

export function selectEmotion(scores: readonly { label: string; score: number }[]): Emotion {
    let best: { label: Emotion; score: number } | null = null;
    for (const candidate of scores) {
        if (!isEmotion(candidate.label) || !Number.isFinite(candidate.score)) continue;
        if (
            !best || candidate.score > best.score ||
            (candidate.score === best.score &&
                emotionMode(candidate.label) === "major" && emotionMode(best.label) === "minor")
        )
            best = { label: candidate.label, score: candidate.score };
    }
    return best && best.score >= 0.5 ? best.label : "neutral";
}
