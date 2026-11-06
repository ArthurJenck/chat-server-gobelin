import { CacheStorage, Soundfont } from 'smplr'
import type { Instrument, SoundSettings } from './soundConfig'
import type { SoundPlan } from './soundPlan'

const SOUNDFONT_NAMES: Record<Instrument, string> = {
    piano: 'acoustic_grand_piano',
    guitar: 'acoustic_guitar_nylon',
    trumpet: 'trumpet',
}

export async function startPlayback(plan: SoundPlan, settings: SoundSettings, onFinished: () => void): Promise<() => void> {
    if (typeof window === 'undefined' || !window.AudioContext) throw new Error('Audio indisponible sur ce navigateur.')
    const notes = [...new Set(plan.events.flatMap((event) => event.midi === null ? [] : [event.midi]))]
    if (notes.length === 0) {
        onFinished()
        return () => {}
    }

    const context = new AudioContext()
    try {
        await context.resume()
    } catch {
        void context.close()
        throw new Error('La lecture audio a échoué.')
    }

    const filter = context.createBiquadFilter()
    const master = context.createGain()
    const delay = context.createDelay(1)
    const feedback = context.createGain()
    const wet = context.createGain()
    const dry = context.createGain()

    filter.type = 'lowpass'
    filter.frequency.value = settings.filterFrequency
    filter.Q.value = settings.resonance
    filter.connect(dry)
    dry.connect(master)
    dry.gain.value = 1
    filter.connect(delay)
    delay.delayTime.value = settings.echoDelay
    delay.connect(feedback)
    feedback.connect(delay)
    feedback.gain.value = settings.echoEnabled ? settings.echoFeedback : 0
    delay.connect(wet)
    wet.connect(master)
    wet.gain.value = settings.echoEnabled ? settings.echoMix : 0
    master.gain.value = settings.volume
    master.connect(context.destination)

    let soundfont: ReturnType<typeof Soundfont> | undefined
    try {
        soundfont = Soundfont(context, {
            instrument: SOUNDFONT_NAMES[settings.instrument],
            kit: 'MusyngKite',
            destination: filter,
            notesToLoad: { notes },
            storage: 'caches' in window ? CacheStorage() : undefined,
        })
        await soundfont.ready
    } catch {
        soundfont?.dispose()
        void context.close()
        throw new Error('Chargement des sons impossible.')
    }

    const origin = context.currentTime + 0.04
    let lastNoteIndex = -1
    for (let index = 0; index < plan.events.length; index += 1) {
        if (plan.events[index].midi !== null) lastNoteIndex = index
    }
    let latestVoiceEnd = 0
    try {
        for (let index = 0; index < plan.events.length; index += 1) {
            const event = plan.events[index]
            if (event.midi === null) continue
            const isLastNote = index === lastNoteIndex
            const nextStart = isLastNote ? undefined : plan.events[index + 1]?.start
            const span = nextStart === undefined ? settings.intervalMs / 1000 : Math.max(0.001, nextStart - event.start)
            const active = Math.max(0.001, span * settings.gate)
            const lastDuration = settings.instrument === 'piano' ? 1.2 : settings.instrument === 'guitar' ? 0.8 : 0.9
            const duration = isLastNote ? Math.max(active, lastDuration) : active
            soundfont.start({ note: event.midi, time: origin + event.start, duration, velocity: 90 })
            latestVoiceEnd = Math.max(latestVoiceEnd, event.start + duration + 1.5)
        }
    } catch {
        soundfont.dispose()
        void context.close()
        throw new Error('La lecture audio a échoué.')
    }

    const repeats = settings.echoFeedback > 0
        ? Math.ceil(Math.log(0.001) / Math.log(settings.echoFeedback))
        : 0
    const echoTail = settings.echoEnabled && settings.echoMix > 0
        ? settings.echoDelay * (1 + repeats)
        : 0
    let finished = false
    const finish = (notify: boolean) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        master.gain.cancelScheduledValues(context.currentTime)
        master.gain.setValueAtTime(0, context.currentTime)
        soundfont.stop()
        soundfont.dispose()
        void context.close()
        if (notify) onFinished()
    }
    const timer = setTimeout(() => finish(true), Math.ceil((latestVoiceEnd + echoTail + 0.1) * 1000))
    return () => finish(false)
}
