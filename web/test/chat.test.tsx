import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "../app/features/users/types";
import { setToken } from "../app/features/auth/token";
import { keyStateFromMessages } from "../app/features/key/keyState";
import { renderApp } from "./render-app";
import { server } from "./setup";

const playback = vi.hoisted(() => ({ play: vi.fn(), preload: vi.fn(), dispose: vi.fn() }));
const emotionClassifier = vi.hoisted(() => ({ classify: vi.fn(), preload: vi.fn() }));
vi.mock("../app/features/sound/channelAudioEngine", () => ({
    createChannelAudioEngine: () => playback,
}));
vi.mock("../app/features/chat/emotionClient", () => ({
    classifyEmotion: emotionClassifier.classify,
    preloadEmotionModel: emotionClassifier.preload,
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
    playback.play.mockReset();
    playback.play.mockImplementation(async (...args: unknown[]) => {
        const onScheduled = args[4] as ((getPlayhead: () => number | null) => void) | undefined;
        onScheduled?.(() => null);
        return vi.fn();
    });
    playback.preload.mockReset();
    playback.dispose.mockReset();
    emotionClassifier.classify.mockReset();
    emotionClassifier.classify.mockRejectedValue(new Error("Modèle indisponible"));
    emotionClassifier.preload.mockReset();
    emotionClassifier.preload.mockResolvedValue(undefined);
});

async function signIn() {
    await userEvent.type(
        screen.getByLabelText("Nom d’utilisateur :"),
        " Alice ",
    );
    await userEvent.type(screen.getByLabelText("Mot de passe :"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Continuer" }));
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
    it("plays a staff on the newest page after opening a channel with several pages", async () => {
        mockLogin();
        setToken("test-token");
        const messages = Array.from({ length: 12 }, (_, index) => ({
            id: index + 1,
            content: `Message ${index + 1}`,
            user_id: 2,
            user: "Zoe",
            creation_date: `2026-11-11T10:${String(index).padStart(2, "0")}:00Z`,
        }));
        server.use(http.get(`${api}/channel/message`, ({ request }) => HttpResponse.json(
            new URL(request.url).searchParams.get("channel") === "9" ? [] : messages,
        )));
        renderApp("/channels/5");

        await waitFor(() => expect(document.querySelectorAll(".channel-sheet").length).toBeGreaterThan(1));
        const newest = document.querySelector(".channel-sheet[aria-hidden='false']");
        expect(newest).toBe(document.querySelector(".channel-sheet"));
        const staff = newest!.querySelector<HTMLButtonElement>(".channel-staff");
        expect(staff).toBeEnabled();
        await waitFor(() => expect(playback.play).toHaveBeenCalledOnce());
        await userEvent.click(staff!);
        await waitFor(() => expect(playback.play).toHaveBeenCalledTimes(2));
        vi.spyOn(staff!, "getBoundingClientRect").mockReturnValue(
            DOMRect.fromRect({ x: 10, y: 10, width: 100, height: 40 }),
        );
        const item = staff!.closest(".channel-message")!;
        fireEvent.click(item, { clientX: 50, clientY: 30 });
        await waitFor(() => expect(playback.play).toHaveBeenCalledTimes(3));
        fireEvent.click(item, { clientX: 50, clientY: 60 });
        expect(playback.play).toHaveBeenCalledTimes(3);
    });

    it("plays a negative message in minor on the page tonic", async () => {
        mockLogin();
        setToken("test-token");
        server.use(http.get(`${api}/channel/message`, ({ request }) => HttpResponse.json(
            new URL(request.url).searchParams.get("channel") === "9" ? [] : [{
                id: 1,
                content: "Coucou",
                user_id: 2,
                user: "Zoe",
                creation_date: new Date().toISOString(),
                metadata: { harmonie: { music_root: 2, music_mode: "major", emotion: "sadness" } },
            }],
        )));
        renderApp("/channels/5");
        await screen.findByRole("button", { name: "Rejouer le message" });
        await waitFor(() => expect(playback.play).toHaveBeenCalledWith(
            expect.objectContaining({ tonicMidi: expect.any(Number) }),
            expect.objectContaining({ root: 2, mode: "minor" }),
            expect.any(Function),
            expect.any(AbortSignal),
            expect.any(Function),
            undefined,
            expect.any(Function),
        ));
    });

    it("restarts a staff from the beginning when clicked again", async () => {
        mockLogin();
        setToken("test-token");
        server.use(http.get(`${api}/channel/message`, ({ request }) => HttpResponse.json(
            new URL(request.url).searchParams.get("channel") === "9" ? [] : [{
                id: 1,
                content: "Bonjour",
                user_id: 2,
                user: "Zoe",
                creation_date: new Date().toISOString(),
                metadata: { harmonie: { instrument: "guitar" } },
            }],
        )));
        const stop = vi.fn();
        playback.play.mockImplementation(async (...args: unknown[]) => {
            const onScheduled = args[4] as ((getPlayhead: () => number | null) => void) | undefined;
            onScheduled?.(() => null);
            return stop;
        });
        renderApp("/channels/5");

        await screen.findByRole("button", { name: "Rejouer le message" });
        await userEvent.click(screen.getByRole("button", { name: "Rejouer le message" }));
        const firstSignal = playback.play.mock.calls[1][3] as AbortSignal;
        await userEvent.click(screen.getByRole("button", { name: "Rejouer le message" }));

        expect(firstSignal.aborted).toBe(true);
        expect(stop).toHaveBeenCalledTimes(2);
        expect(playback.play).toHaveBeenCalledTimes(3);
    });

    it("keeps a staff clickable while its instrument is loading", async () => {
        mockLogin();
        setToken("test-token");
        server.use(http.get("http://localhost:4000/channel/message", ({ request }) => HttpResponse.json(
            new URL(request.url).searchParams.get("channel") === "9" ? [] : [{
                id: 1,
                content: "Bonjour",
                user_id: 2,
                user: "Zoe",
                creation_date: new Date().toISOString(),
            }],
        )));
        let finish = () => {};
        playback.play.mockImplementation((...args: unknown[]) => new Promise<() => void>((resolve) => {
            finish = () => {
                const onScheduled = args[4] as ((getPlayhead: () => number | null) => void) | undefined;
                onScheduled?.(() => null);
                resolve(() => {});
            };
        }));
        renderApp("/channels/5");

        const loading = await screen.findByRole("button", { name: "Chargement du son, réessayer" });
        expect(loading).toBeEnabled();
        await userEvent.click(loading);
        await userEvent.click(loading);
        expect(playback.play).toHaveBeenCalledTimes(3);
        finish();
        await screen.findByRole("button", { name: "Rejouer le message" });
    });

    it("sends the detected emotion without changing the conversation key", async () => {
        mockLogin();
        setToken("test-token");
        emotionClassifier.classify.mockResolvedValue("sadness");
        let sent: unknown;
        server.use(
            http.get(`${api}/channel/message`, () => HttpResponse.json([])),
            http.post(`${api}/channel/message`, async ({ request }) => {
                sent = await request.json();
                return HttpResponse.json({ id: 1 });
            }),
        );
        renderApp("/channels/5");
        await screen.findByRole("heading", { name: "general" });
        await userEvent.type(screen.getByLabelText("Message"), "Je suis triste");
        await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
        await waitFor(() => expect(sent).toEqual({
            channel: 5,
            content: "Je suis triste",
            metadata: {
                instrument: "guitar",
                music_root: 0,
                music_mode: "major",
                emotion: "sadness",
            },
        }));
        expect(emotionClassifier.classify).toHaveBeenCalledWith("Je suis triste");
    });

    it("sends on Enter and inserts a line break on Shift+Enter", async () => {
        mockLogin();
        setToken("test-token");
        emotionClassifier.classify.mockResolvedValue("neutral");
        const sent: string[] = [];
        server.use(
            http.get(`${api}/channel/message`, () => HttpResponse.json([])),
            http.post(`${api}/channel/message`, async ({ request }) => {
                const body = await request.json() as { content: string };
                sent.push(body.content);
                return HttpResponse.json({ id: 1 });
            }),
        );
        renderApp("/channels/5");
        await screen.findByRole("heading", { name: "general" });
        const input = screen.getByLabelText("Message");
        await userEvent.type(input, "Bonjour{Shift>}{Enter}{/Shift}Alice");
        expect(input).toHaveValue("Bonjour\nAlice");
        expect(sent).toEqual([]);
        await userEvent.type(input, "{Meta>}{Enter}{/Meta}");
        expect(input).toHaveValue("Bonjour\nAlice");
        expect(sent).toEqual([]);
        await userEvent.type(input, "{Enter}");
        await waitFor(() => expect(sent).toEqual(["Bonjour\nAlice"]));
        await waitFor(() => expect(input).toHaveValue(""));
    });

    it("waits for emotion analysis before sending the message", async () => {
        mockLogin();
        setToken("test-token");
        let release = () => {};
        const pending = new Promise<"sadness">((resolve) => {
            release = () => resolve("sadness");
        });
        emotionClassifier.classify.mockReturnValue(pending);
        let sent: unknown;
        server.use(
            http.get(`${api}/channel/message`, () => HttpResponse.json([])),
            http.post(`${api}/channel/message`, async ({ request }) => {
                sent = await request.json();
                return HttpResponse.json({ id: 42, content: "Je suis triste", creation_date: new Date().toISOString() });
            }),
        );
        renderApp("/channels/5");
        await screen.findByRole("heading", { name: "general" });
        expect(emotionClassifier.preload).toHaveBeenCalledOnce();
        await userEvent.type(screen.getByLabelText("Message"), "Je suis triste");
        await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
        expect(await screen.findByText("Analyse de l’émotion…")).toBeInTheDocument();
        expect(sent).toBeUndefined();
        expect(screen.getByLabelText("Message")).toHaveValue("Je suis triste");
        release();
        await waitFor(() => expect(sent).toEqual({
            channel: 5,
            content: "Je suis triste",
            metadata: {
                instrument: "guitar",
                music_root: 0,
                music_mode: "major",
                emotion: "sadness",
            },
        }));
        await waitFor(() => expect(screen.getByLabelText("Message")).toHaveValue(""));
    });

    it("keeps the draft when emotion analysis fails", async () => {
        mockLogin();
        setToken("test-token");
        const post = vi.fn(() => HttpResponse.json({ id: 1 }));
        server.use(
            http.get(`${api}/channel/message`, () => HttpResponse.json([])),
            http.post(`${api}/channel/message`, post),
        );
        renderApp("/channels/5");
        await screen.findByRole("heading", { name: "general" });
        await userEvent.type(screen.getByLabelText("Message"), "Je suis triste");
        await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
        expect(await screen.findByText("Modèle indisponible")).toBeInTheDocument();
        expect(post).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Message")).toHaveValue("Je suis triste");
    });

    it("requires a session", async () => {
        renderApp("/");
        expect(
            await screen.findByRole("heading", {
                name: "Bienvenue à Harmonie",
            }),
        ).toBeInTheDocument();
        expect(emotionClassifier.preload).not.toHaveBeenCalled();
        await userEvent.click(
            screen.getByRole("button", { name: "C'est parti !" }),
        );
        expect(
            await screen.findByRole("heading", { name: "Se connecter" }),
        ).toBeInTheDocument();
        expect(emotionClassifier.preload).toHaveBeenCalledOnce();
    });

    it("returns to welcome when the session has expired", async () => {
        setToken("expired-token");
        server.use(
            http.get(
                `${api}/me`,
                () => new HttpResponse(null, { status: 401 }),
            ),
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
            http.put(`${api}/user`, async ({ request }) => {
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
        expect(await screen.findByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Flûte")).toBeInTheDocument();
        expect(saved).toBeUndefined();
        await userEvent.click(screen.getByRole("button", { name: "Continuer" }));
        expect(
            await screen.findByRole("heading", { name: "Mes partitions" }),
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
        await userEvent.click(
            screen.getByRole("button", { name: "Me déconnecter" }),
        );
        expect(
            await screen.findByRole("heading", {
                name: "Bienvenue à Harmonie",
            }),
        ).toBeInTheDocument();
    });

    it("joins an existing group from the join form", async () => {
        const current = { ...account, channels: [...(account.channels ?? [])] };
        mockLogin(current);
        let joined: unknown;
        server.use(
            http.post(`${api}/channel`, () => new HttpResponse(null, { status: 500 })),
            http.post(`${api}/channel/enter`, async ({ request }) => {
                joined = await request.json();
                const channel = {
                    id: 7,
                    name: "studio",
                    creation_date: new Date().toISOString(),
                };
                current.channels.push(channel);
                return HttpResponse.json(channel);
            }),
            http.get(`${api}/channel/message`, () => HttpResponse.json([])),
        );
        renderApp("/login");
        await signIn();
        await userEvent.click(
            await screen.findByRole("link", { name: "Ajouter un groupe" }),
        );
        await userEvent.click(screen.getByRole("button", { name: "Rejoindre" }));
        await userEvent.type(screen.getByLabelText("Nom de l’orchestre :"), "studio");
        await userEvent.click(
            screen.getByRole("button", { name: "Rejoindre" }),
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
        await waitFor(() => expect(
            Array.from(document.querySelectorAll(".channel-sheet[aria-hidden='false'] .channel-syllable p"),
                (node) => node.textContent).join(""),
        ).toBe("Bonjour"));
        expect(
            await screen.findByRole("checkbox", { name: "Clé récupérée" }),
        ).toBeInTheDocument();
        expect(created).toEqual({ name: "__harmonie_cle_salle", metadata: {} });
        expect(enterCount).toBe(0);
    });

    it("does not load the key in another group and still sends messages", async () => {
        emotionClassifier.classify.mockResolvedValue("neutral");
        const studio = { id: 7, name: "studio", creation_date: general.creation_date };
        mockLogin({ ...account, channels: [general, studio] });
        const requestedChannels: string[] = [];
        let keyChannelCreates = 0;
        let sent: unknown;
        server.use(
            http.post(`${api}/channel`, () => {
                keyChannelCreates++;
                return HttpResponse.json(technical);
            }),
            http.get(`${api}/channel/message`, ({ request }) => {
                requestedChannels.push(new URL(request.url).searchParams.get("channel") ?? "");
                return HttpResponse.json([]);
            }),
            http.post(`${api}/channel/message`, async ({ request }) => {
                sent = await request.json();
                return HttpResponse.json({ id: 1 });
            }),
        );
        renderApp("/login");
        await signIn();
        await userEvent.click(await screen.findByRole("link", { name: "studio" }));
        expect(await screen.findByRole("heading", { name: "studio" })).toBeInTheDocument();
        await waitFor(() => expect(requestedChannels).toContain("7"));
        expect(screen.queryByRole("checkbox", { name: "Clé récupérée" })).not.toBeInTheDocument();
        await userEvent.type(screen.getByLabelText("Message"), "Bonjour");
        await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
        await waitFor(() => expect(sent).toEqual({
            channel: 7,
            content: "Bonjour",
            metadata: { instrument: "guitar", music_root: 0, music_mode: "major", emotion: "neutral" },
        }));
        expect(requestedChannels).not.toContain("9");
        expect(keyChannelCreates).toBe(0);
    });

    it("sends a message with an instrument and plays a foreign message on piano", async () => {
        emotionClassifier.classify.mockResolvedValue("neutral");
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
        await waitFor(() => expect(
            Array.from(document.querySelectorAll(".channel-sheet[aria-hidden='false'] .channel-syllable p"),
                (node) => node.textContent).join(""),
        ).toBe("Bonjour"));
        await waitFor(() => expect(playback.preload).toHaveBeenCalledWith(["piano"]));
        expect(document.querySelectorAll(".channel-staff-lines line")).toHaveLength(10);
        await userEvent.click(
            screen.getByRole("button", { name: "Rejouer le message" }),
        );
        await waitFor(() => expect(playback.play).toHaveBeenCalled());
        expect(playback.play.mock.calls[0][1].instrument).toBe("piano");
        await userEvent.type(screen.getByLabelText("Message"), " Salut ");
        await userEvent.click(screen.getByRole("button", { name: "Envoyer" }));
        await waitFor(() => expect(screen.getByText("Moi")).toBeInTheDocument());
        await waitFor(() => expect(playback.preload.mock.calls.some(([instruments]) =>
            instruments.includes("guitar"))).toBe(true));
        expect(sent).toEqual({
            channel: 5,
            content: "Salut",
            metadata: { instrument: "guitar", music_root: 0, music_mode: "major", emotion: "neutral" },
        });
    });

    it("allows the holder to return the key", async () => {
        mockLogin();
        const mainMessages = [{
            id: 20,
            content: "Bonjour",
            user_id: 1,
            user: "Alice",
            creation_date: new Date().toISOString(),
        }];
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
                        : mainMessages,
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
        await waitFor(() => expect(checkbox).toBeEnabled());
        expect(document.querySelector(".channel-key-symbol")).toHaveAttribute("src", "/pictos/key.svg");
        expect(document.querySelector(".channel-author-key")).toBeNull();
        await userEvent.click(checkbox);
        expect(
            await screen.findByText("Clé détenue par Alice"),
        ).toBeInTheDocument();
        await waitFor(() => expect(document.querySelector(".channel-message-author-own .channel-author-key"))
            .toHaveAttribute("src", "/pictos/key.svg"));
        await userEvent.click(checkbox);
        expect(await screen.findByText("Clé disponible")).toBeInTheDocument();
        await waitFor(() => expect(document.querySelector(".channel-author-key")).toBeNull());
    });

    it("keeps the first holder when later claims or foreign releases are recorded", () => {
        const claim = {
            id: 1,
            content: "Clé récupérée",
            user_id: 1,
            user: "Alice",
            creation_date: new Date().toISOString(),
            metadata: { harmonie: { type: "classroom_key", action: "claim" } },
        };
        const foreignClaim = { ...claim, id: 2, user_id: 2, user: "Zoe" };
        const foreignRelease = {
            ...foreignClaim,
            id: 3,
            metadata: { harmonie: { type: "classroom_key", action: "release" } },
        };
        const ownRelease = {
            ...claim,
            id: 4,
            metadata: { harmonie: { type: "classroom_key", action: "release" } },
        };

        expect(keyStateFromMessages([foreignRelease, foreignClaim, claim])).toEqual({
            holderId: 1,
            holderName: "Alice",
        });
        expect(keyStateFromMessages([ownRelease, foreignRelease, foreignClaim, claim]))
            .toEqual({ holderId: null, holderName: null });
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
