import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChannelChat } from "../app/features/chat/useChannelChat";
import type { Message } from "../app/features/messages/types";
import type { Account } from "../app/features/users/types";

const api = vi.hoisted(() => ({ getMessages: vi.fn(), sendMessage: vi.fn() }));
vi.mock("../app/features/messages/api", () => api);

const account: Account = {
    id: 1,
    username: "Alice",
    channels: [{ id: 7, name: "studio", creation_date: "2026-11-11T09:00:00Z" }],
    metadata: { harmonie: { instrument: "piano" } },
};

function message(id: number): Message {
    return {
        id, content: `Message ${id}`, user_id: 2, user: "Louis",
        creation_date: `2026-11-11T10:${String(id).padStart(2, "0")}:00Z`,
    };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", undefined);
    vi.spyOn(Math, "random").mockReturnValue(0);
    api.getMessages.mockReset();
    api.sendMessage.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it("distinguishes the initial load from fallback messages and does not repeat them", async () => {
    let messages = [message(1)];
    api.getMessages.mockImplementation(async () => messages);
    const { result } = renderHook(() => useChannelChat(7, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.arrival).toBeNull();

    messages = [message(1), message(2), message(3)];
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.arrival).toEqual({ sequence: 1, source: "poll", ids: ["2", "3"] });

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.arrival?.sequence).toBe(1);
});
