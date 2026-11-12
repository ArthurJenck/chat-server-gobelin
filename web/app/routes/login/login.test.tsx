import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { getToken } from "../../features/auth/token";
import { renderApp } from "../../../test/render-app";
import { server } from "../../../test/setup";

describe("Login page", () => {
    it("renders the mockup content and links to registration", async () => {
        renderApp("/login");

        expect(
            screen.getByRole("heading", { name: "Se connecter" }),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Nom d’utilisateur :")).toHaveAttribute(
            "placeholder",
            "tutur_legoat",
        );
        expect(screen.getByLabelText("Mot de passe :")).toHaveAttribute(
            "type",
            "password",
        );
        expect(
            screen.getByRole("link", { name: "J’ai oublié mon mot de passe" }),
        ).toHaveAttribute("href", "/forgot-password");
        expect(
            screen
                .getByRole("button", { name: "Continuer" })
                .querySelector("img"),
        ).toHaveAttribute("src", "/pictos/arrow.svg");
        expect(
            screen
                .getByRole("button", { name: "Continuer" })
                .querySelectorAll("img"),
        ).toHaveLength(2);
        expect(
            screen.getByRole("button", { name: "Continuer" }),
        ).toBeDisabled();

        await userEvent.click(
            screen.getByRole("link", { name: "Inscris-toi" }),
        );
        expect(
            await screen.findByRole("heading", { name: "S’inscrire" }),
        ).toBeInTheDocument();
    });

    it("opens the forgot password page and goes to registration", async () => {
        renderApp("/login");

        await userEvent.click(
            screen.getByRole("link", { name: "J’ai oublié mon mot de passe" }),
        );
        expect(
            await screen.findByRole("heading", {
                name: "Gros loser ! Crée un nouveau compte",
            }),
        ).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: "S’inscrire" }),
        );
        expect(
            await screen.findByRole("heading", { name: "S’inscrire" }),
        ).toBeInTheDocument();
    });

    it("submits credentials and stores the session", async () => {
        let submitted: unknown;
        server.use(
            http.post("http://localhost:4000/login", async ({ request }) => {
                submitted = await request.json();
                return HttpResponse.text("login-token");
            }),
        );
        renderApp("/login");

        await userEvent.type(
            screen.getByLabelText("Nom d’utilisateur :"),
            " Alice ",
        );
        expect(
            screen.getByRole("button", { name: "Continuer" }),
        ).toBeDisabled();
        await userEvent.type(screen.getByLabelText("Mot de passe :"), "secret");
        expect(screen.getByRole("button", { name: "Continuer" })).toBeEnabled();
        await userEvent.click(
            screen.getByRole("button", { name: "Continuer" }),
        );

        await waitFor(() => expect(getToken()).toBe("login-token"));
        expect(submitted).toEqual({ username: "Alice", password: "secret" });
    });

    it("shows login errors until the next attempt", async () => {
        let requests = 0;
        let releaseRetry: (() => void) | undefined;
        server.use(
            http.post("http://localhost:4000/login", async () => {
                requests++;
                if (requests === 1)
                    return new HttpResponse(null, { status: 401 });
                await new Promise<void>((resolve) => {
                    releaseRetry = resolve;
                });
                return HttpResponse.text("login-token");
            }),
        );
        renderApp("/login");

        const username = screen.getByLabelText("Nom d’utilisateur :");
        const password = screen.getByLabelText("Mot de passe :");
        await userEvent.type(username, "Alice");
        await userEvent.type(password, "wrong");
        await userEvent.click(
            screen.getByRole("button", { name: "Continuer" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Nom d’utilisateur ou mot de passe ",
        );
        expect(username).toHaveAttribute("aria-invalid", "true");
        expect(password).toHaveAttribute("aria-invalid", "true");

        await userEvent.type(password, "2");
        expect(screen.getByRole("alert")).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("button", { name: "Continuer" }),
        );

        await waitFor(() =>
            expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
        );
        expect(username).not.toHaveAttribute("aria-invalid");
        expect(password).not.toHaveAttribute("aria-invalid");
        releaseRetry?.();
        await waitFor(() => expect(getToken()).toBe("login-token"));
    });
});
