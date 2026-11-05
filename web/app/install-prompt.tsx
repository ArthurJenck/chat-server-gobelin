import { useEffect, useState } from 'react'

type InstallEvent = Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
    const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)

    useEffect(() => {
        function onInstallAvailable(event: Event) {
            event.preventDefault()
            setInstallEvent(event as InstallEvent)
        }

        function onInstalled() {
            setInstallEvent(null)
        }

        window.addEventListener('beforeinstallprompt', onInstallAvailable)
        window.addEventListener('appinstalled', onInstalled)
        return () => {
            window.removeEventListener('beforeinstallprompt', onInstallAvailable)
            window.removeEventListener('appinstalled', onInstalled)
        }
    }, [])

    async function install() {
        if (!installEvent) return
        await installEvent.prompt()
        await installEvent.userChoice
        setInstallEvent(null)
    }

    if (!installEvent) return null

    return <button type="button" onClick={() => void install()}>Installer l’application</button>
}
