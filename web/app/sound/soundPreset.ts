import { DEFAULT_SOUND_SETTINGS, INSTRUMENTS, SOUND_RANGES, type Instrument, type InstrumentProfileSettings, type SoundSettings } from './soundConfig'

const STORAGE_KEY = 'gobelin_sound_settings_v1'
const PROFILE_STORAGE_KEY = 'gobelin_instrument_profiles_v1'
const PROFILE_KEYS = ['octave', 'intervalMs', 'wordGap', 'gate'] as const

export function readSavedInstrumentProfiles(): Partial<Record<Instrument, InstrumentProfileSettings>> {
    if (typeof window === 'undefined') return {}
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(PROFILE_STORAGE_KEY) ?? '{}')
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        const profiles: Partial<Record<Instrument, InstrumentProfileSettings>> = {}
        for (const [instrument, value] of Object.entries(parsed)) {
            if (!(instrument in INSTRUMENTS) || !value || typeof value !== 'object') continue
            const profile = value as Record<string, unknown>
            if (PROFILE_KEYS.every((key) => {
                const number = profile[key]
                const range = SOUND_RANGES[key]
                return typeof number === 'number' && Number.isFinite(number) && number >= range.min && number <= range.max
            })) profiles[instrument as Instrument] = {
                octave: profile.octave as number,
                intervalMs: profile.intervalMs as number,
                wordGap: profile.wordGap as number,
                gate: profile.gate as number,
            }
        }
        return profiles
    } catch {
        return {}
    }
}

export function saveInstrumentProfiles(profiles: Partial<Record<Instrument, InstrumentProfileSettings>>) {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles))
}

export function serializePreset(settings: SoundSettings) {
    return JSON.stringify({ version: 5, settings }, null, 2)
}

export function parsePreset(value: string): SoundSettings {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || ![1, 2, 3, 4, 5].includes(parsed.version as number)
        || !('settings' in parsed) || !parsed.settings || typeof parsed.settings !== 'object') {
        throw new Error('Preset incompatible.')
    }
    const saved = parsed.settings as Record<string, unknown>
    if (parsed.version === 1 && !['sine', 'triangle', 'sawtooth', 'square'].includes(saved.waveform as string)) {
        throw new Error('Preset invalide.')
    }
    const migrated: Record<string, unknown> = {
        ...Object.fromEntries(Object.entries(DEFAULT_SOUND_SETTINGS).filter(([key]) => key.startsWith('visual'))),
        ...saved,
        instrument: parsed.version === 1 ? 'piano' : saved.instrument,
        melodyMovement: saved.melodyMovement ?? DEFAULT_SOUND_SETTINGS.melodyMovement,
        maxDuration: typeof saved.maxDuration === 'number' ? Math.min(saved.maxDuration, 10) : saved.maxDuration,
        wordGap: parsed.version === 4 || parsed.version === 5 ? saved.wordGap
            : typeof saved.wordGap === 'number' && saved.wordGap <= 3 ? Math.round(saved.wordGap * 300) : saved.wordGap,
    }
    const settings = Object.fromEntries(Object.keys(DEFAULT_SOUND_SETTINGS).map((key) => [key, migrated[key]]))
    const valid = (Object.keys(DEFAULT_SOUND_SETTINGS) as (keyof SoundSettings)[]).every((key) => {
        const expected = DEFAULT_SOUND_SETTINGS[key]
        const actual = settings[key]
        if (typeof actual !== typeof expected) return false
        if (typeof actual === 'number') {
            if (!Number.isFinite(actual)) return false
            const range = SOUND_RANGES[key as keyof typeof SOUND_RANGES]
            return !range || actual >= range.min && actual <= range.max
        }
        if (typeof expected === 'string') {
            const choices: Partial<Record<keyof SoundSettings, readonly string[]>> = {
                segmentation: ['characters', 'syllables', 'words'],
                speedMode: ['fixed', 'length'],
                algorithm: ['skeleton', 'transitions'],
                mode: ['major', 'minor'],
                relation: ['relative', 'parallel'],
                contour: ['arch', 'ascending', 'descending', 'random'],
                instrument: Object.keys(INSTRUMENTS),
                visualEase: ['back.out(2)', 'elastic.out(1, 0.5)', 'bounce.out'],
            }
            return !choices[key] || choices[key].includes(actual as string)
        }
        return true
    })
    if (!valid) throw new Error('Preset invalide.')
    return settings as SoundSettings
}

export function readSavedSoundSettings(): SoundSettings {
    if (typeof window === 'undefined') return DEFAULT_SOUND_SETTINGS
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) return DEFAULT_SOUND_SETTINGS
    try {
        return parsePreset(saved)
    } catch {
        return DEFAULT_SOUND_SETTINGS
    }
}

export function saveSoundSettings(settings: SoundSettings) {
    window.localStorage.setItem(STORAGE_KEY, serializePreset(settings))
}
