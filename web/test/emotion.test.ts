import { beforeEach, expect, it } from "vitest";
import {
    emotionMode,
    messageEmotion,
    selectEmotion,
} from "../app/features/chat/emotion";
import {
    emotionCacheKey,
    readCachedEmotion,
    writeCachedEmotion,
} from "../app/features/chat/emotionCache";
import {
    applyPageMusicKeys,
    buildChannelStaffs,
    pageGradientKey,
    paginateChannelStaffs,
} from "../app/features/chat/channelPagination";
import type { Message } from "../app/features/messages/types";

function message(id: number, emotion?: string, content = "Bonjour"): Message {
    return {
        id,
        content,
        user_id: 1,
        user: "Alice",
        creation_date: `2026-11-11T10:${String(id).padStart(2, "0")}:00Z`,
        metadata: { harmonie: { music_root: 2, music_mode: "major", ...(emotion ? { emotion } : {}) } },
    };
}

beforeEach(() => window.localStorage.clear());

it("selects a confident emotion and defaults to neutral below 0.5", () => {
    expect(selectEmotion([{ label: "anger", score: 0.49 }, { label: "joy", score: 0.48 }]))
        .toBe("neutral");
    expect(selectEmotion([{ label: "anger", score: 0.5 }, { label: "joy", score: 0.4 }]))
        .toBe("anger");
    expect(selectEmotion([{ label: "anger", score: 0.7 }, { label: "joy", score: 0.7 }]))
        .toBe("joy");
    expect(selectEmotion([{ label: "unknown", score: 1 }, { label: "sadness", score: 0.6 }]))
        .toBe("sadness");
    expect(emotionMode("confusion")).toBe("minor");
    expect(emotionMode("surprise")).toBe("minor");
    expect(emotionMode("neutral")).toBe("major");
    expect(messageEmotion(message(1, "fear"))).toBe("fear");
});

it("caches a missing emotion by message content and model revision", () => {
    const original = message(1);
    const key = emotionCacheKey(5, original);
    expect(readCachedEmotion(key)).toBeNull();
    writeCachedEmotion(key, "sadness");
    expect(readCachedEmotion(key)).toBe("sadness");
    expect(readCachedEmotion(emotionCacheKey(5, { ...original, content: "Bonsoir" })))
        .toBeNull();
});

it("keeps the page tonic while giving each message its own mode", () => {
    const major = message(1, "joy");
    const minor = message(2, "sadness");
    const rest: Message = {
        ...message(3),
        content: "",
        metadata: { harmonie: { type: "conversation_rest", music_root: 3, music_mode: "major" } },
    };
    const next = message(4, "fear");
    next.metadata = { harmonie: { music_root: 3, music_mode: "major", emotion: "fear" } };
    const pages = applyPageMusicKeys(
        paginateChannelStaffs(buildChannelStaffs([major, minor, rest, next], 360), 600),
        360,
    );
    const page = pages[0];
    const first = page.find((block) => block.message.id === 1)!;
    const second = page.find((block) => block.message.id === 2)!;
    const latest = page.find((block) => block.message.id === 4)!;
    expect(first.pageKey.root).toBe(3);
    expect(first.plan.tonicMidi).toBe(second.plan.tonicMidi);
    expect(first.mode).toBe("major");
    expect(second.mode).toBe("minor");
    expect(latest.mode).toBe("minor");
    expect(pageGradientKey(page)).toEqual({ root: 3, mode: "minor" });
    expect(pageGradientKey(page.filter((block) => block.message.id !== 4)))
        .toEqual({ root: 3, mode: "major" });
});
