import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Leva, useControls } from 'leva'
import { ApiError, getAccount, getMessages, getToken, sendMessage, type Message } from '../api'
import MessageStaff from '../MessageStaff'

export default function ChannelPage() {
    const { channelId } = useParams()
    const id = Number(channelId)
    const navigate = useNavigate()
    const [channelName, setChannelName] = useState('')
    const [messages, setMessages] = useState<Message[]>([])
    const [content, setContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const controls = useControls('Atelier de la portée', {
        Courbure: { value: 0, min: 0, max: 30, step: 1 },
        Espacement: { value: 12, min: 6, max: 18, step: 1 },
        Épaisseur: { value: 2, min: 1, max: 4, step: 0.5 },
    })
    const staffSettings = {
        curvature: controls.Courbure,
        spacing: controls.Espacement,
        thickness: controls.Épaisseur,
    }

    function handleError(cause: unknown) {
        if (cause instanceof ApiError && cause.status === 401) {
            void navigate('/login', { replace: true })
        } else {
            setError(cause instanceof Error ? cause.message : 'Impossible de charger les messages.')
        }
    }

    async function refreshMessages() {
        setMessages(await getMessages(id))
        setError('')
    }

    useEffect(() => {
        if (!getToken()) {
            void navigate('/login', { replace: true })
            return
        }
        if (!Number.isSafeInteger(id) || id <= 0) {
            setError('Channel invalide.')
            setLoading(false)
            return
        }

        let active = true
        let timer: ReturnType<typeof setInterval> | undefined

        getAccount()
            .then(async (account) => {
                if (!active) return
                const channel = account.channels?.find((item) => item.id === id)
                if (!channel) {
                    setError('Ce channel ne fait pas partie de votre compte.')
                    return
                }
                setChannelName(channel.name)
                await refreshMessages()
                if (active) {
                    timer = setInterval(() => {
                        if (document.visibilityState === 'visible') {
                            void refreshMessages().catch(handleError)
                        }
                    }, 10000)
                }
            })
            .catch(handleError)
            .finally(() => { if (active) setLoading(false) })

        return () => {
            active = false
            if (timer) clearInterval(timer)
        }
    }, [id, navigate])

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const text = content.trim()
        if (!text || busy) return
        setBusy(true)
        setError('')
        try {
            await sendMessage(id, text)
            setContent('')
            await refreshMessages()
        } catch (cause) {
            handleError(cause)
        } finally {
            setBusy(false)
        }
    }

    return (
        <main>
            <Leva />
            <p><Link to="/">Retour aux channels</Link></p>
            <h1>{channelName || 'Channel'}</h1>
            {loading && <p>Chargement des messages…</p>}
            {error && <p role="alert">{error}</p>}
            {!loading && channelName && (
                <>
                    <button type="button" onClick={() => void refreshMessages().catch(handleError)}>Actualiser</button>
                    {messages.length ? (
                        <ul>
                            {messages.map((message, index) => (
                                <li key={`${message.creation_date}-${message.user_id}-${index}`}>
                                    <strong>{message.user}</strong> : {message.content}
                                    <time dateTime={message.creation_date}> ({new Date(message.creation_date).toLocaleString('fr-FR')})</time>
                                    <MessageStaff user={message.user} settings={staffSettings} />
                                </li>
                            ))}
                        </ul>
                    ) : <p>Aucun message.</p>}
                    <form onSubmit={(event) => void submit(event)}>
                        <label htmlFor="message-content">Message</label>
                        <input id="message-content" value={content} onChange={(event) => setContent(event.target.value)} required />
                        <button type="submit" disabled={busy}>Envoyer</button>
                    </form>
                </>
            )}
        </main>
    )
}
