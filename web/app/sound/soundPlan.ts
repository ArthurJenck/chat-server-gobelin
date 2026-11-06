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

    const normalized = normalizeVowels(text)
    const matches = [...normalized.matchAll(SYLLABLE_PATTERN)]
    const parts = matches.map((part) => {
        const start = part.index
        const end = start + part[0].length
        const matchingWords = words.filter((word) => word.start < end && word.end > start)
        return {
            text: text.slice(start, end),
            wordId: matchingWords.length === 1 && !/\s/.test(text.slice(start, end)) ? matchingWords[0].wordId : null,
            start,
        }
    })
    for (const word of words) {
        if (!matches.some((part) => part.index < word.end && part.index + part[0].length > word.start)) {
            parts.push({ text: word.text, wordId: word.wordId, start: word.start })
        }
    }
    return parts.sort((left, right) => left.start - right.start).map(({ text: value, wordId }) => ({ text: value, wordId }))
}

export function segmentText(text: string, settings: SoundSettings): TextGroup[] {
    const units = baseGroups(text, settings)
    const random = randomFromSeed(textSeed(text, settings.seed + 17))
    const groups: TextGroup[] = []
    let index = 0

    while (index < units.length) {
        const firstSize = groups.length === 0 ? Math.max(1, settings.groupSize - settings.offset % settings.groupSize) : settings.groupSize
        const noise = settings.splitNoise ? Math.round((random() * 2 - 1) * settings.splitNoiseAmount) : 0
        const size = Math.max(1, firstSize + noise)
        const chunk = units.slice(index, index + size)
        groups.push({
            text: chunk.map((unit) => unit.text).join(''),
            wordId: chunk.every((unit) => unit.wordId !== null && unit.wordId === chunk[0].wordId) ? chunk[0].wordId : null,
        })
        index += size
    }

    return groups
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
    return tonic + amount * settings.range
}

function skeletonTargets(count: number, pitches: number[], tonic: number, settings: SoundSettings, random: () => number) {
    const targets = Array<number>(count).fill(tonic)
    let startPitch = tonic
    for (let start = 0; start < count; start += settings.phraseLength) {
        const end = Math.min(count - 1, start + settings.phraseLength - 1)
        const desired = end === count - 1 ? tonic
            : contourTarget(end / Math.max(1, count - 1), settings, tonic, random)
        const endPitch = pitches.reduce((best, pitch) =>
            Math.abs(pitch - desired) < Math.abs(best - desired) ? pitch : best, pitches[0])
        for (let index = start; index <= end; index += 1) {
            const progress = (index - start) / Math.max(1, end - start)
            targets[index] = startPitch + (endPitch - startPitch) * progress
        }
        startPitch = endPitch
    }
    return targets
}

export function createSoundPlan(text: string, settings: SoundSettings): SoundPlan {
    const groups = segmentText(text, settings)
    const tonicMidi = 12 * (settings.octave + 1) + settings.root
        - (settings.mode === 'minor' && settings.relation === 'relative' ? 3 : 0)
    if (groups.length === 0) return { events: [], tonicMidi, density: 0 }

    const scale = settings.mode === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS
    const pitches = Array.from({ length: settings.range + 1 }, (_, interval) => tonicMidi + interval)
        .filter((pitch) => scale.includes((pitch - tonicMidi) % 12))
    const random = randomFromSeed(textSeed(text, settings.seed))
    const skeleton = settings.algorithm === 'skeleton'
        ? skeletonTargets(groups.length, pitches, tonicMidi, settings, random) : []
    const baseInterval = settings.intervalMs / 1000
        / (settings.speedMode === 'length' ? 1 + settings.lengthFactor * Math.log2(Math.max(1, groups.length)) : 1)
    const gaps = groups.slice(1).map((group, index) =>
        baseInterval * (group.wordId !== null && groups[index].wordId !== null && group.wordId !== groups[index].wordId
            ? 1 + settings.wordGap : 1),
    )
    const rawDuration = gaps.reduce((sum, gap) => sum + gap, 0)
    const timeScale = rawDuration > settings.maxDuration ? settings.maxDuration / rawDuration : 1
    const starts = [0]
    for (const gap of gaps) starts.push(starts.at(-1)! + gap * timeScale)

    const events: SoundEvent[] = []
    const lastIndexByWord = new Map<number, number>()
    groups.forEach((group, index) => {
        if (group.wordId !== null) lastIndexByWord.set(group.wordId, index)
    })
    let previousPitch = tonicMidi
    for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index]
        const sameWord = index > 0 && group.wordId !== null && group.wordId === groups[index - 1].wordId
        const final = index === groups.length - 1
        let candidates = pitches.filter((pitch) =>
            Math.abs(pitch - previousPitch) <= settings.maxLeapSemitones
            && (!sameWord || !settings.limitWithinWord || Math.abs(pitch - previousPitch) <= settings.maxWithinWordSemitones),
        )
        if (settings.limitWithinWord && group.wordId !== null) {
            const remaining = lastIndexByWord.get(group.wordId)! - index
            if (index + remaining === groups.length - 1) {
                candidates = candidates.filter((pitch) => Math.abs(pitch - tonicMidi) <= remaining * settings.maxWithinWordSemitones)
            }
        }
        if (!candidates.length) candidates = [previousPitch]
        const progress = groups.length === 1 ? 1 : index / (groups.length - 1)
        const target = settings.algorithm === 'skeleton' ? skeleton[index]
            : contourTarget(progress, settings, tonicMidi, random)
        const pitch = final ? tonicMidi : index === 0 ? tonicMidi : pickWeighted(candidates, (candidate) => {
            const interval = Math.abs(candidate - previousPitch)
            const movement = interval === 0 ? settings.repetitionWeight
                : interval <= 2 ? settings.stepWeight : settings.leapWeight
            const tonal = candidate === tonicMidi ? 1 + settings.tonicWeight : 1
            const shape = settings.algorithm === 'skeleton'
                ? 1 / (1 + Math.abs(candidate - target)) ** 2
                : 1 / (1 + Math.max(0, interval - 2) * 0.5)
            return movement * tonal * shape
        }, random)
        const rest = !final && index > 0 && random() < settings.restChance
        events.push({ ...group, start: starts[index], midi: rest ? null : pitch })
        previousPitch = pitch
    }

    const duration = starts.at(-1) || baseInterval
    return { events, tonicMidi, density: events.length / Math.max(duration, 0.001) }
}
