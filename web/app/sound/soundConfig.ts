export type Instrument = 'piano' | 'guitar' | 'trumpet'

export type SoundSettings = {
    segmentation: 'characters' | 'syllables' | 'words'
    groupSize: number
    offset: number
    splitNoise: boolean
    splitNoiseAmount: number
    crossWordSyllables: boolean
    speedMode: 'fixed' | 'length'
    intervalMs: number
    lengthFactor: number
    maxDuration: number
    wordGap: number
    algorithm: 'skeleton' | 'transitions'
    mode: 'major' | 'minor'
    relation: 'relative' | 'parallel'
    root: number
    octave: number
    range: number
    contour: 'arch' | 'ascending' | 'descending' | 'random'
    phraseLength: number
    repetitionWeight: number
    stepWeight: number
    leapWeight: number
    tonicWeight: number
    maxLeapSemitones: number
    limitWithinWord: boolean
    maxWithinWordSemitones: number
    restChance: number
    seed: number
    instrument: Instrument
    gate: number
    filterFrequency: number
    resonance: number
    volume: number
    echoEnabled: boolean
    echoDelay: number
    echoFeedback: number
    echoMix: number
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
    segmentation: 'syllables',
    groupSize: 1,
    offset: 0,
    splitNoise: false,
    splitNoiseAmount: 1,
    crossWordSyllables: false,
    speedMode: 'length',
    intervalMs: 300,
    lengthFactor: 0.4,
    maxDuration: 10,
    wordGap: 0.4,
    algorithm: 'skeleton',
    mode: 'major',
    relation: 'relative',
    root: 0,
    octave: 4,
    range: 12,
    contour: 'arch',
    phraseLength: 6,
    repetitionWeight: 1,
    stepWeight: 4,
    leapWeight: 1,
    tonicWeight: 1.5,
    maxLeapSemitones: 7,
    limitWithinWord: false,
    maxWithinWordSemitones: 4,
    restChance: 0,
    seed: 1,
    instrument: 'piano',
    gate: 0.8,
    filterFrequency: 3500,
    resonance: 0.7,
    volume: 0.25,
    echoEnabled: false,
    echoDelay: 0.25,
    echoFeedback: 0.25,
    echoMix: 0.2,
}

export const SOUND_RANGES = {
    groupSize: { min: 1, max: 16, step: 1 },
    offset: { min: 0, max: 15, step: 1 },
    splitNoiseAmount: { min: 0, max: 8, step: 1 },
    intervalMs: { min: 30, max: 1000, step: 10 },
    lengthFactor: { min: 0, max: 3, step: 0.05 },
    maxDuration: { min: 1, max: 30, step: 0.5 },
    wordGap: { min: 0, max: 3, step: 0.1 },
    octave: { min: 2, max: 6, step: 1 },
    range: { min: 0, max: 24, step: 1 },
    phraseLength: { min: 2, max: 32, step: 1 },
    repetitionWeight: { min: 0, max: 10, step: 0.1 },
    stepWeight: { min: 0, max: 10, step: 0.1 },
    leapWeight: { min: 0, max: 10, step: 0.1 },
    tonicWeight: { min: 0, max: 10, step: 0.1 },
    maxLeapSemitones: { min: 0, max: 24, step: 1 },
    maxWithinWordSemitones: { min: 0, max: 24, step: 1 },
    restChance: { min: 0, max: 0.8, step: 0.01 },
    seed: { min: 0, max: 999999, step: 1 },
    gate: { min: 0.05, max: 1, step: 0.01 },
    filterFrequency: { min: 100, max: 12000, step: 50 },
    resonance: { min: 0.1, max: 20, step: 0.1 },
    volume: { min: 0, max: 0.6, step: 0.01 },
    echoDelay: { min: 0.05, max: 1, step: 0.01 },
    echoFeedback: { min: 0, max: 0.75, step: 0.01 },
    echoMix: { min: 0, max: 0.8, step: 0.01 },
} as const
