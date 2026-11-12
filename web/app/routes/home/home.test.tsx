import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { setToken } from "../../features/auth/token";
import { renderApp } from "../../../test/render-app";
import { server } from "../../../test/setup";

const channels = [
    { id: 3, name: "Thierry :)" },
    { id: 8, name: "ECNI 26-28" },
    { id: 10, name: "Team raclette" },
    { id: 12, name: "Arwen" },
    { id: 99, name: "__harmonie_cle_salle" },
];

function showHome() {
    setToken("valid-token");
    server.use(
        http.get("http://localhost:4000/me", () =>
            HttpResponse.json({
                id: 1,
                username: "Alice",
                channels,
                metadata: { harmonie: { instrument: "harp" } },
            }),
        ),
        http.get("http://localhost:4000/channel/message", () =>
            HttpResponse.json([]),
        ),
    );
    return renderApp("/");
}

describe("Home page", () => {
    it("shows the user's channels as notebooks with the exported artwork and cover tones", async () => {
        const { container } = showHome();

        expect(
            screen.getByRole("heading", { name: "Mes partitions" }),
        ).toBeInTheDocument();
        const notebooks = await screen.findAllByRole("listitem");
        expect(notebooks).toHaveLength(4);
        expect(
            notebooks.map(
                (notebook) =>
                    within(notebook)
                        .getByRole("link")
                        .querySelector(".home-notebook-name")?.textContent,
            ),
        ).toEqual(["Thierry :)", "ECNI 26-28", "Team raclette", "Arwen"]);
        expect(notebooks.map((notebook) => notebook.className)).toEqual([
            "home-notebook home-notebook--dark",
            "home-notebook home-notebook--medium",
            "home-notebook home-notebook--light",
            "home-notebook home-notebook--dark",
        ]);
        expect(
            container.querySelectorAll(".home-notebook-art svg"),
        ).toHaveLength(4);
        expect(
            container.querySelector(".home-notebook-art svg rect"),
        ).toHaveAttribute("fill", "var(--notebook-cover, #4F4F4F)");
        expect(
            container.querySelectorAll(
                '.home-notebook-group[src="/pictos/group.svg"]',
            ),
        ).toHaveLength(4);
    });

    it("links the profile, group creation, and a selected notebook to their existing routes", async () => {
        const { router } = showHome();
        await screen.findByRole("link", { name: "Thierry :)" });

        expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute(
            "href",
            "/profil",
        );
        expect(
            screen.getByRole("link", { name: "Profil" }).querySelector("img"),
        ).toHaveAttribute("src", "/pictos/profile.svg");
        expect(
            screen.getByRole("link", { name: "Ajouter un groupe" }),
        ).toHaveAttribute("href", "/groupes/nouveau");
        expect(
            screen.getByRole("link", { name: "Team raclette" }),
        ).toHaveAttribute("href", "/channels/10");

        await userEvent.click(
            screen.getByRole("link", { name: "Team raclette" }),
        );
        await waitFor(() =>
            expect(router.state.location.pathname).toBe("/channels/10"),
        );
    });

    it("moves the scroll marker and switches the edge fade while browsing notebooks", async () => {
        const { container } = showHome();
        await screen.findAllByRole("listitem");
        const scrollArea = container.querySelector<HTMLElement>(
            ".home-notebooks-scroll",
        )!;
        Object.defineProperty(scrollArea, "clientHeight", {
            configurable: true,
            value: 500,
        });
        Object.defineProperty(scrollArea, "scrollHeight", {
            configurable: true,
            value: 1000,
        });

        fireEvent.scroll(scrollArea);
        expect(container.querySelector(".home-notebooks")).toHaveClass(
            "home-notebooks--fade-bottom",
        );
        expect(container.querySelector(".home-notebooks")).not.toHaveClass(
            "home-notebooks--fade-top",
        );
        expect(container.querySelector(".home-scroll-indicator")).toHaveStyle({
            top: "0px",
        });

        scrollArea.scrollTop = 500;
        fireEvent.scroll(scrollArea);
        expect(container.querySelector(".home-notebooks")).toHaveClass(
            "home-notebooks--fade-top",
        );
        expect(container.querySelector(".home-notebooks")).not.toHaveClass(
            "home-notebooks--fade-bottom",
        );
        expect(container.querySelector(".home-scroll-indicator")).toHaveStyle({
            top: "460px",
        });
    });
});
