import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { login, setToken } from '../api'

export default function Login() {
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError('')
        try {
            const token = await login(username.trim(), password)
            setToken(token)
            void navigate('/', { replace: true })
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Connexion impossible.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <main>
            <h1>Connexion</h1>
            {error && <p role="alert">{error}</p>}
            <form onSubmit={(event) => void submit(event)}>
                <label htmlFor="login-username">Nom d’utilisateur</label>
                <input id="login-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
                <label htmlFor="login-password">Mot de passe</label>
                <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button type="submit" disabled={busy}>Se connecter</button>
            </form>
            <p><Link to="/register">Créer un compte</Link></p>
            <p><Link to="/atelier-son">Atelier son</Link></p>
        </main>
    )
}
