import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import KeyControl from "../app/features/key/KeyControl";

it("shows the key only when available or owned and disables actions while loading or busy", () => {
    const onChange = vi.fn();
    const { rerender, container } = render(
        <KeyControl state={{ holderId: null, holderName: null }} userId={1}
            ready={false} busy={false} onChange={onChange} />,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Clé récupérée" });
    expect(checkbox).toBeDisabled();
    expect(container.querySelector(".channel-key-symbol")).toBeNull();

    rerender(<KeyControl state={{ holderId: null, holderName: null }} userId={1}
        ready busy={false} onChange={onChange} />);
    expect(checkbox).toBeEnabled();
    expect(container.querySelector(".channel-key-symbol")).toHaveAttribute("src", "/pictos/key.svg");

    rerender(<KeyControl state={{ holderId: 1, holderName: "Alice" }} userId={1}
        ready busy onChange={onChange} />);
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(container.querySelector(".channel-key-symbol")).toBeInTheDocument();

    rerender(<KeyControl state={{ holderId: 2, holderName: "Louis" }} userId={1}
        ready busy={false} onChange={onChange} />);
    expect(checkbox).toBeDisabled();
    expect(container.querySelector(".channel-key-symbol")).toBeNull();
    expect(screen.getByText("Clé détenue par Louis")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
});
