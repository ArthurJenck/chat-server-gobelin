export const INSTRUMENTS = {
    piano: {
        label: 'Piano',
        soundfont: 'acoustic_grand_piano',
        lastDuration: 1.2,
    },
    guitar: {
        label: 'Guitare',
        soundfont: 'acoustic_guitar_nylon',
        lastDuration: 0.8,
    },
    trumpet: { label: 'Trompette', soundfont: 'trumpet', lastDuration: 0.9 },
    flute: { label: 'Flûte', soundfont: 'flute', lastDuration: 0.9 },
    piccolo: { label: 'Piccolo', soundfont: 'piccolo', lastDuration: 0.9 },
    oboe: { label: 'Hautbois', soundfont: 'oboe', lastDuration: 0.9 },
    bassoon: { label: 'Basson', soundfont: 'bassoon', lastDuration: 0.9 },
    horn: { label: 'Cor', soundfont: 'french_horn', lastDuration: 0.9 },
    clarinet: { label: 'Clarinette', soundfont: 'clarinet', lastDuration: 0.9 },
    violin: { label: 'Violon', soundfont: 'violin', lastDuration: 0.9 },
    contrabass: {
        label: 'Contrebasse',
        soundfont: 'contrabass',
        lastDuration: 0.9,
    },
    cello: { label: 'Violoncelle', soundfont: 'cello', lastDuration: 0.9 },
    sax: { label: 'Saxophone', soundfont: 'soprano_sax', lastDuration: 0.9 },
    trombone: { label: 'Trombone', soundfont: 'trombone', lastDuration: 0.9 },
    tuba: { label: 'Tuba', soundfont: 'tuba', lastDuration: 0.9 },
    accordion: {
        label: 'Accordéon',
        soundfont: 'accordion',
        lastDuration: 0.9,
    },
    bagpipe: { label: 'Cornemuse', soundfont: 'bagpipe', lastDuration: 0.9 },
    ocarina: { label: 'Ocarina', soundfont: 'ocarina', lastDuration: 0.9 },
    xylophone: {
        label: 'Xylophone',
        soundfont: 'xylophone',
        lastDuration: 0.9,
    },
    pan_flute: {
        label: 'Flûte de Pan',
        soundfont: 'pan_flute',
        lastDuration: 0.9,
    },
    electric_guitar: {
        label: 'Guitare électrique',
        soundfont: 'electric_guitar_clean',
        lastDuration: 0.9,
    },
    bass: {
        label: 'Basse électrique',
        soundfont: 'electric_bass_finger',
        lastDuration: 0.9,
    },
    organ: { label: 'Orgue', soundfont: 'church_organ', lastDuration: 0.9 },
    harpsichord: {
        label: 'Clavecin',
        soundfont: 'harpsichord',
        lastDuration: 0.9,
    },
    harp: { label: 'Harpe', soundfont: 'orchestral_harp', lastDuration: 0.9 },
    harmonica: {
        label: 'Harmonica',
        soundfont: 'harmonica',
        lastDuration: 0.9,
    },
    banjo: { label: 'Banjo', soundfont: 'banjo', lastDuration: 0.9 },
    koto: { label: 'Koto', soundfont: 'koto', lastDuration: 0.9 },
    voice: { label: 'Voix', soundfont: 'voice_oohs', lastDuration: 0.9 },
} as const

export type Instrument = keyof typeof INSTRUMENTS

export const INSTRUMENT_PROFILES: Record<Instrument, { octave: number, intervalMs: number, wordGap: number, gate: number, minMidi: number, maxMidi: number }> = {
    piano: { octave: 5, intervalMs: 240, wordGap: 120, gate: 0.7, minMidi: 48, maxMidi: 88 },
    guitar: { octave: 4, intervalMs: 120, wordGap: 120, gate: 0.35, minMidi: 45, maxMidi: 76 },
    trumpet: { octave: 4, intervalMs: 240, wordGap: 120, gate: 0.8, minMidi: 55, maxMidi: 78 },
    flute: { octave: 5, intervalMs: 480, wordGap: 120, gate: 0.9, minMidi: 60, maxMidi: 88 },
    piccolo: { octave: 6, intervalMs: 240, wordGap: 120, gate: 0.85, minMidi: 72, maxMidi: 100 },
    oboe: { octave: 5, intervalMs: 480, wordGap: 120, gate: 0.9, minMidi: 58, maxMidi: 84 },
    bassoon: { octave: 3, intervalMs: 480, wordGap: 120, gate: 0.9, minMidi: 36, maxMidi: 68 },
    horn: { octave: 4, intervalMs: 480, wordGap: 120, gate: 0.9, minMidi: 48, maxMidi: 77 },
    clarinet: { octave: 4, intervalMs: 480, wordGap: 120, gate: 0.9, minMidi: 50, maxMidi: 82 },
    violin: { octave: 5, intervalMs: 240, wordGap: 120, gate: 0.85, minMidi: 55, maxMidi: 88 },
    contrabass: { octave: 2, intervalMs: 480, wordGap: 120, gate: 0.75, minMidi: 28, maxMidi: 58 },
    cello: { octave: 3, intervalMs: 480, wordGap: 120, gate: 0.85, minMidi: 36, maxMidi: 72 },
    sax: { octave: 4, intervalMs: 240, wordGap: 120, gate: 0.85, minMidi: 58, maxMidi: 83 },
    trombone: { octave: 3, intervalMs: 480, wordGap: 120, gate: 0.85, minMidi: 40, maxMidi: 72 },
    tuba: { octave: 2, intervalMs: 480, wordGap: 120, gate: 0.85, minMidi: 28, maxMidi: 60 },
    accordion: { octave: 4, intervalMs: 240, wordGap: 120, gate: 0.85, minMidi: 48, maxMidi: 82 },
    bagpipe: { octave: 5, intervalMs: 480, wordGap: 120, gate: 0.95, minMidi: 65, maxMidi: 81 },
    ocarina: { octave: 5, intervalMs: 240, wordGap: 120, gate: 0.9, minMidi: 60, maxMidi: 84 },
    xylophone: { octave: 5, intervalMs: 120, wordGap: 120, gate: 0.3, minMidi: 60, maxMidi: 88 },
    pan_flute: { octave: 5, intervalMs: 480, wordGap: 120, gate: 0.9, minMidi: 60, maxMidi: 88 },
    electric_guitar: { octave: 4, intervalMs: 240, wordGap: 120, gate: 0.5, minMidi: 45, maxMidi: 78 },
    bass: { octave: 2, intervalMs: 240, wordGap: 120, gate: 0.6, minMidi: 28, maxMidi: 60 },
    organ: { octave: 4, intervalMs: 480, wordGap: 120, gate: 0.95, minMidi: 36, maxMidi: 84 },
    harpsichord: { octave: 4, intervalMs: 240, wordGap: 120, gate: 0.45, minMidi: 48, maxMidi: 84 },
    harp: { octave: 4, intervalMs: 240, wordGap: 120, gate: 0.6, minMidi: 48, maxMidi: 84 },
    harmonica: { octave: 4, intervalMs: 240, wordGap: 120, gate: 0.85, minMidi: 55, maxMidi: 82 },
    banjo: { octave: 4, intervalMs: 120, wordGap: 120, gate: 0.35, minMidi: 50, maxMidi: 79 },
    koto: { octave: 4, intervalMs: 240, wordGap: 120, gate: 0.5, minMidi: 48, maxMidi: 84 },
    voice: { octave: 4, intervalMs: 480, wordGap: 120, gate: 0.9, minMidi: 48, maxMidi: 77 },
}

export type SoundSettings = {
    segmentation: 'characters' | 'syllables' | 'words'
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
    contour: 'arch' | 'ascending' | 'descending' | 'random'
    phraseLength: number
    limitWithinWord: boolean
    maxWithinWordSemitones: number
    melodyMovement: number
    restChance: number
    seed: number
    chordPlacement: 'off' | 'above' | 'below'
    chordQuality: 'diatonic' | 'uniform'
    chordRhythm: 'accent' | 'sustain' | 'retrigger'
    thirdPlacement: 'off' | 'above' | 'below'
    harmonyVelocity: number
    instrument: Instrument
    gate: number
    filterFrequency: number
    resonance: number
    volume: number
    echoEnabled: boolean
    echoDelay: number
    echoFeedback: number
    echoMix: number
    visualSpacing: number
    visualWordSpacing: number
    visualLineSpacing: number
    visualLineThickness: number
    visualFontSize: number
    visualRise: number
    visualDuration: number
    visualDelayMs: number
    visualEase: 'back.out(2)' | 'elastic.out(1, 0.5)' | 'bounce.out'
}

export type InstrumentProfileSettings = Pick<SoundSettings, 'octave' | 'intervalMs' | 'wordGap' | 'gate'>

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
    segmentation: 'syllables',
    crossWordSyllables: false,
    speedMode: 'length',
    intervalMs: 240,
    lengthFactor: 0.4,
    maxDuration: 10,
    wordGap: 120,
    algorithm: 'skeleton',
    mode: 'major',
    relation: 'relative',
    root: 0,
    octave: 5,
    contour: 'arch',
    phraseLength: 6,
    limitWithinWord: false,
    maxWithinWordSemitones: 4,
    melodyMovement: 5,
    restChance: 0,
    seed: 1,
    chordPlacement: 'off',
    chordQuality: 'diatonic',
    chordRhythm: 'accent',
    thirdPlacement: 'off',
    harmonyVelocity: 55,
    instrument: 'piano',
    gate: 0.7,
    filterFrequency: 12000,
    resonance: 0.7,
    volume: 0.25,
    echoEnabled: false,
    echoDelay: 0.25,
    echoFeedback: 0.25,
    echoMix: 0.2,
    visualSpacing: 4,
    visualWordSpacing: 8,
    visualLineSpacing: 18,
    visualLineThickness: 1,
    visualFontSize: 16,
    visualRise: 80,
    visualDuration: 0.6,
    visualDelayMs: 0,
    visualEase: 'elastic.out(1, 0.5)',
}

export function instrumentProfileSettings(settings: SoundSettings): InstrumentProfileSettings {
    const { octave, intervalMs, wordGap, gate } = settings
    return { octave, intervalMs, wordGap, gate }
}

export function withInstrumentProfile(settings: SoundSettings, instrument: Instrument, saved?: InstrumentProfileSettings): SoundSettings {
    const { octave, intervalMs, wordGap, gate } = saved ?? INSTRUMENT_PROFILES[instrument]
    return { ...settings, instrument, octave, intervalMs, wordGap, gate }
}

export const SOUND_RANGES = {
    intervalMs: { min: 30, max: 1000, step: 10 },
    lengthFactor: { min: 0, max: 3, step: 0.05 },
    maxDuration: { min: 1, max: 10, step: 0.5 },
    wordGap: { min: 0, max: 2000, step: 10 },
    octave: { min: 2, max: 6, step: 1 },
    phraseLength: { min: 2, max: 32, step: 1 },
    maxWithinWordSemitones: { min: 0, max: 24, step: 1 },
    melodyMovement: { min: 0, max: 10, step: 1 },
    restChance: { min: 0, max: 0.8, step: 0.01 },
    seed: { min: 0, max: 999999, step: 1 },
    harmonyVelocity: { min: 1, max: 100, step: 1 },
    gate: { min: 0.05, max: 1, step: 0.01 },
    filterFrequency: { min: 100, max: 12000, step: 50 },
    resonance: { min: 0.1, max: 20, step: 0.1 },
    volume: { min: 0, max: 0.6, step: 0.01 },
    echoDelay: { min: 0.05, max: 1, step: 0.01 },
    echoFeedback: { min: 0, max: 0.75, step: 0.01 },
    echoMix: { min: 0, max: 0.8, step: 0.01 },
    visualSpacing: { min: 4, max: 80, step: 1 },
    visualWordSpacing: { min: 0, max: 120, step: 1 },
    visualLineSpacing: { min: 8, max: 36, step: 1 },
    visualLineThickness: { min: 0.5, max: 4, step: 0.5 },
    visualFontSize: { min: 10, max: 32, step: 1 },
    visualRise: { min: 4, max: 100, step: 1 },
    visualDuration: { min: 0.1, max: 2, step: 0.05 },
    visualDelayMs: { min: 0, max: 300, step: 5 },
} as const
