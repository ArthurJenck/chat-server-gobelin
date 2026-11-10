import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderApp } from "./render-app";
import { DEFAULT_SOUND_SETTINGS, INSTRUMENTS } from "../app/sound/soundConfig";
import {
    saveInstrumentProfiles,
    serializePreset,
} from "../app/sound/soundPreset";

const playback = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
vi.mock("../app/sound/audioEngine", () => ({
    startPlayback: playback.start,
}));

it("opens the sound workshop without signing in", async () => {
    renderApp("/atelier-son");

    expect(screen.getByRole("textbox", { name: "Texte" })).toBeInTheDocument();
    expect(screen.getByText("Accélération")).toBeInTheDocument();
    expect(screen.getByText("Correspondance écrite")).toBeInTheDocument();
    expect(screen.getByText("Répétition identique")).toBeInTheDocument();
    expect(screen.queryByText("Notes par courbe")).not.toBeInTheDocument();
    expect(screen.getByText("Écart mots")).toBeInTheDocument();
    expect(screen.getByText("Retard texte (ms)")).toBeInTheDocument();
    expect(screen.queryByText("Écart notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Durée totale (s)")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Retour" })).toHaveAttribute(
        "href",
        "/login",
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});

it("resets saved sound settings", async () => {
    window.localStorage.setItem(
        "gobelin_sound_settings_v1",
        serializePreset({
            ...DEFAULT_SOUND_SETTINGS,
            intervalMs: 700,
            soundWeight: 9,
        }),
    );
    renderApp("/atelier-son");

    await userEvent.click(screen.getByText("Réinitialiser"));

    await waitFor(() =>
        expect(
            JSON.parse(
                window.localStorage.getItem("gobelin_sound_settings_v1")!,
            ).settings.intervalMs,
        ).toBe(240),
    );
    expect(
        JSON.parse(window.localStorage.getItem("gobelin_sound_settings_v1")!)
            .settings.soundWeight,
    ).toBe(4);
});

it("starts and stops a text melody from the workshop", async () => {
    playback.start.mockResolvedValue(playback.stop);
    renderApp("/atelier-son");

    await userEvent.type(
        screen.getByRole("textbox", { name: "Texte" }),
        "Bonjour",
    );
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(playback.start).toHaveBeenCalledOnce());
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(playback.stop).toHaveBeenCalledOnce();
});

it("plays with the selected instrument", async () => {
    playback.start.mockResolvedValue(playback.stop);
    renderApp("/atelier-son");

    await userEvent.selectOptions(
        screen.getByRole("combobox", { name: "Instrument" }),
        "guitar",
    );
    await userEvent.type(
        screen.getByRole("textbox", { name: "Texte" }),
        "Bonjour",
    );
    await userEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() =>
        expect(playback.start).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                instrument: "guitar",
                octave: 4,
                intervalMs: 120,
                gate: 0.35,
            }),
            expect.any(Function),
            expect.any(Function),
        ),
    );
});

it("restores the settings of each instrument when switching back", async () => {
    renderApp("/atelier-son");
    const selector = screen.getByRole("combobox", { name: "Instrument" });

    await userEvent.selectOptions(selector, "flute");
    await waitFor(() =>
        expect(
            JSON.parse(
                window.localStorage.getItem("gobelin_sound_settings_v1")!,
            ).settings.intervalMs,
        ).toBe(480),
    );
    await userEvent.selectOptions(selector, "guitar");
    await waitFor(() =>
        expect(
            JSON.parse(
                window.localStorage.getItem("gobelin_sound_settings_v1")!,
            ).settings.intervalMs,
        ).toBe(120),
    );
    await userEvent.selectOptions(selector, "flute");
    await waitFor(() =>
        expect(
            JSON.parse(
                window.localStorage.getItem("gobelin_sound_settings_v1")!,
            ).settings.intervalMs,
        ).toBe(480),
    );
});

it("loads a saved adjustment and resets instrument adjustments", async () => {
    saveInstrumentProfiles({
        flute: { octave: 5, intervalMs: 420, wordGap: 120, gate: 0.9 },
    });
    renderApp("/atelier-son");
    const selector = screen.getByRole("combobox", { name: "Instrument" });

    await userEvent.selectOptions(selector, "flute");
    await waitFor(() =>
        expect(
            JSON.parse(
                window.localStorage.getItem("gobelin_sound_settings_v1")!,
            ).settings.intervalMs,
        ).toBe(420),
    );
    await userEvent.click(screen.getByText("Réinitialiser"));
    await userEvent.selectOptions(selector, "flute");
    await waitFor(() =>
        expect(
            JSON.parse(
                window.localStorage.getItem("gobelin_sound_settings_v1")!,
            ).settings.intervalMs,
        ).toBe(480),
    );
});

it("lists every configured instrument", () => {
    renderApp("/atelier-son");

    const options = screen
        .getByRole("combobox", { name: "Instrument" })
        .querySelectorAll("option");
    expect(Array.from(options, (option) => option.value)).toEqual(
        Object.keys(INSTRUMENTS),
    );
    expect(screen.getByRole("option", { name: "Flûte" })).toBeInTheDocument();
    expect(
        screen.getByRole("option", { name: "Guitare électrique" }),
    ).toBeInTheDocument();
});

it("starts playback when Enter is pressed in the text field", async () => {
    playback.start.mockResolvedValue(playback.stop);
    renderApp("/atelier-son");

    await userEvent.type(
        screen.getByRole("textbox", { name: "Texte" }),
        "Bonjour{Enter}",
    );

    await waitFor(() => expect(playback.start).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
});

it("restarts from the beginning when Play is pressed during playback", async () => {
    const firstStop = vi.fn();
    const secondStop = vi.fn();
    playback.start
        .mockResolvedValueOnce(firstStop)
        .mockResolvedValueOnce(secondStop);
    renderApp("/atelier-son");

    await userEvent.type(
        screen.getByRole("textbox", { name: "Texte" }),
        "Bonjour",
    );
    const playButton = screen.getByRole("button", { name: "Play" });
    await userEvent.click(playButton);
    await waitFor(() =>
        expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled(),
    );

    expect(playButton).toBeEnabled();
    await userEvent.click(playButton);

    await waitFor(() => expect(playback.start).toHaveBeenCalledTimes(2));
    expect(firstStop).toHaveBeenCalledOnce();
    expect(
        playback.start.mock.calls[1][0].events.map(
            (event: { text: string }) => event.text,
        ),
    ).toEqual(
        playback.start.mock.calls[0][0].events.map(
            (event: { text: string }) => event.text,
        ),
    );
    expect(
        playback.start.mock.calls[1][0].events.map(
            (event: { start: number }) => event.start,
        ),
    ).not.toEqual(
        playback.start.mock.calls[0][0].events.map(
            (event: { start: number }) => event.start,
        ),
    );
});

it("shows five staff lines and reveals the played groups from the audio schedule", async () => {
    playback.start.mockImplementation(
        async (_plan, _settings, _finished, onScheduled) => {
            onScheduled(() => 0);
            return playback.stop;
        },
    );
    renderApp("/atelier-son");

    const staff = screen.getByRole("img", { name: "Portée de l’atelier son" });
    expect(staff.querySelectorAll("line")).toHaveLength(5);
    expect(staff.querySelectorAll("span")).toHaveLength(0);
    expect(staff.querySelector("svg")).toHaveAttribute("height", "72");
    expect(staff.querySelector("svg")?.getAttribute("style")).toContain(
        "margin-bottom: 2.5rem",
    );

    await userEvent.type(
        screen.getByRole("textbox", { name: "Texte" }),
        "La lune",
    );
    await userEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() =>
        expect(
            screen
                .getByRole("img", { name: "Portée de l’atelier son" })
                .querySelectorAll("span").length,
        ).toBe(playback.start.mock.calls[0][0].events.length),
    );
    expect(
        [
            ...screen
                .getByRole("img", { name: "Portée de l’atelier son" })
                .querySelectorAll("span"),
        ].map((node) => node.textContent),
    ).toEqual(
        playback.start.mock.calls[0][0].events.map(
            (event: { text: string }) => event.text,
        ),
    );
    expect(screen.getByRole("button", { name: "Stop" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(playback.stop).toHaveBeenCalled();
    expect(playback.start).toHaveBeenCalledOnce();
    expect(
        screen
            .getByRole("img", { name: "Portée de l’atelier son" })
            .querySelectorAll("span"),
    ).toHaveLength(playback.start.mock.calls[0][0].events.length);
});

it("keeps the staff text visible after playback finishes", async () => {
    let finish = () => {};
    playback.start.mockImplementation(
        async (_plan, _settings, onFinished, onScheduled) => {
            finish = onFinished;
            onScheduled(() => 0);
            return playback.stop;
        },
    );
    renderApp("/atelier-son");

    await userEvent.type(
        screen.getByRole("textbox", { name: "Texte" }),
        "La lune",
    );
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    await waitFor(() =>
        expect(
            screen
                .getByRole("img", { name: "Portée de l’atelier son" })
                .querySelectorAll("span"),
        ).toHaveLength(playback.start.mock.calls[0][0].events.length),
    );
    act(() => finish());

    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
    expect(
        screen
            .getByRole("img", { name: "Portée de l’atelier son" })
            .querySelectorAll("span"),
    ).toHaveLength(playback.start.mock.calls[0][0].events.length);
});
