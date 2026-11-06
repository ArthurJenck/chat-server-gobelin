import { DEFAULT_SOUND_SETTINGS, SOUND_RANGES, type SoundSettings } from './soundConfig'

const STORAGE_KEY = 'gobelin_sound_settings_v1'

export function serializePreset(settings: SoundSettings) {
    return JSON.stringify({ version: 4, settings }, null, 2)
}

export function parsePreset(value: string): SoundSettings {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) || ![1, 2, 3, 4].includes(parsed.version as number)
        || !('settings' in parsed) || !parsed.settings || typeof parsed.settings !== 'object') {
        throw new Error('Preset incompatible.')
    }
    const saved = parsed.settings as Record<string, unknown>
    if (parsed.version === 1 && !['sine', 'triangle', 'sawtooth', 'square'].includes(saved.waveform as string)) {
        throw new Error('Preset invalide.')
    }
    const migrated: Record<string, unknown> = {
        ...saved,
        instrument: parsed.version === 1 ? 'piano' : saved.instrument,
        melodyMovement: saved.melodyMovement ?? DEFAULT_SOUND_SETTINGS.melodyMovement,
        maxDuration: typeof saved.maxDuration === 'number' ? Math.min(saved.maxDuration, 10) : saved.maxDuration,
        wordGap: parsed.version === 4 ? saved.wordGap
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
                instrument: ['piano', 'guitar', 'trumpet'],
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
