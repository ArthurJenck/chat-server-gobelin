import { expect, it } from 'vitest'
import { DEFAULT_SOUND_SETTINGS } from '../app/sound/soundConfig'
import type { SoundPlan } from '../app/sound/soundPlan'
import { layoutSoundStaff } from '../app/sound/visual/staffLayout'

const plan: SoundPlan = {
    tonicMidi: 60,
    density: 3,
    events: [
        { text: 'a', wordId: 0, start: 0, midi: 60 },
        { text: 'b', wordId: 0, start: 0.3, midi: 62 },
        { text: 'c', wordId: 1, start: 0.72, midi: 64 },
    ],
}

it('adds an independent visual gap between words', () => {
    const normal = layoutSoundStaff(plan, DEFAULT_SOUND_SETTINGS)
    const widerWords = layoutSoundStaff(plan, { ...DEFAULT_SOUND_SETTINGS, visualWordSpacing: 30 })
    const widerGroups = layoutSoundStaff(plan, { ...DEFAULT_SOUND_SETTINGS, visualSpacing: 20 })
    const longerAudioPause = layoutSoundStaff(plan, { ...DEFAULT_SOUND_SETTINGS, wordGap: 500 })

    expect(normal.groups[1].y).toBeLessThan(normal.groups[0].y)
    expect(normal.groups[2].x - normal.groups[1].x).toBeGreaterThan(normal.groups[1].x - normal.groups[0].x)
    expect(widerWords.groups[1].x).toBe(normal.groups[1].x)
    expect(widerWords.groups[2].x - normal.groups[2].x).toBe(30 - DEFAULT_SOUND_SETTINGS.visualWordSpacing)
    expect(widerGroups.groups[1].x - normal.groups[1].x).toBe(20 - DEFAULT_SOUND_SETTINGS.visualSpacing)
    expect(longerAudioPause.groups.map((group) => group.x)).toEqual(normal.groups.map((group) => group.x))
})

it('places scale degrees on lines or between lines using staff spacing', () => {
    const normal = layoutSoundStaff(plan, DEFAULT_SOUND_SETTINGS)
    const wider = layoutSoundStaff(plan, { ...DEFAULT_SOUND_SETTINGS, visualLineSpacing: 30 })

    expect(normal.groups[0].y).toBe(normal.lines[2])
    expect(normal.groups[1].y).toBe((normal.lines[1] + normal.lines[2]) / 2)
    expect(normal.groups[2].y).toBe(normal.lines[1])
    expect(wider.groups[1].y).toBe((wider.lines[1] + wider.lines[2]) / 2)
    expect(layoutSoundStaff({ ...plan, events: [{ ...plan.events[0], midi: 63 }] }, { ...DEFAULT_SOUND_SETTINGS, mode: 'minor' }).groups[0].y).toBe(normal.lines[1])
})

it('keeps staff geometry fixed when the animation starts higher', () => {
    const normal = layoutSoundStaff(plan, DEFAULT_SOUND_SETTINGS)
    const higher = layoutSoundStaff(plan, { ...DEFAULT_SOUND_SETTINGS, visualRise: 100 })

    expect(higher.lines).toEqual(normal.lines)
    expect(higher.groups).toEqual(normal.groups)
    expect(higher.height).toBe(normal.height)
})

it('uses exactly the five staff lines as the SVG height', () => {
    const layout = layoutSoundStaff(plan, DEFAULT_SOUND_SETTINGS)

    expect(layout.lines[0]).toBe(0)
    expect(layout.lines.at(-1)).toBe(layout.height)
    expect(layout.height).toBe(4 * DEFAULT_SOUND_SETTINGS.visualLineSpacing)
})

it('moves whole groups to the next staff when they do not fit', () => {
    const layout = layoutSoundStaff(plan, DEFAULT_SOUND_SETTINGS, 30)
    const longWord = layoutSoundStaff({ ...plan, events: [plan.events[0], { ...plan.events[1], text: 'extraordinaire' }] }, DEFAULT_SOUND_SETTINGS, 30)

    expect(layout.rows).toHaveLength(2)
    expect(layout.rows.map((row) => row.map((group) => group.text))).toEqual([['a', 'b'], ['c']])
    expect(layout.rows.every((row) => row[0].x === 0)).toBe(true)
    expect(longWord.rows.map((row) => row.map((group) => group.text))).toEqual([['a'], ['extraordinaire']])
})
