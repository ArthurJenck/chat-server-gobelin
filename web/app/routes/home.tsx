import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError, clearToken, createChannel, enterChannel, getAccount, getToken, type Account } from '../api'

export default function Home() {
    const navigate = useNavigate()
    const [account, setAccount] = useState<Account | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [channelName, setChannelName] = useState('')
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!getToken()) {
            void navigate('/login', { replace: true })
            return
        }

        getAccount()
            .then(setAccount)
            .catch((cause: unknown) => {
                if (cause instanceof ApiError && cause.status === 401) {
                    void navigate('/login', { replace: true })
                } else {
                    setError(cause instanceof Error ? cause.message : 'Impossible de charger le compte.')
                }
            })
            .finally(() => setLoading(false))
    }, [navigate])

    async function submitChannel(action: 'create' | 'enter') {
        const name = channelName.trim()
        if (!name || busy) return
        setBusy(true)
        setError('')
        try {
            await (action === 'create' ? createChannel(name) : enterChannel(name))
            setAccount(await getAccount())
            setChannelName('')
        } catch (cause) {
            if (cause instanceof ApiError && cause.status === 401) {
                void navigate('/login', { replace: true })
            } else {
                setError(cause instanceof Error ? cause.message : 'Action impossible.')
            }
        } finally {
            setBusy(false)
        }
    }

    function logout() {
        clearToken()
        void navigate('/login', { replace: true })
    }

    if (loading) return <main><p>Chargement du compte…</p></main>

    return (
        <main>
            <h1>Gob Tchat</h1>
            <p><Link to="/atelier-son">Atelier son</Link></p>
            {error && <p role="alert">{error}</p>}
            {account && (
                <>
                    <section>
                        <h2>Mon compte</h2>
                        <p>Nom : {account.username}</p>
                        <p>ID : {account.id}</p>
                        <p>Nombre de channels : {account.channels?.length ?? 0}</p>
                        <button type="button" onClick={logout}>Se déconnecter</button>
                    </section>
                    <section>
                        <h2>Mes channels</h2>
                        {account.channels?.length ? (
                            <ul>
                                {account.channels.map((channel) => (
                                    <li key={channel.id}>
                                        <Link to={`/channels/${channel.id}`}>{channel.name}</Link>
                                    </li>
                                ))}
                            </ul>
                        ) : <p>Aucun channel.</p>}
                    </section>
                    <section>
                        <h2>Ajouter un channel</h2>
                        <form onSubmit={(event) => { event.preventDefault(); void submitChannel('create') }}>
                            <label htmlFor="channel-name">Nom du channel</label>
                            <input id="channel-name" value={channelName} onChange={(event) => setChannelName(event.target.value)} required />
                            <button type="submit" disabled={busy}>Créer</button>
                            <button type="button" disabled={busy || !channelName.trim()} onClick={() => void submitChannel('enter')}>Rejoindre par nom</button>
                        </form>
                    </section>
                </>
            )}
        </main>
    )
}
