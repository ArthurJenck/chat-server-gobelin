import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setToken } from "../../features/auth/token";
import { buildChannelStaffs, paginateChannelStaffs } from "../../features/chat/channelPagination";
import type { Message } from "../../features/messages/types";
import type { Account } from "../../features/users/types";
import { renderApp } from "../../../test/render-app";
import { server } from "../../../test/setup";

const api = "http://localhost:4000";
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

function mockChannel(messages: Message[], keyMessages: Message[] = []) {
    setToken("test-token");
    server.use(
        http.get(`${api}/me`, () => HttpResponse.json(account)),
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
            get() { return this.classList.contains("channel-messages") ? 360 : 0; },
        });
    });

    afterEach(() => {
        if (originalHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", originalHeight);
        if (originalWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", originalWidth);
    });

    it("renders the supplied pictograms, key state and current author", async () => {
        mockChannel([message(1, "J'ai les clés !"), message(2, "Merci !!!", 1)]);
        renderApp("/channels/5");

        expect(await screen.findByRole("heading", { name: "ECNI 26-28" })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByText("Moi")).toBeInTheDocument());
        expect(screen.getByRole("link", { name: "Retour aux channels" })).toHaveAttribute("href", "/");
        expect(document.querySelector(".channel-back img")).toHaveAttribute("src", "/pictos/arrow.svg");
        expect(document.querySelector(".channel-key-star")).toHaveAttribute("src", "/pictos/star.svg");
        expect(document.querySelector(".channel-key-symbol")).toBeNull();
        expect(document.querySelector(".channel-message-author-own img")).toHaveAttribute("src", "/pictos/note.svg");
        expect(document.querySelectorAll(".channel-staff-coda")).toHaveLength(4);
        expect(screen.getByRole("checkbox", { name: "Clé récupérée" })).not.toBeChecked();
        await userEvent.click(screen.getByRole("link", { name: "Retour aux channels" }));
        expect(await screen.findByRole("heading", { name: "Mes groupes" })).toBeInTheDocument();
    });

    it("shows the key over the star and locks it when another user holds it", async () => {
        mockChannel([], [{
            ...message(1, "Clé récupérée"),
            creation_date: new Date().toISOString(),
            metadata: { harmonie: { type: "classroom_key", action: "claim" } },
        }]);
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
        messageAreaHeight = 180;
        const originalWindowHeight = window.innerHeight;
        Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
        fireEvent(window, new Event("resize"));
        await waitFor(() => expect(document.querySelectorAll(".channel-sheet").length).toBeGreaterThan(initialCount));
        expect(document.querySelector(".channel-page")).toHaveAttribute("data-keyboard-open", "true");
        Object.defineProperty(window, "innerHeight", { configurable: true, value: originalWindowHeight });
    });
});
