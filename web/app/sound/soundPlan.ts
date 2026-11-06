import type { SoundSettings } from './soundConfig'

export type TextGroup = { text: string, wordId: number | null }
export type SoundEvent = TextGroup & { start: number, midi: number | null }
export type SoundPlan = { events: SoundEvent[], tonicMidi: number, density: number }

const SYLLABLE_PATTERN = /[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/gi
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]

function randomFromSeed(seed: number) {
    let state = seed >>> 0
    return () => {
        state += 0x6D2B79F5
        let value = state
        value = Math.imul(value ^ (value >>> 15), value | 1)
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
}

function textSeed(text: string, seed: number) {
    let hash = 2166136261 ^ seed
    for (const char of text) {
        hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619)
    }
    return hash >>> 0
}

function normalizeVowels(text: string) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function baseGroups(text: string, settings: SoundSettings): TextGroup[] {
    const words = [...new Intl.Segmenter('fr', { granularity: 'word' }).segment(text)]
        .filter((part) => part.isWordLike)
        .map((part, wordId) => ({ text: part.segment, start: part.index, end: part.index + part.segment.length, wordId }))

    if (settings.segmentation === 'words') return words.map(({ text: word, wordId }) => ({ text: word, wordId }))

    if (settings.segmentation === 'characters') {
        return words.flatMap(({ text: word, wordId }) =>
            [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(word)]
                .map((part) => ({ text: part.segment, wordId })),
        )
    }

    if (!settings.crossWordSyllables) {
        return words.flatMap(({ text: word, wordId }) => {
            const normalized = normalizeVowels(word)
            const parts = [...normalized.matchAll(SYLLABLE_PATTERN)]
            return parts.length
                ? parts.map((part) => ({ text: word.slice(part.index, part.index + part[0].length), wordId }))
                : [{ text: word, wordId }]
        })
    }

    const compact = [...text].map((char, index) => ({ char, index })).filter(({ char }) => !/\s/.test(char))
    const joined = compact.map(({ char }) => char).join('')
    const normalized = normalizeVowels(joined)
    const matches = [...normalized.matchAll(/[^aeiouy]*[aeiouy]+/gi)]
    const parts = matches.map((part) => {
        const start = compact[part.index].index
        const end = compact[part.index + part[0].length - 1].index + 1
        const matchingWords = words.filter((word) => word.start < end && word.end > start)
        return {
            text: joined.slice(part.index, part.index + part[0].length),
            wordId: matchingWords.length === 1 ? matchingWords[0].wordId : null,
            start,
        }
    })
    for (const word of words) {
        if (!parts.some((part) => part.start < word.end && part.start + part.text.length > word.start)) {
            parts.push({ text: word.text, wordId: word.wordId, start: word.start })
        }
    }
    return parts.sort((left, right) => left.start - right.start).map(({ text: value, wordId }) => ({ text: value, wordId }))
}

export function segmentText(text: string, settings: SoundSettings): TextGroup[] {
    return baseGroups(text, settings)
}

function pickWeighted(candidates: number[], weight: (pitch: number) => number, random: () => number) {
    const weights = candidates.map((pitch) => Math.max(0, weight(pitch)))
    const total = weights.reduce((sum, value) => sum + value, 0)
    if (total <= 0) return candidates[0]
    let target = random() * total
    for (let index = 0; index < candidates.length; index += 1) {
        target -= weights[index]
        if (target <= 0) return candidates[index]
    }
    return candidates.at(-1)!
}

function contourTarget(progress: number, settings: SoundSettings, tonic: number, random: () => number) {
    const amount = settings.contour === 'ascending' ? progress
        : settings.contour === 'descending' ? 1 - progress
            : settings.contour === 'random' ? random()
                : 1 - Math.abs(2 * progress - 1)
    return tonic - 6 + amount * 12
}

function skeletonTargets(count: number, tonic: number, settings: SoundSettings, random: () => number) {
    const targets = Array<number>(count).fill(tonic)
    for (let start = 0; start < count; start += settings.phraseLength) {
        const length = Math.min(settings.phraseLength, count - start)
        for (let index = 0; index < length; index += 1) {
            targets[start + index] = contourTarget((index + 0.5) / length, settings, tonic, random)
        }
    }
    return targets
}

export function createSoundPlan(text: string, settings: SoundSettings): SoundPlan {
    const groups = segmentText(text, settings)
    const tonicMidi = 12 * (settings.octave + 1) + settings.root
        - (settings.mode === 'minor' && settings.relation === 'relative' ? 3 : 0)
    if (groups.length === 0) return { events: [], tonicMidi, density: 0 }

    const scale = settings.mode === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS
    const pitches = Array.from({ length: 13 }, (_, interval) => tonicMidi - 6 + interval)
        .filter((pitch) => scale.includes(((pitch - tonicMidi) % 12 + 12) % 12))
    const random = randomFromSeed(textSeed(text, settings.seed))
    const skeleton = settings.algorithm === 'skeleton'
        ? skeletonTargets(groups.length, tonicMidi, settings, random) : []
    const baseInterval = settings.intervalMs / 1000
        / (settings.speedMode === 'length' ? 1 + settings.lengthFactor * Math.log2(Math.max(1, groups.length)) : 1)
    const gaps = groups.slice(1).map((group, index) => {
        const betweenWords = group.wordId !== null && groups[index].wordId !== null && group.wordId !== groups[index].wordId
        return baseInterval * (1 + (random() < settings.restChance ? 1 : 0))
            + (betweenWords ? settings.wordGap / 1000 : 0)
    })
    const rawDuration = gaps.reduce((sum, gap) => sum + gap, 0)
    const timeScale = settings.speedMode === 'fixed' && rawDuration > settings.maxDuration ? settings.maxDuration / rawDuration : 1
    const starts = [0]
    for (const gap of gaps) {
        const next = starts.at(-1)! + gap * timeScale
        starts.push(settings.speedMode === 'fixed' ? Math.min(settings.maxDuration, next) : next)
    }

    const events: SoundEvent[] = []
    let previousPitch = tonicMidi
    for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index]
        const sameWord = index > 0 && group.wordId !== null && group.wordId === groups[index - 1].wordId
        let candidates = pitches.filter((pitch) =>
            !sameWord || !settings.limitWithinWord || Math.abs(pitch - previousPitch) <= settings.maxWithinWordSemitones,
        )
        if (!candidates.length) candidates = [previousPitch]
        if (sameWord && settings.melodyMovement === 0) candidates = [previousPitch]
        else if (sameWord && candidates.some((pitch) => pitch !== previousPitch)) {
            candidates = candidates.filter((pitch) => pitch !== previousPitch)
        }
        const progress = (index + 0.5) / groups.length
        const target = settings.algorithm === 'skeleton' ? skeleton[index]
            : contourTarget(progress, settings, tonicMidi, random)
        const pitch = pickWeighted(candidates, (candidate) => {
            const interval = Math.abs(candidate - previousPitch)
            const movement = sameWord
                ? interval === 0 ? Math.max(0.1, 3 - settings.melodyMovement * 0.4)
                    : interval <= 4 ? 1 + settings.melodyMovement : 0.4
                : interval === 0 ? 0.4 : 1.5
            const shape = settings.algorithm === 'skeleton'
                ? 1 / (1 + Math.abs(candidate - target)) ** 1.5
                : 1 / (1 + Math.abs(candidate - target) * 0.3)
            return movement * shape
        }, random)
        events.push({ ...group, start: starts[index], midi: pitch })
        previousPitch = pitch
    }

    const duration = starts.at(-1) || baseInterval
    return { events, tonicMidi, density: events.length / Math.max(duration, 0.001) }
}
