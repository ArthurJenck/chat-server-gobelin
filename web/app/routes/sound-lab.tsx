import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { getToken } from "../api";
import { startPlayback } from "../sound/audioEngine";
import SoundSettingsPanel from "../sound/gui/SoundSettingsPanel";
import {
    INSTRUMENTS,
    instrumentProfileSettings,
    withInstrumentProfile,
    type Instrument,
    type SoundSettings,
} from "../sound/soundConfig";
import {
    readSavedInstrumentProfiles,
    readSavedSoundSettings,
    saveInstrumentProfiles,
    saveSoundSettings,
} from "../sound/soundPreset";
import { createSoundPlan, type SoundPlan } from "../sound/soundPlan";
import SoundStaff from "../sound/visual/SoundStaff";

export default function SoundLab() {
    const [text, setText] = useState("");
    const [settings, setSettings] = useState(readSavedSoundSettings);
    const profilesRef = useRef(readSavedInstrumentProfiles());
    const [playing, setPlaying] = useState(false);
    const [error, setError] = useState("");
    const [visual, setVisual] = useState<{
        id: number;
        plan: SoundPlan;
        settings: SoundSettings;
        getPlayhead: () => number | null;
    } | null>(null);
    const stopRef = useRef<(() => void) | null>(null);
    const playId = useRef(0);
    const performanceCount = useRef(0);
    const performanceKey = useRef("");
    const plan = createSoundPlan(text.trim(), settings);

    const changeSettings = useCallback((next: SoundSettings) => {
        profilesRef.current = {
            ...profilesRef.current,
            [next.instrument]: instrumentProfileSettings(next),
        };
        saveInstrumentProfiles(profilesRef.current);
        setSettings(next);
    }, []);

    const resetInstrumentProfiles = useCallback(() => {
        profilesRef.current = {};
        saveInstrumentProfiles({});
    }, []);

    useEffect(() => {
        saveSoundSettings(settings);
    }, [settings]);

    useEffect(
        () => () => {
            playId.current += 1;
            stopRef.current?.();
        },
        [],
    );

    function stop() {
        playId.current += 1;
        stopRef.current?.();
        stopRef.current = null;
        setPlaying(false);
    }

    async function play() {
        if (!plan.events.length) return;
        const key = JSON.stringify([text.trim(), settings]);
        if (performanceKey.current !== key) {
            performanceKey.current = key;
            performanceCount.current = 0;
        }
        const playbackPlan = createSoundPlan(
            text.trim(),
            settings,
            performanceCount.current++,
        );
        setVisual(null);
        stop();
        const id = ++playId.current;
        setError("");
        setPlaying(true);
        try {
            const stopPlayback = await startPlayback(
                playbackPlan,
                settings,
                () => {
                    if (playId.current === id) {
                        stopRef.current = null;
                        setPlaying(false);
                    }
                },
                (getPlayhead) => {
                    if (playId.current === id)
                        setVisual({
                            id,
                            plan: playbackPlan,
                            settings,
                            getPlayhead,
                        });
                },
            );
            if (playId.current !== id) stopPlayback();
            else stopRef.current = stopPlayback;
        } catch (cause) {
            if (playId.current === id) {
                setError(
                    cause instanceof Error
                        ? cause.message
                        : "Lecture impossible.",
                );
                setPlaying(false);
            }
        }
    }

    return (
        <main
            style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-start",
                gap: 8,
            }}
        >
            <div
                style={{
                    display: "flex",
                    flex: "1 1 320px",
                    flexDirection: "column",
                    gap: "1rem",
                    minWidth: 0,
                }}
            >
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        void play();
                    }}
                >
                    <label htmlFor="sound-text">Texte</label>
                    <input
                        id="sound-text"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                    />
                    <label htmlFor="sound-instrument">Instrument</label>
                    <select
                        id="sound-instrument"
                        value={settings.instrument}
                        onChange={(event) => {
                            const instrument = event.target.value as Instrument;
                            setSettings((current) =>
                                withInstrumentProfile(
                                    current,
                                    instrument,
                                    profilesRef.current[instrument],
                                ),
                            );
                        }}
                    >
                        {Object.entries(INSTRUMENTS).map(
                            ([instrument, config]) => (
                                <option key={instrument} value={instrument}>
                                    {config.label}
                                </option>
                            ),
                        )}
                    </select>
                    <button type="submit" disabled={!text.trim()}>
                        Play
                    </button>
                    <button type="button" disabled={!playing} onClick={stop}>
                        Stop
                    </button>
                    <Link to={getToken() ? "/" : "/login"}>Retour</Link>
                    {error && <p role="alert">{error}</p>}
                </form>
                <SoundStaff
                    key={visual?.id ?? "empty"}
                    plan={visual?.plan ?? null}
                    settings={visual?.settings ?? settings}
                    getPlayhead={visual?.getPlayhead ?? null}
                />
            </div>
            <SoundSettingsPanel
                key={settings.instrument}
                initialSettings={settings}
                density={plan.density}
                onChange={changeSettings}
                onError={setError}
                onReset={resetInstrumentProfiles}
            />
        </main>
    );
}
