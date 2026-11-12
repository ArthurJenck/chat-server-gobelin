import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToken } from "../../features/auth/token";
import { buildChannelStaffs, paginateChannelStaffs } from "../../features/chat/channelPagination";
import type { Message } from "../../features/messages/types";
import type { Account } from "../../features/users/types";
import { renderApp } from "../../../test/render-app";
import { server } from "../../../test/setup";

const api = "http://localhost:4000";
const emotionClassifier = vi.hoisted(() => ({ classify: vi.fn(), preload: vi.fn() }));
vi.mock("../../features/chat/emotionClient", () => ({
    classifyEmotion: emotionClassifier.classify,
    preloadEmotionModel: emotionClassifier.preload,
}));

beforeEach(() => {
    emotionClassifier.classify.mockReset();
    emotionClassifier.classify.mockRejectedValue(new Error("Modèle indisponible"));
    emotionClassifier.preload.mockReset();
    emotionClassifier.preload.mockResolvedValue(undefined);
});

const account: Account = {
    id: 1,
    username: "Alice",
    channels: [
        { id: 5, name: "ECNI 26-28", creation_date: "2026-11-01T00:00:00Z" },
        { id: 9, name: "__harmonie_cle_salle", creation_date: "2026-11-01T00:00:00Z" },
    ],
    metadata: { harmonie: { instrument: "guitar" } },
};

function message(id: number, content: string, userId = 2): Message {
    return {
        id,
        content,
        user_id: userId,
        user: userId === 1 ? "Alice" : "Louis",
        creation_date: `2026-11-11T10:${String(id).padStart(2, "0")}:00Z`,
    };
}

function mockChannel(messages: Message[], keyMessages: Message[] = [], current = account) {
    setToken("test-token");
    server.use(
        http.get(`${api}/me`, () => HttpResponse.json(current)),
        http.get(`${api}/channel/message`, ({ request }) => HttpResponse.json(
            new URL(request.url).searchParams.get("channel") === "9"
                ? keyMessages
                : messages,
        )),
    );
}

describe("Channel layout", () => {
    it("uses the sound lab syllables and notes while keeping punctuation", () => {
        const blocks = buildChannelStaffs([message(1, "Bonjour !")], 360);

        expect(blocks).toHaveLength(1);
        expect(blocks[0].row.map((group) => group.text).join("")).toBe("Bonjour!");
        expect(blocks[0].row[0].x).toBe(20);
        expect(blocks[0].row[0].y).toBeGreaterThanOrEqual(0);
        expect(blocks[0].row[0].y).toBeLessThanOrEqual(40);
        expect(buildChannelStaffs([message(2, "!!!")], 360)[0].row[0].text).toBe("!!!");
    });

    it("splits a long message between staves and puts the newest page first", () => {
        const blocks = buildChannelStaffs([
            message(2, "Dernier message"),
            message(1, "Bonjour tout le monde ".repeat(12)),
        ], 360);
        const pages = paginateChannelStaffs(blocks, 140);

        expect(blocks.length).toBeGreaterThan(2);
        expect(blocks[0].first).toBe(true);
        expect(blocks[1].first).toBe(false);
        expect(pages.length).toBeGreaterThan(1);
        expect(pages[0].at(-1)?.message.id).toBe(2);
        expect(pages[0].length).toBeGreaterThan(1);
        expect(pages.flat()).toHaveLength(blocks.length);
        expect(pages.every((page) => page.reduce((height, block, index) =>
            height + (index ? 20 : 0) + 40 + (block.first ? 20 : 0), 0) <= 140)).toBe(true);
    });
});

describe("Channel page", () => {
    let messageAreaHeight = 600;
    const originalHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    const originalWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");

    beforeEach(() => {
        messageAreaHeight = 600;
        Object.defineProperty(HTMLElement.prototype, "clientHeight", {
            configurable: true,
            get() { return this.classList.contains("channel-messages") ? messageAreaHeight : 0; },
        });
        Object.defineProperty(HTMLElement.prototype, "clientWidth", {
            configurable: true,
            get() { return this.classList.contains("channel-messages") || this.classList.contains("channel-messages-scroller") ? 360 : 0; },
        });
    });

    it("follows the visible viewport and locks document scrolling while open", async () => {
        const originalViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
        const visualViewport = new EventTarget();
        Object.defineProperty(visualViewport, "height", { configurable: true, value: 800 });
        Object.defineProperty(visualViewport, "offsetTop", { configurable: true, value: 0 });
        Object.defineProperty(window, "visualViewport", { configurable: true, value: visualViewport });
        mockChannel([]);

        try {
            const page = renderApp("/channels/5");
            expect(document.documentElement.style.overflow).toBe("hidden");
            expect(document.body.style.overflow).toBe("hidden");
            expect(document.querySelector(".channel-page")).toHaveStyle({ height: "800px", top: "0px" });

            Object.defineProperty(visualViewport, "height", { configurable: true, value: 450 });
            Object.defineProperty(visualViewport, "offsetTop", { configurable: true, value: 120 });
            visualViewport.dispatchEvent(new Event("resize"));
            visualViewport.dispatchEvent(new Event("scroll"));
            await waitFor(() => expect(document.querySelector(".channel-page"))
                .toHaveStyle({ height: "450px", top: "120px" }));
            expect(document.querySelector(".channel-page")).toHaveAttribute("data-keyboard-open", "true");

            page.unmount();
            expect(document.documentElement.style.overflow).toBe("");
            expect(document.body.style.overflow).toBe("");
        } finally {
            if (originalViewport) Object.defineProperty(window, "visualViewport", originalViewport);
            else Reflect.deleteProperty(window, "visualViewport");
        }
    });

    it("classifies an old message once and reuses its local result", async () => {
        emotionClassifier.classify.mockResolvedValue("sadness");
        mockChannel([message(1, "Je suis triste")]);
        const first = renderApp("/channels/5");
        await waitFor(() => expect(document.querySelector(".channel-message"))
            .toHaveStyle({ "--channel-key-color": "#FF0004" }));
        expect(emotionClassifier.classify).toHaveBeenCalledOnce();
        first.unmount();
        emotionClassifier.classify.mockClear();

        renderApp("/channels/5");
        await waitFor(() => expect(document.querySelector(".channel-message"))
            .toHaveStyle({ "--channel-key-color": "#FF0004" }));
        expect(emotionClassifier.classify).not.toHaveBeenCalled();
    });

    it("uses a saved emotion without reclassifying the message", async () => {
        mockChannel([{
            ...message(1, "J'ai peur"),
            metadata: { harmonie: { music_root: 0, music_mode: "major", emotion: "fear" } },
        }]);
        renderApp("/channels/5");
        await waitFor(() => expect(document.querySelector(".channel-message"))
            .toHaveStyle({ "--channel-key-color": "#FF0004" }));
        expect(emotionClassifier.classify).not.toHaveBeenCalled();
    });

    it("changes the gradient with the visible page's emotion", async () => {
        messageAreaHeight = 120;
        mockChannel([
            {
                ...message(1, "Merci"),
                metadata: { harmonie: { music_root: 0, music_mode: "major", emotion: "joy" } },
            },
            {
                ...message(2, "J'ai peur"),
                metadata: { harmonie: { music_root: 0, music_mode: "major", emotion: "fear" } },
            },
        ]);
        renderApp("/channels/5");
        await waitFor(() => expect(document.querySelectorAll(".channel-sheet")).toHaveLength(2));
        await waitFor(() => expect(document.querySelector(".channel-page"))
            .toHaveStyle({ "--channel-key-color": "#FF0004" }));
        const scroller = screen.getByRole("region", { name: "Messages" });
        scroller.scrollLeft = 0;
        fireEvent.scroll(scroller);
        await waitFor(() => expect(document.querySelector(".channel-page"))
            .toHaveStyle({ "--channel-key-color": "#4DF8E7" }));
    });

    it("waits for a page to become visible before classifying its old messages", async () => {
        messageAreaHeight = 120;
        emotionClassifier.classify.mockResolvedValue("fear");
        mockChannel([
            message(1, "Ancien"),
            {
                ...message(2, "Récent"),
                metadata: { harmonie: { music_root: 0, music_mode: "major", emotion: "joy" } },
            },
        ]);
        renderApp("/channels/5");
        await waitFor(() => expect(document.querySelectorAll(".channel-sheet")).toHaveLength(2));
        expect(emotionClassifier.classify).not.toHaveBeenCalled();
        const scroller = screen.getByRole("region", { name: "Messages" });
        scroller.scrollLeft = 0;
        fireEvent.scroll(scroller);
        await waitFor(() => expect(emotionClassifier.classify).toHaveBeenCalledWith("Ancien"));
        await waitFor(() => expect(document.querySelector(".channel-page"))
            .toHaveStyle({ "--channel-key-color": "#FF0004" }));
    });

    afterEach(() => {
        if (originalHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", originalHeight);
        if (originalWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalWidth);
    });

    it("renders the supplied pictograms and current author without a key in other groups", async () => {
        mockChannel([message(1, "J'ai les clés !"), message(2, "Merci !!!", 1)]);
        renderApp("/channels/5");

        expect(await screen.findByRole("heading", { name: "ECNI 26-28" })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText("Moi")).toBeInTheDocument());
        expect(screen.getByRole("link", { name: "Retour aux channels" })).toHaveAttribute("href", "/");
        expect(document.querySelector(".channel-back img")).toHaveAttribute("src", "/pictos/arrow.svg");
        expect(document.querySelector(".channel-key-star")).toBeNull();
        expect(document.querySelector(".channel-key-symbol")).toBeNull();
        expect(document.querySelector(".channel-message-author-own img")).toHaveAttribute("src", "/pictos/note.svg");
        expect(document.querySelectorAll(".channel-staff-coda")).toHaveLength(4);
        expect(screen.queryByRole("checkbox", { name: "Clé récupérée" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("link", { name: "Retour aux channels" }));
        expect(await screen.findByRole("heading", { name: "Mes partitions" })).toBeInTheDocument();
    });

    it("shows an anonymous whole rest without an author or playback", async () => {
        mockChannel([{
            ...message(1, ""),
            creation_date: new Date().toISOString(),
            user: "anonymous",
            anonymous: true,
            metadata: { harmonie: { type: "conversation_rest", music_root: 1, music_mode: "major" } },
        }]);
        renderApp("/channels/5");
        await waitFor(() => expect(document.querySelector(".channel-rest img"))
            .toHaveAttribute("src", "/pictos/silence.svg"));
        expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
        expect(document.querySelector(".channel-message-author")).toBeNull();
        await waitFor(() => expect(document.querySelector(".channel-page"))
            .toHaveStyle({ "--channel-key-color": "#FFA200" }));
    });

    it("shows the key over the star in general and locks it when another user holds it", async () => {
        mockChannel([], [{
            ...message(1, "Clé récupérée"),
            creation_date: new Date().toISOString(),
            metadata: { harmonie: { type: "classroom_key", action: "claim" } },
        }], {
            ...account,
            channels: [
                { ...account.channels![0], name: "general" },
                account.channels![1],
            ],
        });
        renderApp("/channels/5");

        const checkbox = await screen.findByRole("checkbox", { name: "Clé récupérée" });
        await waitFor(() => expect(checkbox).toBeChecked());
        expect(checkbox).toBeDisabled();
        expect(document.querySelector(".channel-key-symbol")).toHaveAttribute("src", "/pictos/key.svg");
    });

    it("repaginates on resize and scrolls several pages with one wheel movement", async () => {
        messageAreaHeight = 300;
        mockChannel(Array.from({ length: 12 }, (_, index) => message(index + 1, `Message ${index + 1}`)));
        renderApp("/channels/5");

        await waitFor(() => expect(document.querySelectorAll(".channel-sheet").length).toBeGreaterThan(2));
        const initialCount = document.querySelectorAll(".channel-sheet").length;
        const scroller = screen.getByRole("region", { name: "Messages" });
        await waitFor(() => expect(scroller.scrollLeft).toBe((initialCount - 1) * 360));
        fireEvent.wheel(scroller, { deltaY: 720, deltaX: 0 });
        expect(scroller.scrollLeft).toBe((initialCount - 1) * 360 - 720);
        fireEvent.scroll(scroller);
        expect(document.querySelectorAll(".channel-sheet[aria-hidden='false']")).toHaveLength(1);
        const active = document.querySelector<HTMLOListElement>(".channel-sheet[aria-hidden='false']");
        expect(active?.inert).toBe(false);
        expect(document.querySelector(".channel-sheet")?.getAttribute("style")).toContain("rotateY");
        messageAreaHeight = 180;
        const originalWindowHeight = window.innerHeight;
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
        fireEvent(window, new Event("resize"));
        await waitFor(() => expect(document.querySelectorAll(".channel-sheet").length).toBeGreaterThan(initialCount));
        expect(document.querySelector(".channel-page")).toHaveAttribute("data-keyboard-open", "true");
        Object.defineProperty(window, "innerHeight", { configurable: true, value: originalWindowHeight });
    });

    it("places newer page dots on the right and follows manual scrolling", async () => {
        messageAreaHeight = 120;
        mockChannel(Array.from({ length: 8 }, (_, index) => message(index + 1, `Message ${index + 1}`)));
        renderApp("/channels/5");

        await waitFor(() => expect(document.querySelectorAll(".channel-sheet")).toHaveLength(8));
        const scroller = screen.getByRole("region", { name: "Messages" });
        const pagination = screen.getByRole("navigation", { name: "Pages des messages" });
        expect(pagination.previousElementSibling).toHaveClass("channel-messages");
        expect(pagination.nextElementSibling).toHaveClass("channel-composer");
        expect(within(pagination).getAllByRole("button")).toHaveLength(5);
        expect(within(pagination).getAllByRole("button").map((button) => button.getAttribute("aria-label")))
            .toEqual([5, 4, 3, 2, 1].map((page) => `Aller à la page ${page} sur 8`));
        expect(screen.getByRole("button", { name: "Aller à la page 1 sur 8" }))
            .toHaveAttribute("aria-current", "page");

        await userEvent.click(screen.getByRole("button", { name: "Aller à la page 5 sur 8" }));
        await waitFor(() => expect(scroller.scrollLeft).toBe(3 * 360), { timeout: 2500 });
        expect(screen.getByRole("button", { name: "Aller à la page 5 sur 8" }))
            .toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("button", { name: "Aller à la page 3 sur 8" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Aller à la page 7 sur 8" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Aller à la page 1 sur 8" })).not.toBeInTheDocument();
        expect(within(pagination).getAllByRole("button").map((button) => button.getAttribute("aria-label")))
            .toEqual([7, 6, 5, 4, 3].map((page) => `Aller à la page ${page} sur 8`));

        scroller.scrollLeft = 360;
        fireEvent.scroll(scroller);
        expect(screen.getByRole("button", { name: "Aller à la page 7 sur 8" }))
            .toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("button", { name: "Aller à la page 8 sur 8" })).toBeInTheDocument();
    });

    it("forwards a click through a turned sheet to its visible staff", async () => {
        messageAreaHeight = 120;
        mockChannel([message(1, "Ancien"), message(2, "Deuxième"), message(3, "Troisième")]);
        renderApp("/channels/5");
        await waitFor(() => expect(document.querySelectorAll(".channel-sheet")).toHaveLength(3));

        const scroller = screen.getByRole("region", { name: "Messages" });
        scroller.scrollLeft = 0;
        fireEvent.scroll(scroller);
        const active = document.querySelector(".channel-sheet[aria-hidden='false']")!;
        const staff = active.querySelector<HTMLButtonElement>(".channel-staff")!;
        vi.spyOn(staff, "getBoundingClientRect").mockReturnValue(
            DOMRect.fromRect({ x: 10, y: 10, width: 100, height: 40 }),
        );
        const click = vi.spyOn(staff, "click").mockImplementation(() => {});
        const stage = document.querySelector<HTMLDivElement>(".channel-page-stage")!;

        fireEvent.pointerMove(stage, { clientX: 50, clientY: 30, pointerType: "mouse" });
        expect(stage).toHaveStyle({ cursor: "pointer" });
        fireEvent.pointerDown(stage, { clientX: 50, clientY: 30 });
        expect(staff).toHaveAttribute("data-pressed");
        fireEvent.pointerUp(stage);
        expect(staff).not.toHaveAttribute("data-pressed");

        fireEvent.click(stage, {
            clientX: 50,
            clientY: 30,
        });
        expect(click).toHaveBeenCalledOnce();
        fireEvent.pointerMove(stage, { clientX: 50, clientY: 60, pointerType: "mouse" });
        expect(stage).not.toHaveStyle({ cursor: "pointer" });
    });

    it("turns from an older page to the sent message after sending", async () => {
        messageAreaHeight = 120;
        emotionClassifier.classify.mockResolvedValue("neutral");
        const messages = Array.from({ length: 4 }, (_, index) => ({
            ...message(index + 1, `Message ${index + 1}`),
            creation_date: new Date(Date.now() - (4 - index) * 60_000).toISOString(),
            metadata: { harmonie: { emotion: "neutral" } },
        }));
        mockChannel(messages);
        server.use(http.post(`${api}/channel/message`, async ({ request }) => {
            const sent = await request.json() as { content: string };
            messages.push({
                ...message(5, sent.content, 1),
                creation_date: new Date().toISOString(),
                metadata: { harmonie: { emotion: "neutral" } },
            });
            return HttpResponse.json(messages.at(-1));
        }));
        renderApp("/channels/5");

        await waitFor(() => expect(document.querySelectorAll(".channel-sheet")).toHaveLength(4));
        const scroller = screen.getByRole("region", { name: "Messages" });
        scroller.scrollLeft = 0;
        fireEvent.scroll(scroller);
        expect(screen.getByRole("button", { name: "Aller à la page 4 sur 4" }))
            .toHaveAttribute("aria-current", "page");

        await userEvent.type(screen.getByLabelText("Message"), "Mon nouveau message");
        await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));

        await waitFor(() => expect(document.querySelectorAll(".channel-sheet")).toHaveLength(5));
        await waitFor(() => expect(scroller.scrollLeft).toBeGreaterThan(0));
        expect(scroller.scrollLeft).toBeLessThan(4 * 360);
        await waitFor(() => expect(scroller.scrollLeft).toBe(4 * 360), { timeout: 3000 });
        expect(screen.getByRole("button", { name: "Aller à la page 1 sur 5" }))
            .toHaveAttribute("aria-current", "page");
        expect(Array.from(
            document.querySelectorAll(".channel-sheet[aria-hidden='false'] .channel-syllable p"),
            (node) => node.textContent,
        ).join("")).toBe("Monnouveaumessage");
    });
});
