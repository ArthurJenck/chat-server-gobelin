import { act, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { getToken, setToken } from "../app/features/auth/token";
import { renderApp } from "./render-app";
import { server } from "./setup";

const api = "http://localhost:4000";
const account = {
    id: 1,
    username: "Alice",
    channels: [],
    metadata: { harmonie: { instrument: "guitar" } },
};

describe("Guest pages", () => {
    it.each(["/bienvenue", "/login", "/register"])(
        "redirects %s to home when the backend accepts the token",
        async (path) => {
            setToken("valid-token");
            server.use(
                http.get(`${api}/me`, ({ request }) => {
                    expect(request.headers.get("Authorization")).toBe(
                        "Bearer valid-token",
                    );
                    return HttpResponse.json(account);
                }),
            );

            const { router } = renderApp(path);

            await waitFor(() => expect(router.state.location.pathname).toBe("/"));
            expect(await screen.findByRole("heading", { name: "Mes partitions" })).toBeInTheDocument();
        },
    );

    it("redirects to instrument selection when the account has none", async () => {
        setToken("valid-token");
        server.use(
            http.get(`${api}/me`, () =>
                HttpResponse.json({ ...account, metadata: null }),
            ),
        );

        const { router } = renderApp("/login");

        await waitFor(() =>
            expect(router.state.location.pathname).toBe("/profil/instrument"),
        );
    });

    it("keeps login accessible when the backend rejects the token", async () => {
        setToken("expired-token");
        server.use(
            http.get(`${api}/me`, () => new HttpResponse(null, { status: 401 })),
        );

        const { router } = renderApp("/login");

        await waitFor(() => expect(getToken()).toBeNull());
        expect(router.state.location.pathname).toBe("/login");
        expect(screen.getByRole("heading", { name: "Se connecter" })).toBeInTheDocument();
    });

    it("redirects again after browser back reaches a guest page", async () => {
        setToken("valid-token");
        let checks = 0;
        server.use(
            http.get(`${api}/me`, () => {
                checks++;
                return HttpResponse.json(account);
            }),
        );

        const { router } = renderApp(["/bienvenue", "/login"]);
        await waitFor(() => expect(router.state.location.pathname).toBe("/"));
        await waitFor(() => expect(checks).toBeGreaterThanOrEqual(2));

        await act(async () => {
            await router.navigate(-1);
        });

        await waitFor(() => expect(router.state.location.pathname).toBe("/"));
        await waitFor(() => expect(checks).toBeGreaterThanOrEqual(4));
    });
});
