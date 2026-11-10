import { describe, expect, it } from "vitest";
import { createArrangement } from "../app/sound/arrangement";
import { DEFAULT_SOUND_SETTINGS } from "../app/sound/soundConfig";
import type { SoundPlan } from "../app/sound/soundPlan";

const plan: SoundPlan = {
    tonicMidi: 60,
    density: 4,
    noteStep: 0.25,
    events: [
        { text: "do", wordId: 0, start: 0, midi: 60 },
        { text: "ré", wordId: 0, start: 0.25, midi: 62 },
        { text: "mi", wordId: 0, start: 0.5, midi: 64 },
    ],
};

function harmonyAt(start: number, settings: typeof DEFAULT_SOUND_SETTINGS) {
    return createArrangement(plan, settings)
        .filter(
            (note) =>
                note.start === start &&
                note.velocity === settings.harmonyVelocity,
        )
        .map((note) => note.note);
}

describe("sound arrangement", () => {
    it("builds the first and last chords in the message scale", () => {
        const settings = {
            ...DEFAULT_SOUND_SETTINGS,
            chordPlacement: "above" as const,
        };
        expect(harmonyAt(0, settings)).toEqual([64, 67]);
        expect(harmonyAt(0.25, settings)).toEqual([]);
        expect(harmonyAt(0.5, settings)).toEqual([67]);
    });

    it("anchors chords to the tonic below the melody", () => {
        const settings = {
            ...DEFAULT_SOUND_SETTINGS,
            chordPlacement: "below" as const,
        };
        expect(harmonyAt(0, settings)).toEqual([52, 55]);
        expect(harmonyAt(0.5, settings)).toEqual([52, 55]);
    });

    it("uses the lower third on stable chord tones only", () => {
        expect(
            harmonyAt(0.25, {
                ...DEFAULT_SOUND_SETTINGS,
                thirdPlacement: "above",
            }),
        ).toEqual([65]);
        expect(
            harmonyAt(0.25, {
                ...DEFAULT_SOUND_SETTINGS,
                thirdPlacement: "below",
            }),
        ).toEqual([]);
        expect(
            harmonyAt(0.5, {
                ...DEFAULT_SOUND_SETTINGS,
                thirdPlacement: "below",
            }),
        ).toEqual([60]);
    });

    it("supports held and repeated opening chords without changing the closing chord", () => {
        const base = {
            ...DEFAULT_SOUND_SETTINGS,
            chordPlacement: "above" as const,
        };
        const held = createArrangement(plan, {
            ...base,
            chordRhythm: "sustain",
        });
        const repeated = createArrangement(plan, {
            ...base,
            chordRhythm: "retrigger",
        });
        expect(
            held.find((note) => note.start === 0 && note.note === 64)?.duration,
        ).toBe(0.5);
        expect(
            repeated.some((note) => note.start === 0.25 && note.note === 64),
        ).toBe(true);
        expect(
            repeated
                .filter(
                    (note) =>
                        note.start === 0.5 &&
                        note.velocity === base.harmonyVelocity,
                )
                .map((note) => note.note),
        ).toEqual([67]);
    });

    it("plays a short ending gesture on the final syllable", () => {
        const ornamented: SoundPlan = {
            ...plan,
            events: plan.events.map((event, index) =>
                index === 2 ? { ...event, endingMidi: 67 } : event,
            ),
        };
        const notes = createArrangement(ornamented, DEFAULT_SOUND_SETTINGS);

        expect(
            notes.some(
                (note) =>
                    note.note === 64 &&
                    note.start === 0.5 &&
                    note.duration < 0.2,
            ),
        ).toBe(true);
        expect(notes.some((note) => note.note === 67 && note.start > 0.5)).toBe(
            true,
        );
    });
});
