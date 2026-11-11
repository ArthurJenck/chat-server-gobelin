import { act, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderApp } from "./render-app";

it("leaves installation prompts to the browser", () => {
    const event = new Event("beforeinstallprompt", { cancelable: true });

    renderApp("/login");
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(
        screen.queryByRole("button", { name: "Installer l’application" }),
    ).not.toBeInTheDocument();
});

it("shows when the network connection is unavailable", () => {
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    try {
        renderApp("/login");
        act(() => window.dispatchEvent(new Event("offline")));

        expect(screen.getByRole("status")).toHaveTextContent(
            "Connexion indisponible",
        );

        online.mockReturnValue(true);
        act(() => window.dispatchEvent(new Event("online")));

        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
        online.mockRestore();
    }
});
