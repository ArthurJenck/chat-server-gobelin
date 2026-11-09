import { describe, expect, it } from 'vitest'
import { createArrangement } from '../app/sound/arrangement'
import { DEFAULT_SOUND_SETTINGS } from '../app/sound/soundConfig'
import type { SoundPlan } from '../app/sound/soundPlan'

const plan: SoundPlan = {
    tonicMidi: 60,
    density: 4,
    noteStep: 0.25,
    events: [
        { text: 'do', wordId: 0, start: 0, midi: 60 },
        { text: 'ré', wordId: 0, start: 0.25, midi: 62 },
        { text: 'mi', wordId: 0, start: 0.5, midi: 64 },
    ],
}

function harmonyAt(start: number, settings: typeof DEFAULT_SOUND_SETTINGS) {
    return createArrangement(plan, settings)
        .filter((note) => note.start === start && note.velocity === settings.harmonyVelocity)
        .map((note) => note.note)
}

describe('sound arrangement', () => {
    it('builds the first and last chords in the message scale', () => {
        const settings = { ...DEFAULT_SOUND_SETTINGS, chordPlacement: 'above' as const }
        expect(harmonyAt(0, settings)).toEqual([64, 67])
        expect(harmonyAt(0.25, settings)).toEqual([])
        expect(harmonyAt(0.5, settings)).toEqual([67, 71])
    })

    it('can keep every chord major and place its tones below the melody', () => {
        const settings = { ...DEFAULT_SOUND_SETTINGS, chordPlacement: 'below' as const, chordQuality: 'uniform' as const }
        expect(harmonyAt(0, settings)).toEqual([52, 55])
        expect(harmonyAt(0.5, settings)).toEqual([56, 59])
    })

    it('harmonizes each note with the third in the selected direction', () => {
        expect(harmonyAt(0.25, { ...DEFAULT_SOUND_SETTINGS, thirdPlacement: 'above' })).toEqual([65])
        expect(harmonyAt(0.25, { ...DEFAULT_SOUND_SETTINGS, thirdPlacement: 'below' })).toEqual([59])
    })

    it('supports held and repeated opening chords without changing the closing chord', () => {
        const base = { ...DEFAULT_SOUND_SETTINGS, chordPlacement: 'above' as const }
        const held = createArrangement(plan, { ...base, chordRhythm: 'sustain' })
        const repeated = createArrangement(plan, { ...base, chordRhythm: 'retrigger' })
        expect(held.find((note) => note.start === 0 && note.note === 64)?.duration).toBe(0.5)
        expect(repeated.some((note) => note.start === 0.25 && note.note === 64)).toBe(true)
        expect(repeated.filter((note) => note.start === 0.5 && note.velocity === base.harmonyVelocity).map((note) => note.note)).toEqual([67, 71])
    })
})
