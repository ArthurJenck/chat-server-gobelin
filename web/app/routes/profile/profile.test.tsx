import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { getToken, setToken } from "../../features/auth/token";
import { renderApp } from "../../../test/render-app";
import { server } from "../../../test/setup";

const api = "http://localhost:4000";

function mockAccount(username = "Laia", instrument = "harp") {
    server.use(
        http.get(`${api}/me`, () =>
            HttpResponse.json({
                id: 1,
                username,
                channels: [],
                metadata: { harmonie: { instrument } },
            }),
        ),
    );
    setToken("valid-token");
}

describe("Profile page", () => {
    it("shows the mockup content as read-only account details", async () => {
        mockAccount();
        const { container } = renderApp("/profil");

        expect(await screen.findByRole("heading", { name: "Mon pupitre" })).toBeInTheDocument();
        expect(screen.getByText("Nom d’utilisateur :")).toBeInTheDocument();
        expect(await screen.findByText("Laia")).toBeInTheDocument();
        expect(screen.getByText("Instrument :")).toBeInTheDocument();
        expect(screen.getByText("Harpe")).toBeInTheDocument();
        expect(container.querySelector(".profile-details input")).toBeNull();
        expect(container.querySelectorAll(".profile-value")).toHaveLength(2);
        expect(screen.getByRole("button", { name: "Retour" }).querySelector("img"))
            .toHaveAttribute("src", "/pictos/arrow.svg");
        expect(screen.getByRole("link", { name: "Je veux changer d’instrument" }))
            .toHaveAttribute("href", "/profil/instrument");
        expect(screen.getByRole("button", { name: "Me déconnecter" })).toBeInTheDocument();
    });

    it("selects the current instrument, saves the new one after validation, and shows it on return", async () => {
        setToken("valid-token");
        let saved: unknown;
        const current = {
            id: 1,
            username: "Alice",
            channels: [],
            metadata: { harmonie: { instrument: "guitar" } },
        };
        server.use(
            http.get(`${api}/me`, () => HttpResponse.json(current)),
            http.put(`${api}/user`, async ({ request }) => {
                saved = await request.json();
                current.metadata.harmonie.instrument = "harp";
                return HttpResponse.json(current);
            }),
        );
        const { router } = renderApp("/profil");

        await userEvent.click(await screen.findByRole("link", { name: "Je veux changer d’instrument" }));
        await waitFor(() => expect(router.state.location.pathname).toBe("/profil/instrument"));
        expect(await screen.findByRole("radio", { name: "Guitare" })).toBeChecked();
        await userEvent.click(screen.getByRole("radio", { name: "Harpe" }));
        expect(saved).toBeUndefined();
        await userEvent.click(screen.getByRole("button", { name: "Valider" }));

        await waitFor(() => expect(router.state.location.pathname).toBe("/profil"));
        expect(await screen.findByText("Harpe")).toBeInTheDocument();
        expect(saved).toEqual({ metadata: { instrument: "harp" } });
    });

    it("returns without saving when instrument selection is cancelled", async () => {
        mockAccount("Alice", "guitar");
        let saved: unknown;
        server.use(
            http.put(`${api}/user`, async ({ request }) => {
                saved = await request.json();
                return HttpResponse.json({});
            }),
        );
        const { router } = renderApp("/profil");

        await userEvent.click(await screen.findByRole("link", { name: "Je veux changer d’instrument" }));
        await userEvent.click(await screen.findByRole("radio", { name: "Harpe" }));
        await userEvent.click(screen.getByRole("button", { name: "Retour" }));

        await waitFor(() => expect(router.state.location.pathname).toBe("/profil"));
        expect(await screen.findByText("Guitare")).toBeInTheDocument();
        expect(saved).toBeUndefined();
        await userEvent.click(screen.getByRole("link", { name: "Je veux changer d’instrument" }));
        expect(await screen.findByRole("radio", { name: "Guitare" })).toBeChecked();
    });

    it("returns home from the back button", async () => {
        mockAccount();
        const { router } = renderApp("/profil");

        await userEvent.click(await screen.findByRole("button", { name: "Retour" }));

        await waitFor(() => expect(router.state.location.pathname).toBe("/"));
        expect(await screen.findByRole("heading", { name: "Mes partitions" })).toBeInTheDocument();
    });

    it("clears the session and returns to welcome on logout", async () => {
        mockAccount();
        const { router } = renderApp("/profil");

        await userEvent.click(await screen.findByRole("button", { name: "Me déconnecter" }));

        await waitFor(() => expect(router.state.location.pathname).toBe("/bienvenue"));
        expect(getToken()).toBeNull();
        expect(await screen.findByRole("heading", { name: "Bienvenue à Harmonie" }))
            .toBeInTheDocument();
    });
});
