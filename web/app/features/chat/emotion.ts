import { metadataForProject } from "../../shared/projectMetadata";
import type { Message } from "../messages/types";

export const EMOTION_MODEL = "kamaludeen/multilingual_go_emotions-ONNX";
export const EMOTION_MODEL_REVISION = "521738dcb7ab13f3a6ab3a3cd8b1d0b90da3d3a4";
export const EMOTION_SELECTION_REVISION = 3;

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
const NEGATIVE_CUES: readonly [RegExp, Emotion][] = [
    [/\b(?:pas|plus)\s+(?:du tout\s+)?(?:content\w*|gentil\w*|heureux|heureuse\w*)\b/g, "disapproval"],
    [/\bfach\w*\b|\bcoler\w*\b/g, "anger"],
    [/\bpleur\w*\b|\btrist\w*\b|\bmalheureu\w*\b|\bdeprim\w*\b/g, "sadness"],
    [/\bpeur\b|\beffray\w*\b|\bangoi\w*\b|\banxieu\w*\b/g, "fear"],
    [/\bdecu\w*\b|\bdesesper\w*\b/g, "disappointment"],
];
const POSITIVE_CUE = /\b(?:ca|cela|les emotions|le systeme|l'application)\s+(?:march\w*|fonctionn\w*)\b/g;

function negativeCue(normalized: string): Emotion | null {
    for (const [pattern, emotion] of NEGATIVE_CUES) {
        pattern.lastIndex = 0;
        for (const match of normalized.matchAll(pattern)) {
            if (/\b(?:pas|plus|jamais)\s+(?:du tout\s+)?$/.test(normalized.slice(0, match.index)))
                continue;
            if (/^\s+plus\b/.test(normalized.slice(match.index + match[0].length)) &&
                /\bne\b/.test(normalized.slice(Math.max(0, match.index - 20), match.index)))
                continue;
            return emotion;
        }
    }
    return null;
}

function positiveCue(normalized: string): boolean {
    for (const match of normalized.matchAll(POSITIVE_CUE)) {
        if (/^\s+(?:pas|plus|mal)\b/.test(normalized.slice(match.index + match[0].length)))
            continue;
        return true;
    }
    return false;
}

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

export function selectEmotion(scores: readonly { label: string; score: number }[], text = ""): Emotion {
    const normalized = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cue = negativeCue(normalized);
    if (cue) return cue;
    if (positiveCue(normalized)) return "approval";
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
    return best?.label ?? "neutral";
}
