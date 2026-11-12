import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { setToken } from "../../features/auth/token";
import { KEY_CHANNEL_NAME } from "../../shared/config";
import { renderApp } from "../../../test/render-app";
import { server } from "../../../test/setup";

const api = "http://localhost:4000";

function mockAccount() {
    const channels = [{ id: 99, name: KEY_CHANNEL_NAME }];
    setToken("valid-token");
    server.use(
        http.get(`${api}/me`, () => HttpResponse.json({
            id: 1,
            username: "Alice",
            channels,
            metadata: { harmonie: { instrument: "harp" } },
        })),
        http.get(`${api}/channel/message`, () => HttpResponse.json([])),
    );
    return channels;
}

describe("New orchestra pages", () => {
    it("shows the two choices and opens the matching forms", async () => {
        mockAccount();
        const { router } = renderApp("/groupes/nouveau");

        expect(screen.getByRole("heading", { name: "Nouvel orchestre" })).toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Retour" }).querySelector("img"))
            .toHaveAttribute("src", "/pictos/arrow.svg");
        expect(screen.getByRole("button", { name: "Rejoindre" }).querySelector("img"))
            .toHaveAttribute("src", "/pictos/arrow.svg");
        expect(screen.getByRole("button", { name: "Créer" }).querySelector("img"))
            .toHaveAttribute("src", "/pictos/arrow.svg");

        await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));
        expect(router.state.location.pathname).toBe("/groupes/nouveau/rejoindre");
        expect(screen.getByRole("heading", { name: "Rejoindre un orchestre" })).toBeInTheDocument();
        expect(screen.getByLabelText("Nom de l’orchestre :"))
            .toHaveAttribute("placeholder", "team_raclette");
        expect(screen.getByRole("button", { name: "Rejoindre" })).toBeDisabled();

        await userEvent.click(screen.getByRole("button", { name: "Retour" }));
        expect(router.state.location.pathname).toBe("/groupes/nouveau");
        await userEvent.click(screen.getByRole("button", { name: "Créer" }));
        expect(router.state.location.pathname).toBe("/groupes/nouveau/creer");
        expect(screen.getByRole("heading", { name: "Créer un orchestre" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Créer" })).toBeDisabled();

        await userEvent.type(screen.getByLabelText("Nom de l’orchestre :"), "Essai");
        await userEvent.click(screen.getByRole("button", { name: "Retour" }));
        await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));
        expect(screen.getByLabelText("Nom de l’orchestre :")).toHaveValue("");
    });

    it("joins an orchestra through the enter endpoint", async () => {
        const channels = mockAccount();
        const requests: Array<{ path: string; body: unknown }> = [];
        server.use(
            http.post(`${api}/channel/enter`, async ({ request }) => {
                requests.push({ path: new URL(request.url).pathname, body: await request.json() });
                channels.push({ id: 12, name: "Soirée Overcooked" });
                return HttpResponse.json({ id: 12, name: "Soirée Overcooked" });
            }),
            http.post(`${api}/channel`, async ({ request }) => {
                requests.push({ path: new URL(request.url).pathname, body: await request.json() });
                return new HttpResponse(null, { status: 500 });
            }),
        );
        const { router } = renderApp("/groupes/nouveau/rejoindre");

        await userEvent.type(screen.getByLabelText("Nom de l’orchestre :"), " Soirée Overcooked ");
        await waitFor(() => expect(screen.getByRole("button", { name: "Rejoindre" })).toBeEnabled());
        await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));

        await waitFor(() => expect(router.state.location.pathname).toBe("/channels/12"));
        expect(requests).toEqual([{
            path: "/channel/enter",
            body: { channel: "Soirée Overcooked" },
        }]);
    });

    it("creates an orchestra through the create endpoint", async () => {
        const channels = mockAccount();
        const requests: Array<{ path: string; body: unknown }> = [];
        server.use(
            http.post(`${api}/channel`, async ({ request }) => {
                requests.push({ path: new URL(request.url).pathname, body: await request.json() });
                channels.push({ id: 13, name: "Soirée Overcooked" });
                return HttpResponse.json({ id: 13, name: "Soirée Overcooked" });
            }),
            http.post(`${api}/channel/enter`, async ({ request }) => {
                requests.push({ path: new URL(request.url).pathname, body: await request.json() });
                return new HttpResponse(null, { status: 500 });
            }),
        );
        const { router } = renderApp("/groupes/nouveau/creer");

        await userEvent.type(screen.getByLabelText("Nom de l’orchestre :"), " Soirée Overcooked ");
        await waitFor(() => expect(screen.getByRole("button", { name: "Créer" })).toBeEnabled());
        await userEvent.click(screen.getByRole("button", { name: "Créer" }));

        await waitFor(() => expect(router.state.location.pathname).toBe("/channels/13"));
        expect(requests).toEqual([{
            path: "/channel",
            body: { name: "Soirée Overcooked", metadata: {} },
        }]);
    });

    it("shows request errors with the shared login error class and keeps the form", async () => {
        mockAccount();
        server.use(http.post(`${api}/channel/enter`, () => new HttpResponse(null, { status: 500 })));
        renderApp("/groupes/nouveau/rejoindre");

        const name = screen.getByLabelText("Nom de l’orchestre :");
        await userEvent.type(name, "Absent");
        await waitFor(() => expect(screen.getByRole("button", { name: "Rejoindre" })).toBeEnabled());
        await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));

        expect(await screen.findByRole("alert")).toHaveClass("form-error");
        expect(name).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("heading", { name: "Rejoindre un orchestre" })).toBeInTheDocument();
    });
});
