import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../../../test/render-app";

describe("Welcome page", () => {
    it("renders the mockup content and decorative icons", () => {
        const { container } = renderApp("/bienvenue");

        expect(
            screen.getByRole("heading", { name: "Bienvenue à Harmonie" }),
        ).toBeInTheDocument();
        expect(
            Array.from(
                container.querySelectorAll(".welcome-symbol img"),
                (image) => image.getAttribute("src"),
            ),
        ).toEqual(["/pictos/star.svg", "/pictos/key.svg"]);

        const button = screen.getByRole("button", { name: "C'est parti !" });
        expect(button.querySelector("img")).toHaveAttribute(
            "src",
            "/pictos/arrow.svg",
        );
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("navigates to login from the primary button", async () => {
        renderApp("/bienvenue");

        await userEvent.click(
            screen.getByRole("button", { name: "C'est parti !" }),
        );

        expect(
            await screen.findByRole("heading", { name: "Connexion" }),
        ).toBeInTheDocument();
    });
});
