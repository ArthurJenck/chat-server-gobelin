import { describe, expect, it } from "vitest";
import {
    DEFAULT_SOUND_SETTINGS,
    INSTRUMENTS,
    withInstrumentProfile,
} from "../app/features/sound/soundConfig";
import {
    createSoundPlan,
    getScaleDegree,
    segmentText,
} from "../app/features/sound/soundPlan";
import {
    parsePreset,
    readSavedInstrumentProfiles,
    saveInstrumentProfiles,
    serializePreset,
} from "../app/features/sound/soundPreset";

describe("sound workshop", () => {
    it("starts each instrument in its own register and articulation", () => {
        expect(Object.keys(INSTRUMENTS)).not.toContain("drums");
        expect(
            withInstrumentProfile(DEFAULT_SOUND_SETTINGS, "flute"),
        ).toMatchObject({
            instrument: "flute",
            octave: 5,
            intervalMs: 480,
            wordGap: 120,
            gate: 0.9,
        });
        expect(
            withInstrumentProfile(DEFAULT_SOUND_SETTINGS, "guitar"),
        ).toMatchObject({
            instrument: "guitar",
            octave: 4,
            intervalMs: 120,
            gate: 0.35,
        });
    });

    it("keeps notes in the selected instrument register", () => {
        const settings = withInstrumentProfile(
            DEFAULT_SOUND_SETTINGS,
            "piccolo",
        );
        const plan = createSoundPlan(
            "La musique traverse les nuages",
            settings,
        );

        expect(
            plan.events.every(
                (event) =>
                    event.midi !== null &&
                    event.midi >= 72 &&
                    event.midi <= 100,
            ),
        ).toBe(true);
    });

    it("keeps the same scale-degree motif across piano, guitar and flute profiles", () => {
        const motifs = (["piano", "guitar", "flute"] as const).map(
            (instrument) => {
                const settings = withInstrumentProfile(
                    DEFAULT_SOUND_SETTINGS,
                    instrument,
                );
                const plan = createSoundPlan(
                    "Coucou les gars ça va super bien !",
                    settings,
                );
                return plan.events.map((event) =>
                    getScaleDegree(event.midi!, plan.tonicMidi, settings.mode),
                );
            },
        );

        expect(motifs[1]).toEqual(motifs[0]);
        expect(motifs[2]).toEqual(motifs[0]);
    });

    it("places the reference performance on the rhythmic grid", () => {
        const text = "La musique est belle aujourd’hui";
        for (const instrument of ["guitar", "piano", "flute"] as const) {
            const plan = createSoundPlan(
                text,
                withInstrumentProfile(DEFAULT_SOUND_SETTINGS, instrument),
            );
            expect(
                plan.events.every(
                    (event) =>
                        Math.abs(
                            (event.start * 1000) / 60 -
                                Math.round((event.start * 1000) / 60),
                        ) < 0.000001,
                ),
            ).toBe(true);
        }
    });

    it("reserves time for the last note when shortening a long phrase", () => {
        const settings = {
            ...withInstrumentProfile(DEFAULT_SOUND_SETTINGS, "flute"),
            speedMode: "fixed" as const,
        };
        const plan = createSoundPlan("la ".repeat(100), settings);

        expect(
            plan.events.at(-1)!.start + INSTRUMENTS.flute.lastDuration + 1.6,
        ).toBeCloseTo(settings.maxDuration);
    });

    it("saves each instrument adjustment independently", () => {
        saveInstrumentProfiles({
            flute: { octave: 5, intervalMs: 420, wordGap: 180, gate: 0.85 },
        });

        expect(readSavedInstrumentProfiles().flute).toEqual({
            octave: 5,
            intervalMs: 420,
            wordGap: 180,
            gate: 0.85,
        });
        expect(readSavedInstrumentProfiles().guitar).toBeUndefined();
    });

    it("keeps every syllable within the maximum onset duration", () => {
        const settings = {
            ...DEFAULT_SOUND_SETTINGS,
            speedMode: "fixed" as const,
            maxDuration: 4,
        };
        const plan = createSoundPlan("a".repeat(200), settings);

        expect(plan.events).toHaveLength(200);
        expect(plan.events.at(-1)?.start).toBeLessThanOrEqual(4);
        expect(
            plan.events.every(
                (event, index) =>
                    index === 0 || event.start >= plan.events[index - 1].start,
            ),
        ).toBe(true);
    });

    it("preserves large note and word pauses in adaptive mode", () => {
        const settings = {
            ...DEFAULT_SOUND_SETTINGS,
            speedMode: "length" as const,
            lengthFactor: 0,
            intervalMs: 1000,
            wordGap: 2000,
        };
        const plan = createSoundPlan("Coucou les gars ça va", settings);
        const gaps = plan.events
            .slice(1)
            .map((event, index) => event.start - plan.events[index].start);

        expect(gaps[0]).toBeCloseTo(1.02);
        expect(
            gaps.slice(1).every((gap) => Math.abs(gap - 3) < 0.000001),
        ).toBe(true);
        expect(plan.events.at(-1)!.start).toBeGreaterThan(settings.maxDuration);
    });

    it("changes density smoothly as pauses grow in fixed mode", () => {
        const settings = {
            ...DEFAULT_SOUND_SETTINGS,
            speedMode: "fixed" as const,
        };
        const plans = [500, 600, 700, 800, 900].map((wordGap) =>
            createSoundPlan("la la la la la la la la la la", {
                ...settings,
                wordGap,
            }),
        );
        const densities = plans.map((plan) => plan.density);

        expect(
            densities.every(
                (density, index) =>
                    index === 0 || density <= densities[index - 1] + 0.000001,
            ),
        ).toBe(true);
        expect(
            plans.every(
                (plan) =>
                    plan.events.at(-1)!.start +
                        INSTRUMENTS.piano.lastDuration +
                        1.6 <=
                    settings.maxDuration + 0.000001,
            ),
        ).toBe(true);
    });

    it("recognizes written sound families before individual vowels", () => {
        expect(
            segmentText("Coucou les gars ça va super bien !").map(
                (group) => group.text,
            ),
        ).toEqual([
            "Cou",
            "cou",
            "les",
            "gars",
            "ça",
            "va",
            "su",
            "per",
            "bien",
        ]);
        expect(segmentText("sot saut seau").map((group) => group.text)).toEqual(
            ["sot", "saut", "seau"],
        );
        const notes = ["sot", "saut", "seau"].map(
            (word) =>
                createSoundPlan(word, DEFAULT_SOUND_SETTINGS).events[0].midi,
        );
        expect(new Set(notes).size).toBe(1);
        const eNotes = ["gai", "dé", "fer"].map(
            (word) =>
                createSoundPlan(word, DEFAULT_SOUND_SETTINGS).events[0].midi,
        );
        expect(new Set(eNotes).size).toBe(1);
        expect(
            createSoundPlan("an", DEFAULT_SOUND_SETTINGS).events[0].midi,
        ).toBe(createSoundPlan("en", DEFAULT_SOUND_SETTINGS).events[0].midi);
    });

    it("repeats an identical syllable inside a word and relaunches across words", () => {
        const plan = createSoundPlan(
            "Coucou les gars ça va super bien !",
            DEFAULT_SOUND_SETTINGS,
        );
        const notes = plan.events.map((event) => event.midi);

        expect(plan.events.map((event) => event.text)).toEqual([
            "Cou",
            "cou",
            "les",
            "gars",
            "ça",
            "va",
            "su",
            "per",
            "bien!",
        ]);
        expect(notes).toEqual([79, 79, 76, 72, 76, 79, 77, 76, 74]);
        expect(notes[0]).toBe(notes[1]);
        expect(notes[3]).toBeLessThan(notes[4]!);
        expect(notes[4]).toBeLessThan(notes[5]!);
        expect(plan.events.at(-1)?.endingMidi).toBe(plan.tonicMidi);
    });

    it("uses question punctuation for a rising ending", () => {
        const statement = createSoundPlan(
            "salut ça va.",
            DEFAULT_SOUND_SETTINGS,
        );
        const question = createSoundPlan(
            "salut ça va ?",
            DEFAULT_SOUND_SETTINGS,
        );

        expect(question.events.map((event) => event.text)).toEqual([
            "sa", "lut", "ça", "va?",
        ]);
        expect(statement.events.map((event) => event.midi).filter((midi) => midi !== null)).toEqual([
            72, 77, 72, 72,
        ]);
        expect(question.events.slice(0, -1).map((event) => event.midi)).toEqual(
            statement.events.slice(0, -2).map((event) => event.midi),
        );
        expect(question.events.at(-1)?.endingMidi).toBeGreaterThan(
            question.events.at(-1)!.midi!,
        );
    });

    it.each(["fixed", "length"] as const)(
        "inserts real rests before, between and after notes in %s mode",
        (speedMode) => {
            const plan = createSoundPlan(",salut, ça va.", {
                ...DEFAULT_SOUND_SETTINGS,
                speedMode,
            });
            const rests = plan.events.filter((event) => event.rest);
            expect(rests.map((event) => event.rest)).toEqual(["quarter", "quarter", "half"]);
            const notes = plan.events.filter((event) => event.midi !== null);
            expect(notes[0].start).toBeCloseTo(plan.noteStep!);
            expect(notes.find((event) => event.text === "ça")!.start)
                .toBeGreaterThanOrEqual(rests[1].start + plan.noteStep!);
            expect(rests[2].start).toBeGreaterThan(notes.at(-1)!.start);
            expect(plan.events.at(-1)?.rest).toBe("half");
        },
    );

    it("accents the last syllable of an exclamation", () => {
        const exclamation = createSoundPlan(
            "Coucou les gars ça va super bien !",
            DEFAULT_SOUND_SETTINGS,
        );
        const statement = createSoundPlan(
            "Coucou les gars ça va super bien.",
            DEFAULT_SOUND_SETTINGS,
        );

        expect(exclamation.events.at(-1)?.velocity).toBe(105);
        expect(statement.events.at(-1)?.velocity).toBeUndefined();
    });

    it("changes melody choices when selection weights change", () => {
        const text = "Coucou les gars ça va super bien !";
        const guided = createSoundPlan(text, DEFAULT_SOUND_SETTINGS);
        const literal = createSoundPlan(text, {
            ...DEFAULT_SOUND_SETTINGS,
            soundWeight: 12,
            directionWeight: 0,
        });

        expect(guided.events.map((event) => event.midi)).not.toEqual(
            literal.events.map((event) => event.midi),
        );
    });

    it("lets the sound family mapping change the motif", () => {
        const sol = createSoundPlan("Coucou", DEFAULT_SOUND_SETTINGS);
        const doNotes = createSoundPlan("Coucou", {
            ...DEFAULT_SOUND_SETTINGS,
            degreeOU: 0,
        });

        expect(sol.events.map((event) => event.midi)).not.toEqual(
            doNotes.events.map((event) => event.midi),
        );
    });

    it("keeps the motif while varying playback timing", () => {
        const text = "Coucou les gars ça va super bien !";
        const reference = createSoundPlan(text, DEFAULT_SOUND_SETTINGS);
        const replay = createSoundPlan(text, DEFAULT_SOUND_SETTINGS, 1);

        expect(createSoundPlan(text, DEFAULT_SOUND_SETTINGS)).toEqual(
            reference,
        );
        expect(createSoundPlan(text, DEFAULT_SOUND_SETTINGS, 1)).toEqual(
            replay,
        );
        expect(replay.events.map((event) => event.text)).toEqual(
            reference.events.map((event) => event.text),
        );
        expect(replay.events.map((event) => event.start)).not.toEqual(
            reference.events.map((event) => event.start),
        );
    });

    it("transposes scale degrees between parallel major and minor", () => {
        const major = createSoundPlan("Coucou", DEFAULT_SOUND_SETTINGS);
        const minor = createSoundPlan("Coucou", {
            ...DEFAULT_SOUND_SETTINGS,
            mode: "minor",
        });

        expect(major.tonicMidi).toBe(minor.tonicMidi);
        expect(
            major.events.every((event) =>
                [0, 2, 4, 5, 7, 9, 11].includes(
                    (((event.midi! - major.tonicMidi) % 12) + 12) % 12,
                ),
            ),
        ).toBe(true);
        expect(
            minor.events.every((event) =>
                [0, 2, 3, 5, 7, 8, 10].includes(
                    (((event.midi! - minor.tonicMidi) % 12) + 12) % 12,
                ),
            ),
        ).toBe(true);
    });

    it("round trips a versioned settings preset", () => {
        const settings = {
            ...DEFAULT_SOUND_SETTINGS,
            instrument: "trumpet" as const,
            soundWeight: 7,
            echoEnabled: true,
        };
        expect(JSON.parse(serializePreset(settings)).version).toBe(7);
        expect(parsePreset(serializePreset(settings))).toEqual(settings);
        expect(
            parsePreset(serializePreset({ ...settings, instrument: "flute" })),
        ).toEqual({ ...settings, instrument: "flute" });
        expect(() => parsePreset('{"version": 99}')).toThrow();
        expect(() =>
            parsePreset(
                serializePreset({
                    ...settings,
                    instrument: "unknown" as "trumpet",
                }),
            ),
        ).toThrow();
        expect(() =>
            parsePreset(serializePreset({ ...settings, degreeOU: 2.5 })),
        ).toThrow();
    });

    it("migrates older presets to the new weights", () => {
        const old = {
            ...DEFAULT_SOUND_SETTINGS,
            algorithm: "skeleton",
            contour: "arch",
            melodyMovement: 9,
            phraseLength: 6,
        };
        const {
            degreeA: _degreeA,
            degreeE: _degreeE,
            degreeI: _degreeI,
            degreeO: _degreeO,
            degreeU: _degreeU,
            degreeOU: _degreeOU,
            degreeIN: _degreeIN,
            soundWeight: _soundWeight,
            chordWeight: _chordWeight,
            directionWeight: _directionWeight,
            repetitionWeight: _repetitionWeight,
            repeatPenalty: _repeatPenalty,
            leapPenalty: _leapPenalty,
            resolutionWeight: _resolutionWeight,
            cadenceWeight: _cadenceWeight,
            variationWeight: _variationWeight,
            ...withoutWeights
        } = old;
        expect(
            parsePreset(
                JSON.stringify({ version: 6, settings: withoutWeights }),
            ),
        ).toEqual(DEFAULT_SOUND_SETTINGS);
        const relative = parsePreset(
            JSON.stringify({
                version: 6,
                settings: {
                    ...withoutWeights,
                    mode: "minor",
                    relation: "relative",
                },
            }),
        );
        expect(relative).toMatchObject({ root: 9, octave: 4, mode: "minor" });
    });
});
