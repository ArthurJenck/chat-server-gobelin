import { expect, it } from "vitest";
import { buildChannelStaffs, paginateChannelStaffs } from "../app/features/chat/channelPagination";
import { glissandoPerformance, messagePerformance, pagePerformances } from "../app/features/chat/channelScore";
import { channelScoreDuration } from "../app/features/sound/channelAudioEngine";
import type { Message } from "../app/features/messages/types";

function message(id: number, content: string, rest = false): Message {
    return {
        id,
        content,
        user_id: 2,
        user: "Alice",
        creation_date: `2026-11-11T10:${String(id).padStart(2, "0")}:00Z`,
        metadata: rest ? { harmonie: { type: "conversation_rest" } } : undefined,
    };
}

it("plays only the visible part of a message split across pages", () => {
    const blocks = buildChannelStaffs([message(1, "Bonjour tout le monde ".repeat(18))], 360);
    const pages = paginateChannelStaffs(blocks, 60);
    expect(pages.length).toBeGreaterThan(2);

    const visible = pagePerformances(pages[0]);
    const clicked = messagePerformance(pages[0][0], pages[0]);
    const visibleIndexes = new Set(pages[0].flatMap((block) => block.row.map((group) => group.eventIndex)));

    expect(visible).toHaveLength(1);
    expect(visible[0].plan.events).toHaveLength(visibleIndexes.size);
    expect(visible[0].plan.events[0].start).toBe(0);
    expect(clicked.plan.events.length).toBeGreaterThan(visible[0].plan.events.length);
    expect(clicked.manual).toBe(true);
});

it("keeps punctuation rests and the 12-hour conversation rest in sequence", () => {
    const blocks = buildChannelStaffs([
        message(1, "Bon, jour."),
        message(2, "", true),
        message(3, "Salut"),
    ], 360);
    const performances = pagePerformances(blocks);

    expect(performances.map((item) => item.id)).toEqual(["1", "2", "3"]);
    expect(performances[0].plan.events.filter((event) => event.rest).map((event) => event.rest))
        .toEqual(["quarter", "half"]);
    expect(performances[1].plan.events[0].rest).toBe("whole");
    expect(channelScoreDuration(performances[1].plan, performances[1].settings))
        .toBeCloseTo(4 * performances[1].plan.noteStep!);
    const lastRest = performances[0].plan.events.at(-1)!;
    expect(channelScoreDuration(performances[0].plan, performances[0].settings))
        .toBeGreaterThanOrEqual(lastRest.start + 2 * performances[0].plan.noteStep!);
});

it("builds a half-second piano glissando in the direction of travel", () => {
    const older = glissandoPerformance("older");
    const newer = glissandoPerformance("newer");

    expect(older.settings.instrument).toBe("piano");
    expect(older.plan.events).toHaveLength(25);
    expect(older.plan.events[0].midi).toBe(84);
    expect(older.plan.events.at(-1)?.midi).toBe(60);
    expect(newer.plan.events[0].midi).toBe(60);
    expect(newer.plan.events.at(-1)?.midi).toBe(84);
    expect(channelScoreDuration(older.plan, older.settings)).toBeCloseTo(0.5);
    expect(older.maxNoteDuration).toBe(0.04);
});
