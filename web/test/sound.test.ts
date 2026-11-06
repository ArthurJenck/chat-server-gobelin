import { describe, expect, it } from 'vitest'
import { DEFAULT_SOUND_SETTINGS } from '../app/sound/soundConfig'
import { createSoundPlan, segmentText } from '../app/sound/soundPlan'
import { parsePreset, serializePreset } from '../app/sound/soundPreset'

describe('sound workshop', () => {
    it('keeps every text group within the maximum onset duration', () => {
        const settings = { ...DEFAULT_SOUND_SETTINGS, segmentation: 'characters' as const, speedMode: 'fixed' as const, maxDuration: 4 }
        const plan = createSoundPlan('a'.repeat(200), settings)

        expect(plan.events).toHaveLength(200)
        expect(plan.events.at(-1)?.start).toBeLessThanOrEqual(4)
        expect(plan.events.every((event, index) => index === 0 || event.start >= plan.events[index - 1].start)).toBe(true)
    })

    it('limits pitch changes only inside unambiguous words', () => {
        const settings = {
            ...DEFAULT_SOUND_SETTINGS,
            segmentation: 'characters' as const,
            limitWithinWord: true,
            maxWithinWordSemitones: 0,
        }
        const plan = createSoundPlan('ma lu', settings)
        const notes = plan.events.filter((event) => event.midi !== null)

        expect(notes.filter((event) => event.wordId === 0).map((event) => event.midi)).toEqual([notes[0].midi, notes[0].midi])
        expect(notes.filter((event) => event.wordId === 1).map((event) => event.midi)).toEqual([notes[2].midi, notes[2].midi])
    })

    it('uses the selected major tonic for relative and parallel minor', () => {
        const relative = createSoundPlan('bonjour', { ...DEFAULT_SOUND_SETTINGS, mode: 'minor', relation: 'relative' })
        const parallel = createSoundPlan('bonjour', { ...DEFAULT_SOUND_SETTINGS, mode: 'minor', relation: 'parallel' })

        expect(relative.tonicMidi).toBe(57)
        expect(parallel.tonicMidi).toBe(60)
        expect(relative.events.every((event) => event.midi !== null)).toBe(true)
        expect(parallel.events.every((event) => event.midi !== null)).toBe(true)
    })

    it('generates stable in-scale notes with both algorithms', () => {
        for (const algorithm of ['skeleton', 'transitions'] as const) {
            const settings = { ...DEFAULT_SOUND_SETTINGS, algorithm }
            const first = createSoundPlan('La musique est belle', settings)
            const second = createSoundPlan('La musique est belle', settings)

            expect(first).toEqual(second)
            expect(first.events.some((event) => event.midi !== null)).toBe(true)
            expect(first.events.filter((event) => event.midi !== null).every((event) =>
                [0, 2, 4, 5, 7, 9, 11].includes(((event.midi as number) - first.tonicMidi + 120) % 12),
            )).toBe(true)
        }
    })

    it('lets the skeleton phrase length change its anchored contour', () => {
        const text = 'La musique transforme les messages en petites phrases'
        const short = createSoundPlan(text, { ...DEFAULT_SOUND_SETTINGS, segmentation: 'characters', phraseLength: 3 })
        const long = createSoundPlan(text, { ...DEFAULT_SOUND_SETTINGS, segmentation: 'characters', phraseLength: 12 })

        expect(short.events.map((event) => event.midi)).not.toEqual(long.events.map((event) => event.midi))
    })

    it('shows the difference between syllable grouping across and within words', () => {
        const across = segmentText('j’aime aussi', { ...DEFAULT_SOUND_SETTINGS, segmentation: 'syllables', crossWordSyllables: true })
        const within = segmentText('j’aime aussi', { ...DEFAULT_SOUND_SETTINGS, segmentation: 'syllables', crossWordSyllables: false })

        expect(across.some((group) => group.wordId === null)).toBe(true)
        expect(within.every((group) => group.wordId !== null)).toBe(true)
        expect(across.map((group) => group.text.toLowerCase())).toEqual(['j’ai', 'meau', 'ssi'])
        expect(within).toHaveLength(4)
    })

    it('keeps a consonant-only word in cross-word syllable mode', () => {
        const groups = segmentText('psst', { ...DEFAULT_SOUND_SETTINGS, segmentation: 'syllables', crossWordSyllables: true })
        expect(groups.map((group) => group.text).join('')).toBe('psst')
    })

    it('varies notes inside a short word and changes the contour on a short message', () => {
        const text = 'J’aime aussi'
        const rising = createSoundPlan(text, { ...DEFAULT_SOUND_SETTINGS, contour: 'ascending' })
        const falling = createSoundPlan(text, { ...DEFAULT_SOUND_SETTINGS, contour: 'descending' })

        expect(rising.events[0].midi).not.toBe(rising.events[1].midi)
        expect(rising.events.map((event) => event.midi)).not.toEqual(falling.events.map((event) => event.midi))
    })

    it('adds a pause without dropping a syllable', () => {
        const text = 'J’aime aussi'
        const plain = createSoundPlan(text, DEFAULT_SOUND_SETTINGS)
        const paused = createSoundPlan(text, { ...DEFAULT_SOUND_SETTINGS, restChance: 0.8 })

        expect(paused.events.map((event) => event.text)).toEqual(plain.events.map((event) => event.text))
        expect(paused.events.every((event) => event.midi !== null)).toBe(true)
        expect(paused.events.at(-1)!.start).toBeGreaterThan(plain.events.at(-1)!.start)
    })

    it('round trips a versioned settings preset', () => {
        const settings = { ...DEFAULT_SOUND_SETTINGS, instrument: 'trumpet' as const, maxWithinWordSemitones: 2, echoEnabled: true }
        expect(JSON.parse(serializePreset(settings)).version).toBe(4)
        expect(parsePreset(serializePreset(settings))).toEqual(settings)
        expect(() => parsePreset('{"version": 99}')).toThrow()
        expect(() => parsePreset(serializePreset({ ...settings, instrument: 'flute' as 'trumpet' }))).toThrow()
    })

    it('loads earlier synth presets as piano settings', () => {
        const legacy = { ...DEFAULT_SOUND_SETTINGS, attackMs: 15, decayMs: 80, sustain: 0.6, releaseMs: 170 }
        const { instrument: _instrument, ...withoutInstrument } = legacy
        expect(parsePreset(JSON.stringify({ version: 1, settings: { ...withoutInstrument, waveform: 'triangle' } }))).toEqual(DEFAULT_SOUND_SETTINGS)
        expect(parsePreset(JSON.stringify({ version: 2, settings: { ...legacy, instrument: 'guitar' } }))).toEqual({ ...DEFAULT_SOUND_SETTINGS, instrument: 'guitar' })
    })
})
