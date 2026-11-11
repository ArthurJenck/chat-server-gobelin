import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "../app/features/users/types";
import { setToken } from "../app/features/auth/token";
import { keyStateFromMessages } from "../app/features/key/keyState";
import { renderApp } from "./render-app";
import { server } from "./setup";

const playback = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("../app/features/sound/audioEngine", () => ({
    startPlayback: playback.start,
}));

const api = "http://localhost:4000";
const general = {
    id: 5,
    name: "general",
    creation_date: "2026-11-02T09:43:22Z",
};
const technical = {
    id: 9,
    name: "__harmonie_cle_salle",
    creation_date: "2026-11-02T09:43:22Z",
};
const account: Account = {
    id: 1,
    username: "Alice",
    channels: [general, technical],
    metadata: { harmonie: { instrument: "guitar" } },
};

beforeEach(() => {
    playback.start.mockReset();
    playback.start.mockResolvedValue(vi.fn());
});

async function signIn() {
    await userEvent.type(screen.getByLabelText("Nom d’utilisateur"), " Alice ");
    await userEvent.type(screen.getByLabelText("Mot de passe"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

function mockLogin(current: Account = account) {
    server.use(
        http.post(`${api}/login`, ({ request }) => {
            expect(new URL(request.url).searchParams.get("namespace")).toBe(
                "harmonie",
            );
            return HttpResponse.text("token-test");
        }),
        http.get(`${api}/me`, () => HttpResponse.json(current)),
    );
}

describe("Harmonie", () => {
    it("requires a session", async () => {
        renderApp("/");
        expect(
            await screen.findByRole("heading", {
                name: "Bienvenue à Harmonie",
            }),
        ).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "C'est parti !" }));
        expect(
            await screen.findByRole("heading", { name: "Connexion" }),
        ).toBeInTheDocument();
    });

    it("returns to welcome when the session has expired", async () => {
        setToken("expired-token");
        server.use(
            http.get(`${api}/me`, () => new HttpResponse(null, { status: 401 })),
        );
        renderApp("/");
        expect(
            await screen.findByRole("heading", {
                name: "Bienvenue à Harmonie",
            }),
        ).toBeInTheDocument();
    });

    it("requires instrument selection on first sign-in", async () => {
        const current: Account = { ...account, metadata: {} };
        let saved: unknown;
        mockLogin(current);
        server.use(
            http.post(`${api}/user/edit`, async ({ request }) => {
                saved = await request.json();
                current.metadata = { harmonie: { instrument: "flute" } };
                return HttpResponse.json(current);
            }),
        );
        renderApp("/login");
        await signIn();
        await userEvent.click(
            await screen.findByRole("radio", { name: "Flûte" }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Continuer" }),
        );
        expect(
            await screen.findByRole("heading", { name: "Mes groupes" }),
        ).toBeInTheDocument();
        expect(saved).toEqual({ metadata: { instrument: "flute" } });
    });

    it("lists shared groups, hides the technical group and displays the profile", async () => {
        mockLogin();
        renderApp("/login");
        await signIn();
        expect(
            await screen.findByRole("link", { name: "general" }),
        ).toHaveAttribute("href", "/channels/5");
        expect(
            screen.queryByText("__harmonie_cle_salle"),
        ).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("link", { name: "Profil" }));
        expect(await screen.findByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Guitare")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /modifier.*utilisateur/i }),
        ).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
        expect(
            await screen.findByRole("heading", {
                name: "Bienvenue à Harmonie",
            }),
        ).toBeInTheDocument();
    });

    it("joins an existing group from the common form", async () => {
        mockLogin();
        let joined: unknown;
        server.use(
            http.post(
                `${api}/channel`,
                () => new HttpResponse(null, { status: 500 }),
            ),
            http.post(`${api}/channel/enter`, async ({ request }) => {
                joined = await request.json();
                return HttpResponse.json({
                    id: 7,
                    name: "studio",
                    creation_date: new Date().toISOString(),
                });
            }),
        );
        renderApp("/login");
        await signIn();
        await userEvent.click(
            await screen.findByRole("link", { name: "Ajouter un groupe" }),
        );
        await userEvent.type(screen.getByLabelText("Nom du groupe"), "studio");
        await userEvent.click(
            screen.getByRole("button", { name: "Rejoindre / Créer" }),
        );
        expect(joined).toEqual({ channel: "studio" });
    });

    it("creates the key group when missing and loads channel messages", async () => {
        mockLogin({ ...account, channels: [general] });
        let created: unknown;
        let enterCount = 0;
        server.use(
            http.post(`${api}/channel`, async ({ request }) => {
                created = await request.json();
                return HttpResponse.json(technical);
            }),
            http.post(`${api}/channel/enter`, () => {
                enterCount++;
                return new HttpResponse(null, { status: 500 });
            }),
            http.get(`${api}/channel/message`, ({ request }) => {
                const channelId = new URL(request.url).searchParams.get(
                    "channel",
                );
                return HttpResponse.json(
                    channelId === "5"
                        ? [
                              {
                                  id: 1,
                                  content: "Bonjour",
                                  user_id: 2,
                                  user: "Zoe",
                                  creation_date: new Date().toISOString(),
                              },
                              {
                                  id: 2,
                                  content: "clock_tick",
                                  user_id: 2,
                                  user: "Zoe",
                                  creation_date: new Date().toISOString(),
                              },
                          ]
                        : [],
                );
            }),
        );
        renderApp("/login");
        await signIn();
        await userEvent.click(
            await screen.findByRole("link", { name: "general" }),
        );
        expect(await screen.findByText("Bonjour")).toBeInTheDocument();
        expect(screen.queryByText("clock_tick")).not.toBeInTheDocument();
        expect(
            await screen.findByRole("checkbox", { name: "Clé récupérée" }),
        ).toBeInTheDocument();
        expect(created).toEqual({ name: "__harmonie_cle_salle", metadata: {} });
        expect(enterCount).toBe(0);
    });

    it("sends a message with an instrument and plays a foreign message on piano", async () => {
        mockLogin();
        const messages = [
            {
                id: 1,
                content: "Bonjour",
                user_id: 2,
                user: "Zoe",
                creation_date: new Date().toISOString(),
                metadata: {},
            },
        ];
        let sent: unknown;
        server.use(
            http.get(`${api}/channel/message`, ({ request }) =>
                HttpResponse.json(
                    new URL(request.url).searchParams.get("channel") === "9"
                        ? []
                        : messages,
                ),
            ),
            http.post(`${api}/channel/message`, async ({ request }) => {
                sent = await request.json();
                messages.unshift({
                    id: 2,
                    content: "Salut",
                    user_id: 1,
                    user: "Alice",
                    creation_date: new Date().toISOString(),
                    metadata: { harmonie: { instrument: "guitar" } },
                });
                return HttpResponse.json(messages[0]);
            }),
        );
        renderApp("/login");
        await signIn();
        await userEvent.click(
            await screen.findByRole("link", { name: "general" }),
        );
        expect(await screen.findByText("Bonjour")).toBeInTheDocument();
        expect(
            screen.getByText("Portée musicale du message"),
        ).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("button", { name: "Lire le message" }),
        );
        await waitFor(() => expect(playback.start).toHaveBeenCalled());
        expect(playback.start.mock.calls[0][1].instrument).toBe("piano");
        await userEvent.type(screen.getByLabelText("Message"), " Salut ");
        await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
        expect(await screen.findByText("Salut")).toBeInTheDocument();
        expect(sent).toEqual({
            channel: 5,
            content: "Salut",
            metadata: { instrument: "guitar" },
        });
    });

    it("allows the holder to return the key", async () => {
        mockLogin();
        const events: Array<{
            id: number;
            content: string;
            user_id: number;
            user: string;
            creation_date: string;
            metadata: Record<string, unknown>;
        }> = [];
        server.use(
            http.get(`${api}/channel/message`, ({ request }) =>
                HttpResponse.json(
                    new URL(request.url).searchParams.get("channel") === "9"
                        ? events
                        : [],
                ),
            ),
            http.post(`${api}/channel/message`, async ({ request }) => {
                const body = (await request.json()) as {
                    content: string;
                    metadata: Record<string, unknown>;
                };
                events.unshift({
                    id: events.length + 1,
                    content: body.content,
                    user_id: 1,
                    user: "Alice",
                    creation_date: new Date().toISOString(),
                    metadata: { harmonie: body.metadata },
                });
                return HttpResponse.json(events[0]);
            }),
        );
        renderApp("/login");
        await signIn();
        await userEvent.click(
            await screen.findByRole("link", { name: "general" }),
        );
        const checkbox = await screen.findByRole("checkbox", {
            name: "Clé récupérée",
        });
        await userEvent.click(checkbox);
        expect(
            await screen.findByText("Clé détenue par Alice"),
        ).toBeInTheDocument();
        await userEvent.click(checkbox);
        expect(await screen.findByText("Clé disponible")).toBeInTheDocument();
    });

    it("blocks a different user from returning the key and resets at Paris midnight", async () => {
        const event = {
            id: 4,
            content: "Clé récupérée",
            user_id: 2,
            user: "Zoe",
            creation_date: new Date().toISOString(),
            metadata: { harmonie: { type: "classroom_key", action: "claim" } },
        };
        mockLogin();
        server.use(
            http.get(`${api}/channel/message`, ({ request }) =>
                HttpResponse.json(
                    new URL(request.url).searchParams.get("channel") === "9"
                        ? [event]
                        : [],
                ),
            ),
        );
        renderApp("/login");
        await signIn();
        await userEvent.click(
            await screen.findByRole("link", { name: "general" }),
        );
        expect(
            await screen.findByText("Clé détenue par Zoe"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("checkbox", { name: "Clé récupérée" }),
        ).toBeDisabled();
        expect(
            keyStateFromMessages(
                [{ ...event, creation_date: "2026-11-09T22:59:00Z" }],
                new Date("2026-11-09T23:01:00Z"),
            ),
        ).toEqual({ holderId: null, holderName: null });
    });
});
