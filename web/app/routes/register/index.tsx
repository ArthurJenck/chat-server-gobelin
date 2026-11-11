import { useState } from "react";
import { Link, useNavigate } from "react-router";
import AuthForm from "../../components/AuthForm";
import EmphasizedText from "../../components/EmphasizedText";
import { useRegistration } from "../../features/auth/RegistrationContext";
import { PATHS } from "../../shared/config";
import "../auth.css";
import "./register.css";

export default function Register() {
    const navigate = useNavigate();
    const { registration, setRegistration, setSelectedInstrument } = useRegistration();
    const [username, setUsername] = useState(registration?.username ?? "");
    const [password, setPassword] = useState(registration?.password ?? "");
    const [confirmation, setConfirmation] = useState(registration?.password ?? "");
    const [error, setError] = useState("");

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        if (password !== confirmation) {
            setError("Les mots de passe sont différents");
            return;
        }
        setRegistration({ username: username.trim(), password });
        setSelectedInstrument(null);
        void navigate(PATHS.instrument);
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
                    busy={false}
                    onUsernameChange={setUsername}
                    onPasswordChange={setPassword}
                    onConfirmationChange={setConfirmation}
                    onSubmit={submit}
                />
            </div>
            <p className="auth-footer">
                <span>Tu as déjà un compte ?</span>
                <Link
                    to="/login"
                    onClick={() => {
                        setRegistration(null);
                        setSelectedInstrument(null);
                    }}
                >
                    <EmphasizedText>Connecte-toi</EmphasizedText>
                </Link>
            </p>
        </main>
    );
}
