import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import ChannelPagination from "./ChannelPagination";

it("shows five pages with the active number and sizes by distance", () => {
    const view = render(<ChannelPagination activePage={4} pageCount={10} onPageSelect={vi.fn()} />);
    const pagination = screen.getByRole("navigation", { name: "Pages des messages" });
    const buttons = within(pagination).getAllByRole("button");

    expect(buttons.map((button) => button.getAttribute("aria-label")))
        .toEqual([4, 5, 6, 7, 8].map((page) => `Aller à la page ${page} sur 10`));
    expect(buttons.map((button) => button.firstElementChild?.className))
        .toEqual([
            "channel-page-dot-mark",
            "channel-page-dot-mark channel-page-dot-mark--neighbor",
            "channel-page-dot-mark channel-page-dot-mark--active",
            "channel-page-dot-mark channel-page-dot-mark--neighbor",
            "channel-page-dot-mark",
        ]);
    expect(within(pagination).getByRole("button", { current: "page" })).toHaveTextContent("6");

    view.rerender(<ChannelPagination activePage={9} pageCount={10} onPageSelect={vi.fn()} />);

    expect(within(pagination).getByRole("button", { current: "page" })).toHaveTextContent("1");
    expect(within(pagination).getAllByRole("button").map((button) => button.getAttribute("aria-label")))
        .toEqual([1, 2, 3, 4, 5].map((page) => `Aller à la page ${page} sur 10`));
});

it("selects a page and hides the pagination when there is only one page", async () => {
    const onPageSelect = vi.fn();
    const view = render(<ChannelPagination activePage={0} pageCount={3} onPageSelect={onPageSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Aller à la page 2 sur 3" }));
    expect(onPageSelect).toHaveBeenCalledWith(1);

    view.rerender(<ChannelPagination activePage={0} pageCount={1} onPageSelect={onPageSelect} />);
    expect(screen.queryByRole("navigation", { name: "Pages des messages" })).not.toBeInTheDocument();
});
