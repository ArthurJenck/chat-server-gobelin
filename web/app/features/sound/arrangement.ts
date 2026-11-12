import { INSTRUMENTS, type SoundSettings } from "./soundConfig";
import { getScaleDegree, getScalePitch, type SoundPlan } from "./soundPlan";

export type PlaybackNote = {
    note: number;
    start: number;
    duration: number;
    velocity: number;
};

function noteDuration(
    plan: SoundPlan,
    index: number,
    lastIndex: number,
    settings: SoundSettings,
) {
    const nextStart =
        index === lastIndex ? undefined : plan.events[index + 1]?.start;
    const span =
        nextStart === undefined
            ? (plan.noteStep ?? settings.intervalMs / 1000)
            : Math.min(
                  plan.noteStep ?? settings.intervalMs / 1000,
                  Math.max(0.001, nextStart - plan.events[index].start),
              );
    const active = Math.max(0.001, span * settings.gate);
    if (plan.events[index + 1]?.rest) return active;
    return index === lastIndex
        ? Math.max(active, INSTRUMENTS[settings.instrument].lastDuration)
        : active;
}

function chordTones(root: number, plan: SoundPlan, settings: SoundSettings) {
    const degree = getScaleDegree(root, plan.tonicMidi, settings.mode);
    return settings.chordPlacement === "above"
        ? [
              getScalePitch(degree + 2, plan.tonicMidi, settings.mode),
              getScalePitch(degree + 4, plan.tonicMidi, settings.mode),
          ]
        : [
              getScalePitch(degree - 5, plan.tonicMidi, settings.mode),
              getScalePitch(degree - 3, plan.tonicMidi, settings.mode),
          ];
}

export function createArrangement(
    plan: SoundPlan,
    settings: SoundSettings,
): PlaybackNote[] {
    const noteIndexes = plan.events.flatMap((event, index) =>
        event.midi === null ? [] : [index],
    );
    const firstIndex = noteIndexes[0];
    const lastIndex = noteIndexes.at(-1);
    if (firstIndex === undefined || lastIndex === undefined) return [];

    const notes: PlaybackNote[] = [];
    const add = (
        note: number,
        start: number,
        duration: number,
        velocity: number,
    ) => {
        if (note < 0 || note > 127) return;
        const existing = notes.find(
            (value) => value.note === note && value.start === start,
        );
        if (existing) {
            existing.duration = Math.max(existing.duration, duration);
            existing.velocity = Math.max(existing.velocity, velocity);
        } else notes.push({ note, start, duration, velocity });
    };

    for (const index of noteIndexes) {
        const event = plan.events[index];
        const duration = noteDuration(plan, index, lastIndex, settings);
        const ornamentDelay =
            event.endingMidi === undefined
                ? 0
                : Math.min(0.15, duration * 0.35);
        add(
            event.midi!,
            event.start,
            ornamentDelay || duration,
            event.velocity ?? 90,
        );
        if (event.endingMidi !== undefined) {
            add(
                event.endingMidi,
                event.start + ornamentDelay,
                Math.max(0.001, duration - ornamentDelay),
                event.velocity ?? 90,
            );
        }
        if (
            settings.thirdPlacement !== "off" &&
            event.endingMidi === undefined
        ) {
            const degree = getScaleDegree(
                event.midi!,
                plan.tonicMidi,
                settings.mode,
            );
            if (
                settings.thirdPlacement === "above" ||
                [2, 4].includes(((degree % 7) + 7) % 7)
            ) {
                const thirdDegree =
                    degree + (settings.thirdPlacement === "above" ? 2 : -2);
                add(
                    getScalePitch(thirdDegree, plan.tonicMidi, settings.mode),
                    event.start,
                    duration,
                    settings.harmonyVelocity,
                );
            }
        }
    }

    if (settings.chordPlacement !== "off") {
        const addChord = (root: number, start: number, duration: number) => {
            for (const note of chordTones(root, plan, settings)) {
                add(note, start, duration, settings.harmonyVelocity);
            }
        };
        const segments: number[][] = [[]];
        plan.events.forEach((event, index) => {
            if (event.rest && segments.at(-1)!.length) segments.push([]);
            else if (event.midi !== null) segments.at(-1)!.push(index);
        });
        for (const indexes of segments.filter((segment) => segment.length)) {
            const segmentFirst = indexes[0];
            const segmentLast = indexes.at(-1)!;
            const first = plan.events[segmentFirst];
            const last = plan.events[segmentLast];
            if (settings.chordRhythm === "retrigger") {
                for (const index of indexes.slice(0, -1)) {
                    const event = plan.events[index];
                    addChord(
                        plan.tonicMidi,
                        event.start,
                        noteDuration(plan, index, segmentLast, settings),
                    );
                }
            } else if (segmentFirst !== segmentLast) {
                const duration =
                    settings.chordRhythm === "sustain"
                        ? Math.max(
                              noteDuration(
                                  plan,
                                  segmentFirst,
                                  segmentLast,
                                  settings,
                              ),
                              last.start - first.start,
                          )
                        : noteDuration(
                              plan,
                              segmentFirst,
                              segmentLast,
                              settings,
                          );
                addChord(plan.tonicMidi, first.start, duration);
            }
            addChord(
                plan.tonicMidi,
                last.start,
                noteDuration(plan, segmentLast, segmentLast, settings),
            );
        }
    }

    return notes.sort(
        (left, right) => left.start - right.start || left.note - right.note,
    );
}
