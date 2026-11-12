import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { channelSocketUrl, parseChannelEvents } from "../app/features/chat/channelSocket";
import { useChannelChat } from "../app/features/chat/useChannelChat";
import { setToken } from "../app/features/auth/token";
import type { Message } from "../app/features/messages/types";
import type { Account } from "../app/features/users/types";

const api = vi.hoisted(() => ({ getMessages: vi.fn(), sendMessage: vi.fn() }));
const emotion = vi.hoisted(() => ({ classifyEmotion: vi.fn() }));
vi.mock("../app/features/messages/api", () => api);
vi.mock("../app/features/chat/emotionClient", () => ({ classifyEmotion: emotion.classifyEmotion }));

class FakeSocket {
    static instances: FakeSocket[] = [];
    static OPEN = 1;
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;

    constructor(readonly url: string) {
        FakeSocket.instances.push(this);
    }

    open() {
        this.readyState = 1;
        this.onopen?.();
    }

    emit(data: unknown) {
        this.onmessage?.({ data });
    }

    close() {
        if (this.readyState === 3) return;
        this.readyState = 3;
        this.onclose?.();
    }
}

const account: Account = {
    id: 1,
    username: "Alice",
    channels: [
        { id: 5, name: "general", creation_date: "2026-11-11T09:00:00Z" },
        { id: 9, name: "__harmonie_cle_salle", creation_date: "2026-11-11T09:00:00Z" },
        { id: 7, name: "studio", creation_date: "2026-11-11T09:00:00Z" },
    ],
    metadata: { harmonie: { instrument: "piano" } },
};

function message(id: number, channelId = 5, content = `Message ${id}`): Message {
    return {
        id, channel_id: channelId, content, user_id: 2, user: "Louis",
        creation_date: new Date().toISOString(),
    } as Message;
}

function keyEvent(id: number, action: "claim" | "release", userId = 2): Message {
    return {
        ...message(id, 9, action),
        user_id: userId,
        user: userId === 2 ? "Louis" : "Alice",
        metadata: { harmonie: { type: "classroom_key", action } },
    };
}

async function flush() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.spyOn(Math, "random").mockReturnValue(0);
    FakeSocket.instances = [];
    api.getMessages.mockReset();
    api.sendMessage.mockReset();
    emotion.classifyEmotion.mockReset();
    emotion.classifyEmotion.mockResolvedValue("neutral");
    setToken("test-token");
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it("builds the socket URL and accepts batched message events", () => {
    const url = new URL(channelSocketUrl([5, 9], "test-token"));
    expect(url.origin).toBe("ws://localhost:4000");
    expect(url.pathname).toBe("/channel/socket");
    expect(url.searchParams.getAll("channel")).toEqual(["5", "9"]);
    expect(url.searchParams.get("namespace")).toBe("harmonie");
    expect(url.searchParams.get("authorization")).toBe("test-token");
    expect(parseChannelEvents([
        '{"operation":"message.created","channel_id":5}',
        "invalid",
        '{"operation":"user.connected","id":2}',
        '{"operation":"message.edited","channel_id":9}',
    ].join("\n"))).toEqual([
        { operation: "message.created", channelId: 5 },
        { operation: "message.edited", channelId: 9 },
    ]);
    expect(parseChannelEvents(new ArrayBuffer(0))).toEqual([]);
});

it("loads messages and the key from batched socket events without replaying duplicates", async () => {
    let main = [message(1)];
    let key: Message[] = [];
    api.getMessages.mockImplementation(async (id: number) => id === 9 ? key : main);
    const { result } = renderHook(() => useChannelChat(5, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    const socket = FakeSocket.instances[0];
    expect(new URL(socket.url).searchParams.getAll("channel")).toEqual(["5", "9"]);
    expect(result.current.messages.map((item) => item.id)).toEqual([1]);
    expect(result.current.arrival).toBeNull();
    act(() => socket.open());
    await flush();

    main = [message(2), message(1)];
    key = [keyEvent(3, "claim")];
    act(() => socket.emit([
        '{"operation":"message.created","channel_id":5}',
        "invalid",
        '{"operation":"message.created","channel_id":9}',
        '{"operation":"message.created","channel_id":7}',
    ].join("\n")));
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(result.current.messages.map((item) => item.id)).toEqual([2, 1]);
    expect(result.current.arrival).toEqual({ sequence: 1, source: "poll", ids: ["2"] });
    expect(result.current.keyState).toEqual({ holderId: 2, holderName: "Louis" });

    main = [message(2, 5, "Modifié"), message(1)];
    key = [keyEvent(4, "release"), keyEvent(3, "claim")];
    act(() => socket.emit([
        '{"operation":"message.edited","channel_id":5}',
        '{"operation":"message.created","channel_id":9}',
    ].join("\n")));
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(result.current.messages[0].content).toBe("Modifié");
    expect(result.current.arrival?.sequence).toBe(1);
    expect(result.current.keyState.holderId).toBeNull();
});

it("rereads after reconnect, uses HTTP fallback, and cleans up on unmount", async () => {
    let main = [message(1, 7)];
    api.getMessages.mockImplementation(async () => main);
    const { result, unmount } = renderHook(() => useChannelChat(7, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    const first = FakeSocket.instances[0];
    expect(new URL(first.url).searchParams.getAll("channel")).toEqual(["7"]);
    act(() => first.open());
    await flush();
    act(() => first.close());
    main = [message(2, 7), message(1, 7)];
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(FakeSocket.instances).toHaveLength(2);
    act(() => FakeSocket.instances[1].open());
    await flush();
    expect(result.current.arrival?.ids).toEqual(["2"]);

    act(() => FakeSocket.instances[1].close());
    main = [message(3, 7), ...main];
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.messages.map((item) => item.id)).toEqual([3, 2, 1]);
    expect(result.current.arrival?.ids).toEqual(["3"]);
    unmount();
    const count = FakeSocket.instances.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(FakeSocket.instances).toHaveLength(count);
});

it("rereads when an event arrives during the initial snapshot", async () => {
    let finishInitial: (messages: Message[]) => void = () => {};
    let main = [message(1, 7)];
    api.getMessages.mockImplementationOnce(() => new Promise<Message[]>((resolve) => {
        finishInitial = resolve;
    })).mockImplementation(async () => main);
    const { result } = renderHook(() => useChannelChat(7, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    const socket = FakeSocket.instances[0];
    act(() => socket.open());
    main = [message(2, 7), message(1, 7)];
    act(() => socket.emit('{"operation":"message.created","channel_id":7}'));
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    await act(async () => { finishInitial([message(1, 7)]); });
    await flush();
    expect(result.current.messages.map((item) => item.id)).toEqual([2, 1]);
    expect(result.current.arrival?.ids).toEqual(["2"]);
});

it("retries a failed HTTP reread while the socket stays open", async () => {
    let main = [message(1, 7)];
    api.getMessages.mockImplementation(async () => main);
    const { result } = renderHook(() => useChannelChat(7, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    const socket = FakeSocket.instances[0];
    act(() => socket.open());
    await flush();
    main = [message(2, 7), ...main];
    api.getMessages.mockRejectedValueOnce(new Error("Lecture indisponible"));
    act(() => socket.emit('{"operation":"message.created","channel_id":7}'));
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(result.current.messages.map((item) => item.id)).toEqual([1]);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(result.current.messages.map((item) => item.id)).toEqual([2, 1]);
});

it("animates a local send once when its socket echo arrives before the HTTP response", async () => {
    let main = [message(1)];
    const own = { ...message(2, 5, "Bonjour"), user_id: 1, user: "Alice" };
    let finishSend: (sent: Message) => void = () => {};
    api.getMessages.mockImplementation(async () => main);
    api.sendMessage.mockImplementation(() => new Promise<Message>((resolve) => {
        finishSend = resolve;
    }));
    const { result } = renderHook(() => useChannelChat(5, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    const socket = FakeSocket.instances[0];
    act(() => socket.open());
    await flush();
    act(() => result.current.setContent("Bonjour"));
    let submitted: Promise<void> | undefined;
    act(() => {
        submitted = result.current.submit({ preventDefault: vi.fn() } as unknown as React.FormEvent<HTMLFormElement>);
    });
    await flush();
    expect(api.sendMessage).toHaveBeenCalledOnce();

    main = [own, ...main];
    act(() => socket.emit('{"operation":"message.created","channel_id":5}'));
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(result.current.messages.map((item) => item.id)).toEqual([2, 1]);
    expect(result.current.arrival).toBeNull();

    await act(async () => {
        finishSend(own);
        await submitted;
    });
    expect(result.current.arrival).toEqual({ sequence: 1, source: "sent", ids: ["2"] });
    act(() => socket.emit('{"operation":"message.created","channel_id":5}'));
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(result.current.arrival?.sequence).toBe(1);
});

it("pauses reconnect and fallback offline, then resubscribes on return", async () => {
    let main = [message(1, 7)];
    api.getMessages.mockImplementation(async () => main);
    const { result, rerender } = renderHook(({ id }) => useChannelChat(id, account), {
        initialProps: { id: 7 },
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    const first = FakeSocket.instances[0];
    act(() => first.open());
    await flush();
    const online = vi.spyOn(navigator, "onLine", "get");
    online.mockReturnValue(false);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(first.readyState).toBe(3);
    main = [message(2, 7), ...main];
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(FakeSocket.instances).toHaveLength(1);
    expect(result.current.messages.map((item) => item.id)).toEqual([1]);

    online.mockReturnValue(true);
    act(() => window.dispatchEvent(new Event("online")));
    expect(FakeSocket.instances).toHaveLength(2);
    act(() => FakeSocket.instances[1].open());
    await flush();
    expect(result.current.messages.map((item) => item.id)).toEqual([2, 1]);

    rerender({ id: 5 });
    await flush();
    expect(FakeSocket.instances[1].readyState).toBe(3);
    expect(new URL(FakeSocket.instances[2].url).searchParams.getAll("channel"))
        .toEqual(["5", "9"]);
});

it("resubscribes and catches up when a hidden tab becomes visible", async () => {
    let main = [message(1, 7)];
    api.getMessages.mockImplementation(async () => main);
    const { result } = renderHook(() => useChannelChat(7, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    const first = FakeSocket.instances[0];
    act(() => first.open());
    await flush();
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(first.readyState).toBe(3);
    main = [message(2, 7), ...main];
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(FakeSocket.instances).toHaveLength(1);

    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(FakeSocket.instances).toHaveLength(2);
    act(() => FakeSocket.instances[1].open());
    await flush();
    expect(result.current.messages.map((item) => item.id)).toEqual([2, 1]);
});

it("resets the key at Paris midnight", async () => {
    vi.setSystemTime(new Date("2026-11-12T22:59:58Z"));
    let key = [keyEvent(1, "claim")];
    api.getMessages.mockImplementation(async (id: number) => id === 9 ? key : []);
    const { result } = renderHook(() => useChannelChat(5, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    expect(result.current.keyState.holderId).toBe(2);
    key = [keyEvent(1, "claim")];
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(result.current.keyState.holderId).toBeNull();
});

it("arbitrates two simultaneous claims and allows only the winner to release", async () => {
    const events: Message[] = [];
    const users = [1, 2, 1];
    api.getMessages.mockImplementation(async (id: number) => id === 9 ? [...events].reverse() : []);
    api.sendMessage.mockImplementation(async (_id: number, content: string, metadata: { action: "claim" | "release" }) => {
        const userId = users.shift()!;
        const sent = { ...keyEvent(events.length + 1, metadata.action, userId), content };
        events.push(sent);
        return sent;
    });
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        <MemoryRouter>{children}</MemoryRouter>;
    const louisAccount = { ...account, id: 2, username: "Louis" };
    const alice = renderHook(() => useChannelChat(5, account), { wrapper });
    const louis = renderHook(() => useChannelChat(5, louisAccount), { wrapper });
    await flush();
    expect(alice.result.current.keyReady).toBe(true);
    expect(louis.result.current.keyReady).toBe(true);

    await act(async () => {
        await Promise.all([alice.result.current.toggleKey(), louis.result.current.toggleKey()]);
    });
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
    expect(alice.result.current.keyState.holderId).toBe(1);
    expect(louis.result.current.keyState.holderId).toBe(1);

    await act(async () => { await louis.result.current.toggleKey(); });
    expect(api.sendMessage).toHaveBeenCalledTimes(2);

    await act(async () => { await alice.result.current.toggleKey(); });
    expect(api.sendMessage).toHaveBeenCalledTimes(3);
    act(() => FakeSocket.instances[1].emit(JSON.stringify({
        ...events[2], operation: "message.created", channel_id: 9,
    })));
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(alice.result.current.keyState.holderId).toBeNull();
    expect(louis.result.current.keyState.holderId).toBeNull();
});

it("does not post a claim when the preflight read finds another holder", async () => {
    let key: Message[] = [];
    api.getMessages.mockImplementation(async (id: number) => id === 9 ? key : []);
    const { result } = renderHook(() => useChannelChat(5, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    expect(result.current.keyState.holderId).toBeNull();
    key = [keyEvent(1, "claim")];
    await act(async () => { await result.current.toggleKey(); });
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(result.current.keyState.holderId).toBe(2);
    expect(result.current.keyBusy).toBe(false);
});

it("does not carry a pending key action into another channel", async () => {
    let finishSend: (message: Message) => void = () => {};
    api.getMessages.mockResolvedValue([]);
    api.sendMessage.mockImplementation(() => new Promise<Message>((resolve) => {
        finishSend = resolve;
    }));
    const { result, rerender } = renderHook(({ id }) => useChannelChat(id, account), {
        initialProps: { id: 5 },
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    let pending: Promise<void> | undefined;
    act(() => { pending = result.current.toggleKey(); });
    await flush();
    expect(api.sendMessage).toHaveBeenCalledOnce();
    rerender({ id: 7 });
    await flush();
    expect(result.current.keyBusy).toBe(false);
    await act(async () => {
        finishSend(keyEvent(1, "claim", 1));
        await pending;
    });
    expect(result.current.keyState.holderId).toBeNull();
});

it("keeps a socket claim when an older HTTP snapshot finishes later", async () => {
    let finishInitial: (messages: Message[]) => void = () => {};
    let keyReads = 0;
    api.getMessages.mockImplementation((id: number) => {
        if (id !== 9) return Promise.resolve([]);
        if (++keyReads === 1) return new Promise<Message[]>((resolve) => { finishInitial = resolve; });
        return Promise.resolve([]);
    });
    const { result } = renderHook(() => useChannelChat(5, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    const socket = FakeSocket.instances[0];
    const payload = JSON.stringify({
        ...keyEvent(2, "claim"), operation: "message.created", channel_id: 9,
    });
    expect(parseChannelEvents(payload)[0].message?.id).toBe(2);
    act(() => socket.emit(payload));
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(result.current.keyState.holderId).toBe(2);
    await act(async () => { finishInitial([]); });
    await flush();
    expect(result.current.keyState.holderId).toBe(2);
    expect(result.current.keyReady).toBe(true);
});

it("catches a missed key change on websocket reconnect", async () => {
    let key: Message[] = [];
    api.getMessages.mockImplementation(async (id: number) => id === 9 ? key : []);
    const { result } = renderHook(() => useChannelChat(5, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    const first = FakeSocket.instances[0];
    act(() => first.open());
    await flush();
    act(() => first.close());
    key = [keyEvent(1, "claim")];
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    act(() => FakeSocket.instances[1].open());
    await flush();
    expect(result.current.keyState.holderId).toBe(2);
});

it("resets the key when a hidden tab reopens after Paris midnight", async () => {
    vi.setSystemTime(new Date("2026-11-12T22:59:58Z"));
    const claim = keyEvent(1, "claim");
    api.getMessages.mockImplementation(async (id: number) => id === 9 ? [claim] : []);
    const { result } = renderHook(() => useChannelChat(5, account), {
        wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
    });
    await flush();
    expect(result.current.keyState.holderId).toBe(2);
    const visibility = vi.spyOn(document, "visibilityState", "get");
    visibility.mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    vi.setSystemTime(new Date("2026-11-12T23:00:01Z"));
    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await flush();
    expect(result.current.keyState.holderId).toBeNull();
});
