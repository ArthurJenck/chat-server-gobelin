import type { Message } from "../messages/types";
import { EMOTION_MODEL_REVISION, EMOTION_SELECTION_REVISION, isEmotion, type Emotion } from "./emotion";

export function emotionCacheKey(channelId: number, message: Message) {
    let hash = 2166136261;
    for (const character of message.content)
        hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    const identity = message.id ?? `${message.creation_date}-${message.user_id}`;
    return `harmonie-emotion-${EMOTION_MODEL_REVISION}-${EMOTION_SELECTION_REVISION}-${channelId}-${identity}-${message.content.length}-${hash >>> 0}`;
}

export function readCachedEmotion(key: string): Emotion | null {
    try {
        const value = window.localStorage.getItem(key);
        return isEmotion(value) ? value : null;
    } catch {
        return null;
    }
}

export function writeCachedEmotion(key: string, emotion: Emotion) {
    try {
        window.localStorage.setItem(key, emotion);
    } catch {
        return;
    }
}
