import { describe, expect, it } from "vitest";
import { keyStateFromMessages, mergeKeyMessages } from "../app/features/key/keyState";
import type { Message } from "../app/features/messages/types";

const now = new Date("2026-11-12T12:00:00Z");

function event(id: number, userId: number, action: "claim" | "release", postedAt = "2026-11-12T10:00:00Z"): Message {
    return {
        id,
        content: action,
        user_id: userId,
        user: userId === 1 ? "Alice" : "Louis",
        creation_date: postedAt,
        posted_at: postedAt,
        metadata: { harmonie: { type: "classroom_key", action } },
    };
}

describe("classroom key state", () => {
    it("lets the first server id win simultaneous claims, regardless of arrival order", () => {
        const events = [event(12, 2, "claim"), event(11, 1, "claim")];
        expect(keyStateFromMessages(events, now)).toEqual({ holderId: 1, holderName: "Alice" });
        expect(keyStateFromMessages(events.reverse(), now)).toEqual({ holderId: 1, holderName: "Alice" });
    });

    it("ignores foreign releases and repeated claims until the holder returns the key", () => {
        const events = [
            event(1, 1, "claim"),
            event(2, 2, "claim"),
            event(3, 2, "release"),
            event(4, 1, "release"),
            event(5, 2, "claim"),
        ];
        expect(keyStateFromMessages(events.slice(0, 3), now))
            .toEqual({ holderId: 1, holderName: "Alice" });
        expect(keyStateFromMessages(events, now))
            .toEqual({ holderId: 2, holderName: "Louis" });
    });

    it("merges socket events with an older HTTP snapshot without losing the newer event", () => {
        const socket = event(3, 2, "claim");
        const merged = mergeKeyMessages([socket], [event(1, 1, "claim"), event(2, 1, "release")], now);
        expect(merged.map((message) => message.id)).toEqual([1, 2, 3]);
        expect(keyStateFromMessages(merged, now)).toEqual({ holderId: 2, holderName: "Louis" });
        expect(mergeKeyMessages(merged, [socket], now)).toHaveLength(3);
    });

    it("treats a saturated 100-event history as available", () => {
        const events = Array.from({ length: 100 }, (_, index) =>
            event(index + 1, index % 2 + 1, "claim"));
        expect(keyStateFromMessages(events, now)).toEqual({ holderId: null, holderName: null });
    });

    it("resets at midnight in Paris, including the winter time boundary", () => {
        const before = event(1, 1, "claim", "2026-11-12T22:59:59Z");
        expect(keyStateFromMessages([before], new Date("2026-11-12T22:59:59Z")))
            .toEqual({ holderId: 1, holderName: "Alice" });
        expect(keyStateFromMessages([before], new Date("2026-11-12T23:00:00Z")))
            .toEqual({ holderId: null, holderName: null });
        const summer = event(2, 2, "claim", "2026-07-01T21:59:59Z");
        expect(keyStateFromMessages([summer], new Date("2026-07-01T22:00:00Z")))
            .toEqual({ holderId: null, holderName: null });
    });
});
