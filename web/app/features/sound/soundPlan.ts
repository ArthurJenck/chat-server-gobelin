import {
    INSTRUMENTS,
    INSTRUMENT_PROFILES,
    type SoundSettings,
} from "./soundConfig";

export type TextGroup = { text: string; wordId: number | null };
export type SoundEvent = TextGroup & {
    start: number;
    midi: number | null;
    rest?: "quarter" | "half" | "whole";
    endingMidi?: number;
    velocity?: number;
};
export type SoundPlan = {
    events: SoundEvent[];
    tonicMidi: number;
    density: number;
    noteStep?: number;
};

type VowelFamily = "A" | "E" | "I" | "O" | "U" | "OU" | "IN";
type Syllable = TextGroup & { family: VowelFamily | null };
type Word = { text: string; start: number; end: number; syllables: Syllable[] };
type Phrase = { start: number; end: number };

const RHYTHM_TICK_MS = 60;
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];
const VOWEL_PATTERNS: readonly [string, VowelFamily][] = [
    ["eau", "O"],
    ["oeu", "E"],
    ["ien", "IN"],
    ["ain", "IN"],
    ["ein", "IN"],
    ["oin", "IN"],
    ["ou", "OU"],
    ["au", "O"],
    ["ai", "E"],
    ["ei", "E"],
    ["eu", "E"],
    ["oi", "A"],
    ["ui", "U"],
    ["an", "A"],
    ["en", "A"],
    ["on", "O"],
    ["in", "IN"],
    ["yn", "IN"],
    ["un", "IN"],
    ["a", "A"],
    ["e", "E"],
    ["i", "I"],
    ["o", "O"],
    ["u", "U"],
    ["y", "I"],
];
const ATTACHED_WORDS = new Set([
    "le",
    "la",
    "les",
    "un",
    "une",
    "des",
    "du",
    "de",
    "au",
    "aux",
    "ce",
    "cet",
    "cette",
    "ces",
    "mon",
    "ma",
    "mes",
    "ton",
    "ta",
    "tes",
    "son",
    "sa",
    "ses",
    "notre",
    "votre",
    "leur",
    "leurs",
]);

export function isWordBoundary(previous: TextGroup, current: TextGroup) {
    return (
        previous.wordId !== null &&
        current.wordId !== null &&
        previous.wordId !== current.wordId
    );
}

export function getScaleDegree(
    midi: number,
    tonic: number,
    mode: SoundSettings["mode"],
) {
    const scale = mode === "major" ? MAJOR_INTERVALS : MINOR_INTERVALS;
    const direction = Math.sign(midi - tonic);
    let degree = 0;
    for (
        let offset = direction;
        offset !== 0 && Math.abs(offset) <= Math.abs(midi - tonic);
        offset += direction
    ) {
        if (scale.includes(((offset % 12) + 12) % 12)) degree += direction;
    }
    return degree;
}

export function getScalePitch(
    degree: number,
    tonic: number,
    mode: SoundSettings["mode"],
) {
    const scale = mode === "major" ? MAJOR_INTERVALS : MINOR_INTERVALS;
    const index = ((degree % scale.length) + scale.length) % scale.length;
    return tonic + Math.floor(degree / scale.length) * 12 + scale[index];
}

function randomFromSeed(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function textSeed(text: string, performanceIndex: number) {
    let hash = 2166136261 ^ performanceIndex;
    for (const char of text)
        hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
    return hash >>> 0;
}

function normalizeText(text: string) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function splitWord(word: string, wordId: number): Syllable[] {
    const normalized = normalizeText(word);
    const nuclei: { start: number; end: number; family: VowelFamily }[] = [];
    for (let index = 0; index < normalized.length;) {
        if (normalized[index] === "u" && normalized[index - 1] === "q") {
            index += 1;
            continue;
        }
        if (
            normalized[index] === "e" &&
            word[index]?.toLowerCase() === "e" &&
            index === normalized.length - 1 &&
            nuclei.length > 0
        ) {
            index += 1;
            continue;
        }
        const match = VOWEL_PATTERNS.find(([pattern]) =>
            normalized.startsWith(pattern, index),
        );
        if (!match) {
            index += 1;
            continue;
        }
        nuclei.push({
            start: index,
            end: index + match[0].length,
            family: match[1],
        });
        index += match[0].length;
    }
    if (nuclei.length === 0) return [{ text: word, wordId, family: null }];
    let start = 0;
    return nuclei.map((nucleus, index) => {
        const next = nuclei[index + 1];
        const end = next
            ? Math.max(
                  nucleus.end,
                  next.start - (next.start > nucleus.end ? 1 : 0),
              )
            : word.length;
        const syllable = {
            text: word.slice(start, end),
            wordId,
            family: nucleus.family,
        };
        start = end;
        return syllable;
    });
}

function splitWords(text: string): Word[] {
    return [...new Intl.Segmenter("fr", { granularity: "word" }).segment(text)]
        .filter((part) => part.isWordLike)
        .flatMap((part) => {
            const pieces = part.segment.split(/([,.])/);
            let offset = part.index;
            return pieces.flatMap((piece) => {
                const start = offset;
                offset += piece.length;
                return !piece || piece === "," || piece === "."
                    ? []
                    : [{ text: piece, start, end: offset }];
            });
        })
        .map((word, wordId) => ({ ...word,
            syllables: splitWord(word.text, wordId),
        }));
}

function punctuationParts(text: string, words: Word[]) {
    const rests: { after: number; kind: "quarter" | "half" }[] = [];
    const display: string[] = [];
    let cursor = 0;
    let lastSyllable = -1;
    for (const word of words) {
        const gap = text.slice(cursor, word.start);
        for (const char of gap) {
            if (char === "," || char === ".")
                rests.push({ after: lastSyllable, kind: char === "," ? "quarter" : "half" });
        }
        const other = gap.replace(/[,.\s]/g, "");
        if (other) {
            if (lastSyllable >= 0) display[lastSyllable] += other;
            else display[0] = other + (display[0] ?? "");
        }
        for (const syllable of word.syllables) {
            lastSyllable += 1;
            display[lastSyllable] = (display[lastSyllable] ?? "") + syllable.text;
        }
        cursor = word.end;
    }
    const tail = text.slice(cursor);
    for (const char of tail) {
        if (char === "," || char === ".")
            rests.push({ after: lastSyllable, kind: char === "," ? "quarter" : "half" });
    }
    const other = tail.replace(/[,.\s]/g, "");
    if (other && lastSyllable >= 0) display[lastSyllable] += other;
    return { rests, display, orphan: lastSyllable < 0 ? other : "" };
}

export function segmentText(text: string): TextGroup[] {
    return splitWords(text).flatMap((word) =>
        word.syllables.map(({ text: value, wordId }) => ({
            text: value,
            wordId,
        })),
    );
}

function phraseGroups(text: string, words: Word[]): Phrase[] {
    const units: (Phrase & { breakBefore: boolean })[] = [];
    let start = 0;
    let count = 0;
    let breakBefore = false;
    for (let index = 0; index < words.length; index += 1) {
        const word = words[index];
        const previous = words[index - 1];
        if (previous && /[.!?;:]/.test(text.slice(previous.end, word.start))) {
            if (count > start) {
                units.push({ start, end: count, breakBefore });
                start = count;
            }
            breakBefore = true;
        }
        count += word.syllables.length;
        if (
            !ATTACHED_WORDS.has(normalizeText(word.text)) ||
            index === words.length - 1
        ) {
            units.push({ start, end: count, breakBefore });
            start = count;
            breakBefore = false;
        }
    }
    const phrases: Phrase[] = [];
    for (let index = 0; index < units.length;) {
        const first = index;
        let size = 0;
        while (index < units.length) {
            const unit = units[index];
            const added = unit.end - unit.start;
            if (
                size > 0 &&
                (unit.breakBefore || (size >= 2 && size + added > 4))
            )
                break;
            const remaining = units
                .slice(index + 1)
                .reduce((sum, value) => sum + value.end - value.start, 0);
            if (size >= 2 && remaining === 1) break;
            size += added;
            index += 1;
        }
        if (index === first) index += 1;
        phrases.push({ start: units[first].start, end: units[index - 1].end });
    }
    return phrases;
}

function preferredDirection(
    phrases: Phrase[],
    phraseIndex: number,
    syllableIndex: number,
) {
    const phrase = phrases[phraseIndex];
    if (phrases.length === 1)
        return syllableIndex - phrase.start < (phrase.end - phrase.start) / 2
            ? 1
            : -1;
    if (phraseIndex === 0 || phraseIndex === phrases.length - 1) return -1;
    return phraseIndex % 2 === 1 ? 1 : -1;
}

function scalePitches(tonic: number, settings: SoundSettings) {
    const profile = INSTRUMENT_PROFILES[settings.instrument];
    const shift = (settings.octave - profile.octave) * 12;
    const minimum = profile.minMidi + shift;
    const maximum = profile.maxMidi + shift;
    const upper = Array.from({ length: 7 }, (_, degree) =>
        getScalePitch(degree, tonic, settings.mode),
    ).filter((pitch) => pitch >= minimum && pitch <= maximum);
    if (upper.length) return upper;
    return Array.from({ length: 128 }, (_, pitch) => pitch).filter(
        (pitch) =>
            pitch >= minimum &&
            pitch <= maximum &&
            (settings.mode === "major"
                ? MAJOR_INTERVALS
                : MINOR_INTERVALS
            ).includes((((pitch - tonic) % 12) + 12) % 12),
    );
}

export function createSoundPlan(
    text: string,
    settings: SoundSettings,
    performanceIndex = 0,
): SoundPlan {
    const words = splitWords(text);
    const groups = words.flatMap((word) => word.syllables);
    const { rests, display, orphan } = punctuationParts(text, words);
    const tonicMidi = 12 * (settings.octave + 1) + settings.root;
    if (groups.length === 0 && rests.length === 0)
        return {
            events: orphan ? [{ text: orphan, wordId: null, start: 0, midi: null }] : [],
            tonicMidi,
            density: 0,
        };

    const phrases = phraseGroups(text, words);
    const pitches = scalePitches(tonicMidi, settings);
    const familyDegrees: Record<VowelFamily, number> = {
        A: settings.degreeA,
        E: settings.degreeE,
        I: settings.degreeI,
        O: settings.degreeO,
        U: settings.degreeU,
        OU: settings.degreeOU,
        IN: settings.degreeIN,
    };
    const random = randomFromSeed(
        textSeed(normalizeText(text), performanceIndex),
    );
    const baseInterval =
        settings.intervalMs /
        (settings.speedMode === "length"
            ? 1 + settings.lengthFactor * Math.log2(Math.max(1, groups.length))
            : 1);
    const noteTicks = Math.max(1, Math.round(baseInterval / RHYTHM_TICK_MS));
    const wordTicks = Math.round(settings.wordGap / RHYTHM_TICK_MS);
    const gaps = groups.slice(1).map((group, index) => {
        const base =
            noteTicks + (isWordBoundary(groups[index], group) ? wordTicks : 0);
        return performanceIndex === 0
            ? base
            : Math.max(
                  1,
                  base *
                      (1 + (random() - 0.5) * 0.12 * settings.variationWeight),
              );
    });
    const rawTicks = gaps.reduce((sum, gap) => sum + gap, 0) +
        rests.reduce((sum, rest) => sum + (rest.kind === "quarter" ? 1 : 2) * noteTicks, 0);
    const finalHold = Math.max(
        INSTRUMENTS[settings.instrument].lastDuration,
        (settings.intervalMs * settings.gate) / 1000,
    );
    const onsetBudget = Math.max(0.1, settings.maxDuration - finalHold - 1.6);
    const tickMs =
        settings.speedMode === "fixed" && rawTicks > 0
            ? Math.min(RHYTHM_TICK_MS, (onsetBudget * 1000) / rawTicks)
            : RHYTHM_TICK_MS;
    const starts = [0];
    for (const gap of gaps) starts.push(starts.at(-1)! + (gap * tickMs) / 1000);

    const notes: SoundEvent[] = [];
    let previousPitch = tonicMidi;
    let phraseIndex = 0;
    const isQuestion = /\?[\s"'»”)]*$/.test(text);
    const hasQuestionRise = pitches.some((pitch) =>
        pitches.some((higher) => higher > pitch && higher - pitch <= 5),
    );
    for (let index = 0; index < groups.length; index += 1) {
        while (
            phraseIndex < phrases.length - 1 &&
            index >= phrases[phraseIndex].end
        )
            phraseIndex += 1;
        const group = groups[index];
        const target =
            group.family === null ? null : familyDegrees[group.family];
        const direction = preferredDirection(phrases, phraseIndex, index);
        const sameSyllable =
            index > 0 &&
            group.wordId === groups[index - 1].wordId &&
            normalizeText(group.text) === normalizeText(groups[index - 1].text);
        const previousDegree =
            ((getScaleDegree(previousPitch, tonicMidi, settings.mode) % 7) +
                7) %
            7;
        const previousTension = ![0, 2, 4].includes(previousDegree);
        let bestPitch = pitches[0] ?? tonicMidi;
        let bestScore = -Infinity;
        for (const pitch of pitches) {
            if (
                isQuestion &&
                hasQuestionRise &&
                index === groups.length - 1 &&
                !pitches.some((higher) => higher > pitch && higher - pitch <= 5)
            )
                continue;
            const degree =
                ((getScaleDegree(pitch, tonicMidi, settings.mode) % 7) + 7) % 7;
            const chordTone = degree === 0 || degree === 2 || degree === 4;
            const difference = pitch - previousPitch;
            let score =
                (degree === target ? settings.soundWeight : 0) +
                (chordTone ? settings.chordWeight : 0) +
                (index > 0 && Math.sign(difference) === direction
                    ? settings.directionWeight
                    : 0) +
                (index > 0 && difference === 0
                    ? sameSyllable
                        ? settings.repetitionWeight
                        : -settings.repeatPenalty
                    : 0) +
                (index > 0 &&
                previousTension &&
                chordTone &&
                Math.abs(difference) <= 2
                    ? settings.resolutionWeight
                    : 0) -
                (Math.abs(difference) > 5 ? settings.leapPenalty : 0);
            if (performanceIndex > 0)
                score += (random() - 0.5) * settings.variationWeight;
            if (score > bestScore) {
                bestScore = score;
                bestPitch = pitch;
            }
        }
        notes.push({
            text: display[index],
            wordId: group.wordId,
            start: starts[index],
            midi: bestPitch,
        });
        previousPitch = bestPitch;
    }

    const last = notes.at(-1);
    if (last) {
        if (/![\s"'»”)]*$/.test(text)) last.velocity = 105;
        const ending = isQuestion
            ? pitches.find((pitch) => pitch > last.midi! && pitch - last.midi! <= 5)
            : pitches.find((pitch) => pitch === tonicMidi);
        if (ending !== undefined && ending !== last.midi) {
            const holdScore =
                settings.soundWeight +
                (getScaleDegree(last.midi!, tonicMidi, settings.mode) % 7 === 0
                    ? settings.chordWeight
                    : 0);
            const endingScore =
                settings.cadenceWeight + (isQuestion ? 0 : settings.chordWeight);
            if (endingScore > holdScore) last.endingMidi = ending;
        }
    }

    const noteStep = (noteTicks * tickMs) / 1000;
    const events: SoundEvent[] = [];
    let restIndex = 0;
    let restOffset = 0;
    const appendRests = (after: number, base: number) => {
        while (rests[restIndex]?.after === after) {
            const kind = rests[restIndex].kind;
            events.push({ text: kind === "quarter" ? "," : ".", wordId: null,
                start: base + restOffset, midi: null, rest: kind });
            restOffset += noteStep * (kind === "quarter" ? 1 : 2);
            restIndex += 1;
        }
    };
    appendRests(-1, 0);
    notes.forEach((note, index) => {
        events.push({ ...note, start: note.start + restOffset });
        appendRests(index, note.start + noteStep);
    });
    if (orphan) events.push({ text: orphan, wordId: null, start: restOffset, midi: null });
    const duration = rests.length
        ? Math.max(noteStep, (events.at(-1)?.start ?? 0) + noteStep)
        : starts.at(-1) || noteStep;
    return {
        events,
        tonicMidi,
        density: notes.length / Math.max(duration, 0.001),
        noteStep,
    };
}
