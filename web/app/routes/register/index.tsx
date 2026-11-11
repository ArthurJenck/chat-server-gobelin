import { useState } from "react";
import { Link, useNavigate } from "react-router";
import AuthForm from "../../components/AuthForm";
import EmphasizedText from "../../components/EmphasizedText";
import { login, register } from "../../features/auth/api";
import { setToken } from "../../features/auth/token";
import "../auth.css";
import "./register.css";

export default function Register() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (password !== confirmation) {
            setError("Les mots de passe sont différents");
            return;
        }
        setBusy(true);
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
        <main className="auth-page register-page">
            <div className="auth-content">
                <h1>S’inscrire</h1>
                {error && <p role="alert">{error}</p>}
                <AuthForm
                    mode="register"
                    username={username}
                    password={password}
                    confirmation={confirmation}
                    busy={busy}
                    onUsernameChange={setUsername}
                    onPasswordChange={setPassword}
                    onConfirmationChange={setConfirmation}
                    onSubmit={(event) => void submit(event)}
                />
            </div>
            <p className="auth-footer">
                <span>Tu as déjà un compte ?</span>
                <Link to="/login">
                    <EmphasizedText>Connecte-toi</EmphasizedText>
                </Link>
            </p>
        </main>
    );
}
