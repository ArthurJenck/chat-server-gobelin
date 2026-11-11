import { useEffect, useMemo, useRef } from "react";
import { Leva, button, folder, monitor, useControls } from "leva";
import {
    DEFAULT_SOUND_SETTINGS,
    SOUND_RANGES,
    type SoundSettings,
} from "../soundConfig";
import { parsePreset, serializePreset } from "../soundPreset";

type Props = {
    initialSettings: SoundSettings;
    density: number;
    onChange: (settings: SoundSettings) => void;
    onError: (message: string) => void;
    onReset: () => void;
};

export default function SoundSettingsPanel({
    initialSettings,
    density,
    onChange,
    onError,
    onReset,
}: Props) {
    const fileInput = useRef<HTMLInputElement>(null);
    const densityRef = useRef(density);
    const settingsRef = useRef(initialSettings);
    const baseSettingsRef = useRef(initialSettings);
    const setRef = useRef<(settings: SoundSettings) => void>(() => {});
    const firstRender = useRef(true);
    densityRef.current = density;

    const number = <Key extends keyof typeof SOUND_RANGES>(
        key: Key,
        label: string,
    ) => ({
        value: initialSettings[key],
        label,
        ...SOUND_RANGES[key],
    });

    const [values, set] = useControls(
        () => ({
            Harmonie: folder({
                chordPlacement: {
                    value: initialSettings.chordPlacement,
                    label: "Accord début/fin",
                    options: {
                        Désactivé: "off",
                        "Au-dessus": "above",
                        "En dessous": "below",
                    },
                },
                Accord: folder(
                    {
                        chordRhythm: {
                            value: initialSettings.chordRhythm,
                            label: "Articulation",
                            options: {
                                "Attaque début/fin": "accent",
                                "Tenu jusqu’à la fin": "sustain",
                                "À chaque note": "retrigger",
                            },
                        },
                    },
                    {
                        render: (get) =>
                            get("Harmonie.chordPlacement") !== "off",
                    },
                ),
                thirdPlacement: {
                    value: initialSettings.thirdPlacement,
                    label: "Tierce mélodique",
                    options: {
                        Désactivée: "off",
                        "Au-dessus": "above",
                        "En dessous": "below",
                    },
                },
                harmonyVelocity: {
                    ...number("harmonyVelocity", "Force accompagnement"),
                    render: (get) =>
                        get("Harmonie.chordPlacement") !== "off" ||
                        get("Harmonie.thirdPlacement") !== "off",
                },
            }),
            Découpage: folder({
                densité: monitor(
                    () => densityRef.current.toFixed(1) + " notes/s",
                ),
            }),
            Vitesse: folder({
                speedMode: {
                    value: initialSettings.speedMode,
                    label: "Mode",
                    options: {
                        "Durée fixe": "fixed",
                        "Durée adaptative": "length",
                    },
                },
                intervalMs: number("intervalMs", "Pause notes (ms)"),
                wordGap: number("wordGap", "Pause mots (ms)"),
                gate: number("gate", "Longueur note"),
                "Durée fixe": folder(
                    {
                        maxDuration: number("maxDuration", "Durée totale (s)"),
                    },
                    { render: (get) => get("Vitesse.speedMode") === "fixed" },
                ),
                "Durée adaptative": folder(
                    {
                        lengthFactor: number("lengthFactor", "Accélération"),
                    },
                    { render: (get) => get("Vitesse.speedMode") === "length" },
                ),
            }),
            "Gamme et mélodie": folder({
                mode: {
                    value: initialSettings.mode,
                    label: "Mode",
                    options: { Majeur: "major", Mineur: "minor" },
                },
                root: {
                    value: initialSettings.root,
                    label: "Tonique",
                    options: {
                        Do: 0,
                        "Do♯": 1,
                        Ré: 2,
                        "Ré♯": 3,
                        Mi: 4,
                        Fa: 5,
                        "Fa♯": 6,
                        Sol: 7,
                        "Sol♯": 8,
                        La: 9,
                        "La♯": 10,
                        Si: 11,
                    },
                },
                octave: number("octave", "Octave"),
            }),
            Correspondances: folder(
                {
                    Degrés: monitor(
                        () => "0 do · 1 ré · 2 mi · 3 fa · 4 sol · 5 la · 6 si",
                    ),
                    degreeA: number("degreeA", "A"),
                    degreeE: number("degreeE", "É / È / AI"),
                    degreeI: number("degreeI", "I"),
                    degreeO: number("degreeO", "O / AU / EAU"),
                    degreeU: number("degreeU", "U"),
                    degreeOU: number("degreeOU", "OU"),
                    degreeIN: number("degreeIN", "IN / AIN / IEN"),
                },
                { collapsed: true },
            ),
            "Choix des notes": folder({
                soundWeight: number("soundWeight", "Correspondance écrite"),
                chordWeight: number("chordWeight", "Note de l’accord"),
                directionWeight: number(
                    "directionWeight",
                    "Direction du groupe",
                ),
                repetitionWeight: number(
                    "repetitionWeight",
                    "Répétition identique",
                ),
                repeatPenalty: number("repeatPenalty", "Pénalité répétition"),
                leapPenalty: number("leapPenalty", "Pénalité grand saut"),
                resolutionWeight: number(
                    "resolutionWeight",
                    "Résolution tension",
                ),
                cadenceWeight: number("cadenceWeight", "Intonation finale"),
                variationWeight: number(
                    "variationWeight",
                    "Variation à la lecture",
                ),
            }),

            Portée: folder({
                Tracé: folder({
                    visualLineSpacing: number(
                        "visualLineSpacing",
                        "Écart lignes",
                    ),
                    visualLineThickness: number(
                        "visualLineThickness",
                        "Épaisseur",
                    ),
                }),
                Texte: folder({
                    visualFontSize: number("visualFontSize", "Taille"),
                    visualSpacing: number("visualSpacing", "Écart groupes"),
                    visualWordSpacing: number(
                        "visualWordSpacing",
                        "Écart mots",
                    ),
                }),
                Apparition: folder({
                    visualRise: number("visualRise", "Hauteur départ"),
                    visualDuration: number("visualDuration", "Durée (s)"),
                    visualDelayMs: number("visualDelayMs", "Retard texte (ms)"),
                    visualEase: {
                        value: initialSettings.visualEase,
                        label: "Rebond",
                        options: {
                            Souple: "back.out(2)",
                            Élastique: "elastic.out(1, 0.5)",
                            Bondissant: "bounce.out",
                        },
                    },
                }),
            }),
            Son: folder(
                {
                    filterFrequency: number("filterFrequency", "Filtre (Hz)"),
                    resonance: number("resonance", "Résonance"),
                    volume: number("volume", "Volume"),
                },
                { collapsed: true },
            ),
            Effets: folder(
                {
                    echoEnabled: {
                        value: initialSettings.echoEnabled,
                        label: "Écho actif",
                    },
                    "Options écho": folder(
                        {
                            echoDelay: number("echoDelay", "Délai (s)"),
                            echoFeedback: number("echoFeedback", "Répétitions"),
                            echoMix: number("echoMix", "Mélange"),
                        },
                        { render: (get) => get("Effets.echoEnabled") },
                    ),
                },
                { collapsed: true },
            ),
            Presets: folder({
                "Exporter JSON": button(() => {
                    const blob = new Blob(
                        [serializePreset(settingsRef.current)],
                        { type: "application/json" },
                    );
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "atelier-son.json";
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 0);
                }),
                "Importer JSON": button(() => fileInput.current?.click()),
                Réinitialiser: button(() => {
                    setRef.current(DEFAULT_SOUND_SETTINGS);
                    onReset();
                }),
            }),
        }),
        [],
    );

    const settings = useMemo(
        () =>
            ({
                ...baseSettingsRef.current,
                ...values,
                instrument: initialSettings.instrument,
            }) as SoundSettings,
        [values, initialSettings.instrument],
    );
    settingsRef.current = settings;
    setRef.current = (next) => {
        baseSettingsRef.current = next;
        set(
            Object.fromEntries(
                Object.keys(values).map((key) => [
                    key,
                    next[key as keyof SoundSettings],
                ]),
            ) as unknown as Parameters<typeof set>[0],
        );
        onChange(next);
    };

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            setRef.current(initialSettings);
            return;
        }
        onChange(settings);
    }, [settings, onChange]);

    async function importPreset(file: File | undefined) {
        if (!file) return;
        try {
            setRef.current(parsePreset(await file.text()));
            onError("");
        } catch (cause) {
            onError(
                cause instanceof Error ? cause.message : "Import impossible.",
            );
        }
    }

    return (
        <>
            <div
                style={{
                    width: 400,
                    maxWidth: "100%",
                    flex: "0 1 400px",
                    position: "absolute",
                    right: "8px",
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
                    void importPreset(event.target.files?.[0]);
                    event.target.value = "";
                }}
            />
        </>
    );
}
