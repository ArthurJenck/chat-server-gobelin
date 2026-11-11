import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { login, register } from "../features/auth/api";
import { setToken } from "../features/auth/token";

export default function Register() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            const name = username.trim();
            await register(name, password);
            setToken(await login(name, password));
            void navigate("/", { replace: true });
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Inscription impossible.",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <main>
            <h1>Créer un compte</h1>
            {error && <p role="alert">{error}</p>}
            <form onSubmit={(event) => void submit(event)}>
                <label htmlFor="register-username">Nom d’utilisateur</label>
                <input
                    id="register-username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                />
                <label htmlFor="register-password">Mot de passe</label>
                <input
                    id="register-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                />
                <button type="submit" disabled={busy}>
                    Créer le compte
                </button>
            </form>
            <p>
                <Link to="/login">Se connecter</Link>
            </p>
        </main>
    );
}
