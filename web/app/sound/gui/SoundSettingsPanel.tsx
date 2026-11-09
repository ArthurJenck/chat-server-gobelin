import { useEffect, useMemo, useRef } from 'react'
import { Leva, button, folder, monitor, useControls } from 'leva'
import {
    DEFAULT_SOUND_SETTINGS,
    SOUND_RANGES,
    type SoundSettings,
} from '../soundConfig'
import { parsePreset, serializePreset } from '../soundPreset'

type Props = {
    initialSettings: SoundSettings
    density: number
    onChange: (settings: SoundSettings) => void
    onError: (message: string) => void
    onReset: () => void
}

export default function SoundSettingsPanel({
    initialSettings,
    density,
    onChange,
    onError,
    onReset,
}: Props) {
    const fileInput = useRef<HTMLInputElement>(null)
    const densityRef = useRef(density)
    const settingsRef = useRef(initialSettings)
    const baseSettingsRef = useRef(initialSettings)
    const setRef = useRef<(settings: SoundSettings) => void>(() => {})
    const firstRender = useRef(true)
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
                crossWordSyllables: {
                    value: initialSettings.crossWordSyllables,
                    label: 'Lier les mots',
                    render: (get) =>
                        get('Découpage.segmentation') === 'syllables',
                },
                densité: monitor(
                    () => densityRef.current.toFixed(1) + ' notes/s'
                ),
            }),
            Vitesse: folder({
                speedMode: {
                    value: initialSettings.speedMode,
                    label: 'Mode',
                    options: {
                        'Durée fixe': 'fixed',
                        'Durée adaptative': 'length',
                    },
                },
                intervalMs: number('intervalMs', 'Pause notes (ms)'),
                wordGap: number('wordGap', 'Pause mots (ms)'),
                gate: number('gate', 'Longueur note'),
                'Durée fixe': folder(
                    {
                        maxDuration: number('maxDuration', 'Durée totale (s)'),
                    },
                    { render: (get) => get('Vitesse.speedMode') === 'fixed' }
                ),
                'Durée adaptative': folder(
                    {
                        lengthFactor: number('lengthFactor', 'Accélération'),
                    },
                    { render: (get) => get('Vitesse.speedMode') === 'length' }
                ),
            }),
            'Gamme et mélodie': folder({
                algorithm: {
                    value: initialSettings.algorithm,
                    label: 'Générateur',
                    options: {
                        'Courbe guidée': 'skeleton',
                        'Notes voisines': 'transitions',
                    },
                },
                mode: {
                    value: initialSettings.mode,
                    label: 'Mode',
                    options: { Majeur: 'major', Mineur: 'minor' },
                },
                'Mode mineur': folder(
                    {
                        relation: {
                            value: initialSettings.relation,
                            label: 'Lien des gammes',
                            options: {
                                Relatives: 'relative',
                                Parallèles: 'parallel',
                            },
                        },
                    },
                    {
                        render: (get) =>
                            get('Gamme et mélodie.mode') === 'minor',
                    }
                ),
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
                'Courbe guidée': folder(
                    {
                        phraseLength: number(
                            'phraseLength',
                            'Notes par courbe'
                        ),
                        'À quoi ça sert': monitor(
                            () =>
                                'La courbe recommence après ce nombre de notes.'
                        ),
                    },
                    {
                        render: (get) =>
                            get('Gamme et mélodie.algorithm') === 'skeleton',
                    }
                ),
                melodyMovement: number('melodyMovement', 'Variation/mot'),
                limitWithinWord: {
                    value: initialSettings.limitWithinWord,
                    label: 'Limiter par mot',
                },
                'Limiter par mot': folder(
                    {
                        maxWithinWordSemitones: number(
                            'maxWithinWordSemitones',
                            'Écart max'
                        ),
                    },
                    { render: (get) => get('Gamme et mélodie.limitWithinWord') }
                ),
                restChance: number('restChance', 'Chance de pause'),
                seed: number('seed', 'Seed'),
            }),
            Portée: folder({
                Tracé: folder({
                    visualLineSpacing: number(
                        'visualLineSpacing',
                        'Écart lignes'
                    ),
                    visualLineThickness: number(
                        'visualLineThickness',
                        'Épaisseur'
                    ),
                }),
                Texte: folder({
                    visualFontSize: number('visualFontSize', 'Taille'),
                    visualSpacing: number('visualSpacing', 'Écart groupes'),
                    visualWordSpacing: number(
                        'visualWordSpacing',
                        'Écart mots'
                    ),
                }),
                Apparition: folder({
                    visualRise: number('visualRise', 'Hauteur départ'),
                    visualDuration: number('visualDuration', 'Durée (s)'),
                    visualDelayMs: number('visualDelayMs', 'Retard texte (ms)'),
                    visualEase: {
                        value: initialSettings.visualEase,
                        label: 'Rebond',
                        options: {
                            Souple: 'back.out(2)',
                            Élastique: 'elastic.out(1, 0.5)',
                            Bondissant: 'bounce.out',
                        },
                    },
                }),
            }),
            Son: folder(
                {
                    filterFrequency: number('filterFrequency', 'Filtre (Hz)'),
                    resonance: number('resonance', 'Résonance'),
                    volume: number('volume', 'Volume'),
                },
                { collapsed: true }
            ),
            Effets: folder(
                {
                    echoEnabled: {
                        value: initialSettings.echoEnabled,
                        label: 'Écho actif',
                    },
                    'Options écho': folder(
                        {
                            echoDelay: number('echoDelay', 'Délai (s)'),
                            echoFeedback: number('echoFeedback', 'Répétitions'),
                            echoMix: number('echoMix', 'Mélange'),
                        },
                        { render: (get) => get('Effets.echoEnabled') }
                    ),
                },
                { collapsed: true }
            ),
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
                Réinitialiser: button(() => {
                    setRef.current(DEFAULT_SOUND_SETTINGS)
                    onReset()
                }),
            }),
        }),
        []
    )

    const settings = useMemo(
        () =>
            ({
                ...baseSettingsRef.current,
                ...values,
                instrument: initialSettings.instrument,
            }) as SoundSettings,
        [values, initialSettings.instrument]
    )
    settingsRef.current = settings
    setRef.current = (next) => {
        baseSettingsRef.current = next
        set(
            Object.fromEntries(
                Object.keys(values).map((key) => [
                    key,
                    next[key as keyof SoundSettings],
                ])
            ) as unknown as Parameters<typeof set>[0]
        )
        onChange(next)
    }

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false
            setRef.current(initialSettings)
            return
        }
        onChange(settings)
    }, [settings, onChange])

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
                    flex: '0 1 400px',
                    position: 'absolute',
                    right: '8px',
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
