import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { setToken } from "../../features/auth/token";
import { renderApp } from "../../../test/render-app";
import { server } from "../../../test/setup";

const api = "http://localhost:4000";

describe("Confirmation page", () => {
    it("shows the selected details and returns to the previous page", async () => {
        renderApp("/register");
        await userEvent.type(screen.getByLabelText("Nom d’utilisateur :"), "Laia Crossing");
        await userEvent.type(screen.getByLabelText("Mot de passe :"), "secret");
        await userEvent.type(screen.getByLabelText("Confirmer le mot de passe :"), "secret");
        await userEvent.click(screen.getByRole("button", { name: "Continuer" }));
        await userEvent.click(await screen.findByRole("radio", { name: "Harpe" }));
        await userEvent.click(screen.getByRole("button", { name: "Continuer" }));

        expect(screen.getByRole("heading", { name: "Tu fais partie de la communauté Harmonie" })).toBeInTheDocument();
        expect(screen.getByText("Laia Crossing")).toBeInTheDocument();
        expect(screen.getByText("Harpe")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Retour" }).querySelector("img")).toHaveAttribute("src", "/pictos/arrow.svg");
        expect(screen.getByRole("button", { name: "Continuer" }).querySelector("img")).toHaveAttribute("src", "/pictos/arrow.svg");
        await userEvent.click(screen.getByRole("button", { name: "Retour" }));

        expect(await screen.findByRole("heading", { name: "Choisis ton instrument" })).toBeInTheDocument();
        expect(screen.getByRole("radio", { name: "Harpe" })).toBeChecked();
    });

    it.each(["/profil/instrument", "/profil/confirmation"])(
        "returns to registration when %s is reopened without pending details",
        async (path) => {
            const { router } = renderApp(path);
            await waitFor(() => expect(router.state.location.pathname).toBe("/register"));
        },
    );

    it("saves an edited instrument on confirmation and opens the profile", async () => {
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
            http.post(`${api}/user/edit`, async ({ request }) => {
                saved = await request.json();
                current.metadata.harmonie.instrument = "harp";
                return HttpResponse.json(current);
            }),
        );
        renderApp("/profil/instrument");
        await userEvent.click(await screen.findByRole("radio", { name: "Harpe" }));
        await userEvent.click(screen.getByRole("button", { name: "Continuer" }));

        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Harpe")).toBeInTheDocument();
        expect(saved).toBeUndefined();
        await userEvent.click(screen.getByRole("button", { name: "Continuer" }));

        expect(await screen.findByRole("heading", { name: "Profil" })).toBeInTheDocument();
        expect(saved).toEqual({ metadata: { instrument: "harp" } });
    });
});
