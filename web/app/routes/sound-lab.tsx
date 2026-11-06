import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { getToken } from '../api'
import { startPlayback } from '../sound/audioEngine'
import SoundSettingsPanel from '../sound/SoundSettingsPanel'
import type { Instrument } from '../sound/soundConfig'
import { readSavedSoundSettings, saveSoundSettings } from '../sound/soundPreset'
import { createSoundPlan } from '../sound/soundPlan'

export default function SoundLab() {
    const [text, setText] = useState('')
    const [settings, setSettings] = useState(readSavedSoundSettings)
    const [playing, setPlaying] = useState(false)
    const [error, setError] = useState('')
    const stopRef = useRef<(() => void) | null>(null)
    const playId = useRef(0)
    const plan = createSoundPlan(text.trim(), settings)

    useEffect(() => {
        saveSoundSettings(settings)
    }, [settings])

    useEffect(
        () => () => {
            playId.current += 1
            stopRef.current?.()
        },
        []
    )

    function stop() {
        playId.current += 1
        stopRef.current?.()
        stopRef.current = null
        setPlaying(false)
    }

    async function play() {
        if (!plan.events.length) return
        stop()
        const id = ++playId.current
        setError('')
        setPlaying(true)
        try {
            const stopPlayback = await startPlayback(plan, settings, () => {
                if (playId.current === id) {
                    stopRef.current = null
                    setPlaying(false)
                }
            })
            if (playId.current !== id) stopPlayback()
            else stopRef.current = stopPlayback
        } catch (cause) {
            if (playId.current === id) {
                setError(
                    cause instanceof Error
                        ? cause.message
                        : 'Lecture impossible.'
                )
                setPlaying(false)
            }
        }
    }

    return (
        <main
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                gap: 8,
            }}
        >
            <form onSubmit={(event) => {
                event.preventDefault()
                void play()
            }}>
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
                    onChange={(event) =>
                        setSettings((current) => ({
                            ...current,
                            instrument: event.target.value as Instrument,
                        }))
                    }
                >
                    <option value="piano">Piano</option>
                    <option value="guitar">Guitare</option>
                    <option value="trumpet">Trompette</option>
                </select>
                <button
                    type="submit"
                    disabled={!text.trim()}
                >
                    Play
                </button>
                <button type="button" disabled={!playing} onClick={stop}>
                    Stop
                </button>
                <Link to={getToken() ? '/' : '/login'}>Retour</Link>
                {error && <p role="alert">{error}</p>}
            </form>
            <SoundSettingsPanel
                initialSettings={settings}
                density={plan.density}
                onChange={setSettings}
                onError={setError}
            />
        </main>
    )
}
