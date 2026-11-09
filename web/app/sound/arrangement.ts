import { INSTRUMENTS, type SoundSettings } from './soundConfig'
import { getScaleDegree, getScalePitch, type SoundPlan } from './soundPlan'

export type PlaybackNote = { note: number, start: number, duration: number, velocity: number }

function noteDuration(plan: SoundPlan, index: number, lastIndex: number, settings: SoundSettings) {
    const nextStart = index === lastIndex ? undefined : plan.events[index + 1]?.start
    const span = nextStart === undefined
        ? plan.noteStep ?? settings.intervalMs / 1000
        : Math.min(plan.noteStep ?? settings.intervalMs / 1000, Math.max(0.001, nextStart - plan.events[index].start))
    const active = Math.max(0.001, span * settings.gate)
    return index === lastIndex
        ? Math.max(active, INSTRUMENTS[settings.instrument].lastDuration)
        : active
}

function chordTones(root: number, plan: SoundPlan, settings: SoundSettings) {
    if (settings.chordQuality === 'uniform') {
        const third = settings.mode === 'major' ? 4 : 3
        return settings.chordPlacement === 'above'
            ? [root + third, root + 7]
            : [root + third - 12, root - 5]
    }
    const degree = getScaleDegree(root, plan.tonicMidi, settings.mode)
    return settings.chordPlacement === 'above'
        ? [getScalePitch(degree + 2, plan.tonicMidi, settings.mode), getScalePitch(degree + 4, plan.tonicMidi, settings.mode)]
        : [getScalePitch(degree - 5, plan.tonicMidi, settings.mode), getScalePitch(degree - 3, plan.tonicMidi, settings.mode)]
}

export function createArrangement(plan: SoundPlan, settings: SoundSettings): PlaybackNote[] {
    const noteIndexes = plan.events.flatMap((event, index) => event.midi === null ? [] : [index])
    const firstIndex = noteIndexes[0]
    const lastIndex = noteIndexes.at(-1)
    if (firstIndex === undefined || lastIndex === undefined) return []

    const notes: PlaybackNote[] = []
    const add = (note: number, start: number, duration: number, velocity: number) => {
        if (note < 0 || note > 127) return
        const existing = notes.find((value) => value.note === note && value.start === start)
        if (existing) {
            existing.duration = Math.max(existing.duration, duration)
            existing.velocity = Math.max(existing.velocity, velocity)
        } else notes.push({ note, start, duration, velocity })
    }

    for (const index of noteIndexes) {
        const event = plan.events[index]
        const duration = noteDuration(plan, index, lastIndex, settings)
        add(event.midi!, event.start, duration, 90)
        if (settings.thirdPlacement !== 'off') {
            const degree = getScaleDegree(event.midi!, plan.tonicMidi, settings.mode)
            const thirdDegree = degree + (settings.thirdPlacement === 'above' ? 2 : -2)
            add(getScalePitch(thirdDegree, plan.tonicMidi, settings.mode), event.start, duration, settings.harmonyVelocity)
        }
    }

    if (settings.chordPlacement !== 'off') {
        const first = plan.events[firstIndex]
        const last = plan.events[lastIndex]
        const addChord = (root: number, start: number, duration: number) => {
            for (const note of chordTones(root, plan, settings)) {
                add(note, start, duration, settings.harmonyVelocity)
            }
        }
        if (settings.chordRhythm === 'retrigger') {
            for (const index of noteIndexes.slice(0, -1)) {
                const event = plan.events[index]
                addChord(first.midi!, event.start, noteDuration(plan, index, lastIndex, settings))
            }
        } else if (firstIndex !== lastIndex) {
            const duration = settings.chordRhythm === 'sustain'
                ? Math.max(noteDuration(plan, firstIndex, lastIndex, settings), last.start - first.start)
                : noteDuration(plan, firstIndex, lastIndex, settings)
            addChord(first.midi!, first.start, duration)
        }
        addChord(last.midi!, last.start, noteDuration(plan, lastIndex, lastIndex, settings))
    }

    return notes.sort((left, right) => left.start - right.start || left.note - right.note)
}
