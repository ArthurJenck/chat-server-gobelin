import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderApp } from "./render-app";

it("offers installation when the browser makes it available", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(
        new Event("beforeinstallprompt", { cancelable: true }),
        {
            prompt,
            userChoice: Promise.resolve({ outcome: "accepted" }),
        },
    );

    renderApp("/login");
    window.dispatchEvent(event);
    await userEvent.click(
        await screen.findByRole("button", { name: "Installer l’application" }),
    );

    expect(event.defaultPrevented).toBe(true);
    expect(prompt).toHaveBeenCalledOnce();
    await waitFor(() =>
        expect(
            screen.queryByRole("button", { name: "Installer l’application" }),
        ).not.toBeInTheDocument(),
    );
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
