import { useEffect, useMemo, useRef } from 'react'
import { Leva, button, folder, monitor, useControls } from 'leva'
import {
    DEFAULT_SOUND_SETTINGS,
    SOUND_RANGES,
    type SoundSettings,
} from './soundConfig'
import { parsePreset, serializePreset } from './soundPreset'

type Props = {
    initialSettings: SoundSettings
    density: number
    onChange: (settings: SoundSettings) => void
    onError: (message: string) => void
}

export default function SoundSettingsPanel({
    initialSettings,
    density,
    onChange,
    onError,
}: Props) {
    const fileInput = useRef<HTMLInputElement>(null)
    const densityRef = useRef(density)
    const settingsRef = useRef(initialSettings)
    const setRef = useRef<(settings: SoundSettings) => void>(() => {})
    densityRef.current = density

    const number = <Key extends keyof typeof SOUND_RANGES>(
        key: Key,
        label: string
    ) => ({
        value: initialSettings[key],
        label,
        ...SOUND_RANGES[key],
    })

    const [values, set] = useControls(
        () => ({
            Découpage: folder({
                segmentation: {
                    value: initialSettings.segmentation,
                    label: 'Unité',
                    options: {
                        Caractères: 'characters',
                        Syllabes: 'syllables',
                        Mots: 'words',
                    },
                },
                groupSize: number('groupSize', 'Taille des groupes'),
                offset: number('offset', 'Offset'),
                splitNoise: {
                    value: initialSettings.splitNoise,
                    label: 'Noise actif',
                },
                splitNoiseAmount: number('splitNoiseAmount', 'Amplitude noise'),
                crossWordSyllables: {
                    value: initialSettings.crossWordSyllables,
                    label: 'Entre les mots',
                },
                densité: monitor(
                    () => densityRef.current.toFixed(1) + ' notes/s'
                ),
            }),
            Vitesse: folder({
                speedMode: {
                    value: initialSettings.speedMode,
                    label: 'Mode',
                    options: { Fixe: 'fixed', 'Selon la longueur': 'length' },
                },
                intervalMs: number('intervalMs', 'Intervalle (ms)'),
                lengthFactor: number('lengthFactor', 'Facteur longueur'),
                maxDuration: number('maxDuration', 'Départs avant (s)'),
                wordGap: number('wordGap', 'Pause entre mots'),
            }),
            'Gamme et mélodie': folder({
                algorithm: {
                    value: initialSettings.algorithm,
                    label: 'Générateur',
                    options: {
                        Ossature: 'skeleton',
                        Transitions: 'transitions',
                    },
                },
                mode: {
                    value: initialSettings.mode,
                    label: 'Mode',
                    options: { Majeur: 'major', Mineur: 'minor' },
                },
                relation: {
                    value: initialSettings.relation,
                    label: 'Gammes',
                    options: { Relatives: 'relative', Parallèles: 'parallel' },
                },
                root: {
                    value: initialSettings.root,
                    label: 'Note majeure',
                    options: {
                        Do: 0,
                        'Do♯': 1,
                        Ré: 2,
                        'Ré♯': 3,
                        Mi: 4,
                        Fa: 5,
                        'Fa♯': 6,
                        Sol: 7,
                        'Sol♯': 8,
                        La: 9,
                        'La♯': 10,
                        Si: 11,
                    },
                },
                octave: number('octave', 'Octave'),
                range: number('range', 'Tessiture (demi-tons)'),
                contour: {
                    value: initialSettings.contour,
                    label: 'Contour',
                    options: {
                        Arche: 'arch',
                        Montant: 'ascending',
                        Descendant: 'descending',
                        Aléatoire: 'random',
                    },
                },
                phraseLength: number('phraseLength', 'Longueur de phrase'),
                repetitionWeight: number('repetitionWeight', 'Répétitions'),
                stepWeight: number('stepWeight', 'Petits pas'),
                leapWeight: number('leapWeight', 'Sauts'),
                tonicWeight: number('tonicWeight', 'Tonique'),
                maxLeapSemitones: number('maxLeapSemitones', 'Saut global max'),
                limitWithinWord: {
                    value: initialSettings.limitWithinWord,
                    label: 'Limiter dans un mot',
                },
                maxWithinWordSemitones: number(
                    'maxWithinWordSemitones',
                    'Écart intra-mot max'
                ),
                restChance: number('restChance', 'Probabilité de pause'),
                seed: number('seed', 'Graine'),
            }),
            Son: folder({
                gate: number('gate', 'Longueur note'),
                filterFrequency: number('filterFrequency', 'Filtre (Hz)'),
                resonance: number('resonance', 'Résonance'),
                volume: number('volume', 'Volume'),
            }),
            Effets: folder({
                echoEnabled: {
                    value: initialSettings.echoEnabled,
                    label: 'Écho actif',
                },
                echoDelay: number('echoDelay', 'Délai (s)'),
                echoFeedback: number('echoFeedback', 'Répétitions'),
                echoMix: number('echoMix', 'Mélange'),
            }),
            Presets: folder({
                'Exporter JSON': button(() => {
                    const blob = new Blob(
                        [serializePreset(settingsRef.current)],
                        { type: 'application/json' }
                    )
                    const url = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = 'atelier-son.json'
                    link.click()
                    setTimeout(() => URL.revokeObjectURL(url), 0)
                }),
                'Importer JSON': button(() => fileInput.current?.click()),
                Réinitialiser: button(() =>
                    setRef.current(DEFAULT_SOUND_SETTINGS)
                ),
            }),
        }),
        []
    )

    const settings = useMemo(
        () =>
            ({
                ...values,
                instrument: initialSettings.instrument,
            }) as SoundSettings,
        [values, initialSettings.instrument]
    )
    settingsRef.current = settings
    setRef.current = (next) => {
        set(next)
        onChange(next)
    }

    useEffect(() => onChange(settings), [settings, onChange])

    async function importPreset(file: File | undefined) {
        if (!file) return
        try {
            setRef.current(parsePreset(await file.text()))
            onError('')
        } catch (cause) {
            onError(
                cause instanceof Error ? cause.message : 'Import impossible.'
            )
        }
    }

    return (
        <>
            <div
                style={{
                    width: 400,
                    maxWidth: '100%',
                    opacity: 0.8,
                    position: 'absolute',
                    right: 8,
                    top: 8,
                }}
            >
                <Leva fill />
            </div>
            <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                    void importPreset(event.target.files?.[0])
                    event.target.value = ''
                }}
            />
        </>
    )
}
