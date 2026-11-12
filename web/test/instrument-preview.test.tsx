import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import InstrumentList from "../app/components/InstrumentList";
import { randomPreviewNote } from "../app/features/sound/instrumentPreview";

const sampler = vi.hoisted(() => ({
    create: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
}));

vi.mock("smplr", () => ({
    Soundfont: sampler.create,
    CacheStorage: vi.fn(() => ({})),
}));

class AudioContextStub {
    currentTime = 0;
    resume = vi.fn(async () => {});
    close = vi.fn(async () => {});
}

beforeEach(() => {
    vi.stubGlobal("AudioContext", AudioContextStub);
    sampler.create.mockReturnValue({
        ready: Promise.resolve(),
        start: sampler.start,
        stop: sampler.stop,
        dispose: sampler.dispose,
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

it("plays on every click, including when the radio is already selected", async () => {
    const onChange = vi.fn();
    render(<InstrumentList selected="guitar" onChange={onChange} labelledBy="title" />);

    await userEvent.click(screen.getByRole("radio", { name: "Guitare" }));
    await waitFor(() => expect(sampler.start).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole("radio", { name: "Guitare" }));
    await waitFor(() => expect(sampler.start).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByRole("radio", { name: "Harpe" }));
    await waitFor(() => expect(sampler.start).toHaveBeenCalledTimes(3));

    expect(sampler.create.mock.calls.map(([, options]) => options.instrument)).toEqual([
        "acoustic_guitar_nylon",
        "acoustic_guitar_nylon",
        "orchestral_harp",
    ]);
    expect(onChange).toHaveBeenCalledWith("harp");
    expect(sampler.stop).toHaveBeenCalledTimes(2);
});

it("chooses notes within each instrument's range", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.999);

    expect(randomPreviewNote("guitar")).toBe(55);
    expect(randomPreviewNote("guitar")).toBe(65);
});
