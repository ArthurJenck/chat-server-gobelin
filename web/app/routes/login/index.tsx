import { useState } from "react";
import { Link, useNavigate } from "react-router";
import AuthForm from "../../components/AuthForm";
import EmphasizedText from "../../components/EmphasizedText";
import { login } from "../../features/auth/api";
import { setToken } from "../../features/auth/token";
import "../auth.css";
import "./login.css";

export default function Login() {
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
            const token = await login(username.trim(), password);
            setToken(token);
            void navigate("/", { replace: true });
        } catch {
            setError("Nom d’utilisateur ou mot de passe incorrect");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main
            className={
                error
                    ? "auth-page login-page login-page-error"
                    : "auth-page login-page"
            }
        >
            <div className="auth-content">
                <h1>Se connecter</h1>
                {error && (
                    <p id="login-error" role="alert">
                        {error}
                    </p>
                )}
                <AuthForm
                    mode="login"
                    username={username}
                    password={password}
                    busy={busy}
                    error={Boolean(error)}
                    onUsernameChange={setUsername}
                    onPasswordChange={setPassword}
                    onSubmit={(event) => void submit(event)}
                />
            </div>
            <p className="auth-footer">
                <span>Tu n’as pas de compte ?</span>
                <Link to="/register">
                    <EmphasizedText>Inscris-toi</EmphasizedText>
                </Link>
            </p>
        </main>
    );
}
