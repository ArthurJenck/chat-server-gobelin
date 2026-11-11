import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { getToken } from "../../features/auth/token";
import { renderApp } from "../../../test/render-app";
import { server } from "../../../test/setup";

describe("Register page", () => {
    it("renders the mockup content and links to login", async () => {
        renderApp("/register");

        expect(screen.getByRole("heading", { name: "S’inscrire" })).toBeInTheDocument();
        expect(screen.getByText("Ton nom ne pourra plus être changé")).toBeInTheDocument();
        expect(screen.getByLabelText("Nom d’utilisateur :")).toHaveAttribute("placeholder", "tutur_legoat");
        expect(screen.getByLabelText("Confirmer le mot de passe :")).toHaveAttribute("type", "password");
        expect(screen.getByRole("button", { name: "Continuer" }).querySelector("img")).toHaveAttribute("src", "/pictos/arrow.svg");
        expect(screen.getByRole("button", { name: "Continuer" }).querySelectorAll("img")).toHaveLength(2);
        expect(screen.getByRole("button", { name: "Continuer" })).toBeDisabled();

        await userEvent.click(screen.getByRole("link", { name: "Connecte-toi" }));
        expect(await screen.findByRole("heading", { name: "Se connecter" })).toBeInTheDocument();
    });

    it("blocks registration when passwords differ", async () => {
        let requests = 0;
        server.use(
            http.post("http://localhost:4000/user", () => {
                requests++;
                return new HttpResponse(null, { status: 201 });
            }),
        );
        renderApp("/register");

        await userEvent.type(screen.getByLabelText("Nom d’utilisateur :"), "Alice");
        await userEvent.type(screen.getByLabelText("Mot de passe :"), "secret");
        expect(screen.getByRole("button", { name: "Continuer" })).toBeDisabled();
        await userEvent.type(screen.getByLabelText("Confirmer le mot de passe :"), "other");
        expect(screen.getByRole("button", { name: "Continuer" })).toBeEnabled();
        await userEvent.click(screen.getByRole("button", { name: "Continuer" }));

        expect(screen.getByRole("alert")).toHaveTextContent("Les mots de passe sont différents");
        expect(requests).toBe(0);
    });

    it("registers with matching passwords and stores the session", async () => {
        let submitted: unknown;
        server.use(
            http.post("http://localhost:4000/user", async ({ request }) => {
                submitted = await request.json();
                return new HttpResponse(null, { status: 201 });
            }),
            http.post("http://localhost:4000/login", () => HttpResponse.text("register-token")),
        );
        renderApp("/register");

        await userEvent.type(screen.getByLabelText("Nom d’utilisateur :"), " Alice ");
        await userEvent.type(screen.getByLabelText("Mot de passe :"), "secret");
        await userEvent.type(screen.getByLabelText("Confirmer le mot de passe :"), "secret");
        await userEvent.click(screen.getByRole("button", { name: "Continuer" }));

        await waitFor(() => expect(getToken()).toBe("register-token"));
        expect(submitted).toEqual({ username: "Alice", password: "secret" });
    });
});
