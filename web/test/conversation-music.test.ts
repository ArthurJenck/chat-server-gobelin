import { beforeEach, expect, it, vi } from "vitest";
import {
    DEFAULT_MUSIC_KEY,
    INACTIVITY_MS,
    dueConversationRest,
    latestMusicKey,
    musicColor,
    publishDueConversationRest,
} from "../app/features/chat/conversationMusic";
import {
    applyPageMusicKeys,
    buildChannelStaffs,
    paginateChannelStaffs,
} from "../app/features/chat/channelPagination";
import type { Message } from "../app/features/messages/types";

const api = vi.hoisted(() => ({
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
}));

vi.mock("../app/features/messages/api", () => api);

const now = Date.parse("2026-11-11T12:00:00Z");

function message(id: number, content: string, age: number, metadata?: Record<string, unknown>): Message {
    return {
        id,
        content,
        user_id: 1,
        user: "Alice",
        creation_date: new Date(now - age).toISOString(),
        metadata: metadata ? { harmonie: metadata } : {},
    };
}

beforeEach(() => {
    api.getMessages.mockReset();
    api.sendMessage.mockReset();
    api.sendMessage.mockResolvedValue({ id: 3 });
});

it("publishes at 12 hours once and advances si to do", async () => {
    const human = message(1, "Bonsoir", INACTIVITY_MS,
        { music_root: 11, music_mode: "major" });
    api.getMessages.mockResolvedValue([human]);
    expect(dueConversationRest([human], now - 1)).toBe(false);
    expect(dueConversationRest([human], now)).toBe(true);
    expect(await publishDueConversationRest(5, now)).toBe(true);
    expect(api.sendMessage).toHaveBeenCalledWith(5, "", {
        type: "conversation_rest", music_root: 0, music_mode: "major",
    }, true);
    const rest = message(2, "", 0, { type: "conversation_rest", music_root: 0, music_mode: "major" });
    expect(dueConversationRest([rest, human], now + INACTIVITY_MS)).toBe(false);
    expect(latestMusicKey([rest, human])).toEqual(DEFAULT_MUSIC_KEY);
    const resumed = message(3, "Bonjour", 0,
        { music_root: 0, music_mode: "major" });
    expect(dueConversationRest([resumed, rest, human], now + INACTIVITY_MS)).toBe(true);
});

it("uses one key for a partly filled page and keeps completed pages", () => {
    const old = message(1, "Bonjour", INACTIVITY_MS + 10,
        { music_root: 0, music_mode: "major" });
    const rest = message(2, "", 5,
        { type: "conversation_rest", music_root: 1, music_mode: "major" });
    const next = message(3, "Salut", 0,
        { music_root: 1, music_mode: "major" });
    const blocks = buildChannelStaffs([next, rest, old], 360);
    const openPage = applyPageMusicKeys(paginateChannelStaffs(blocks, 200), 360);
    expect(openPage).toHaveLength(1);
    expect(openPage[0].every((block) => block.pageKey.root === 1)).toBe(true);
    expect(openPage[0][0].plan.tonicMidi).toBe(blocks[0].plan.tonicMidi + 1);
    expect(musicColor(openPage[0][0].pageKey)).toBe("#FFA200");
    expect(musicColor({ root: 1, mode: "minor" })).toBe("#A200C6");

    const completePages = applyPageMusicKeys(paginateChannelStaffs(blocks, 60), 360);
    expect(completePages.at(-1)?.[0].pageKey.root).toBe(0);
    expect(completePages[0][0].pageKey.root).toBe(1);
});
