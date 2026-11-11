import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import DottedButton from "../../components/DottedButton";
import { login, register } from "../../features/auth/api";
import { useRegistration } from "../../features/auth/RegistrationContext";
import { getToken, setToken } from "../../features/auth/token";
import { useAccount } from "../../features/auth/useAccount";
import { INSTRUMENTS } from "../../features/sound/soundConfig";
import { accountInstrument, saveInstrument } from "../../features/users/instrument";
import { PATHS } from "../../shared/config";
import "./confirmation.css";

export default function Confirmation() {
    const navigate = useNavigate();
    const { registration, setRegistration, selectedInstrument, setSelectedInstrument } = useRegistration();
    const { account, loading, error: accountError } = useAccount(false, false);
    const [busy, setBusy] = useState(false);
    const [created, setCreated] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (completed) return;
        if (!getToken() && !registration) {
            void navigate("/register", { replace: true });
        } else if (!selectedInstrument) {
            void navigate(PATHS.instrument, { replace: true });
        }
    }, [completed, navigate, registration, selectedInstrument]);

    async function continueToApp() {
        if (!selectedInstrument || busy) return;
        if (!registration && !account) return;
        setBusy(true);
        setError("");
        try {
            if (account) {
                await saveInstrument(account, selectedInstrument);
                setCompleted(true);
                setSelectedInstrument(null);
                void navigate(accountInstrument(account) ? PATHS.profile : PATHS.home, {
                    replace: true,
                });
            } else if (registration) {
                if (!created) {
                    await register(registration.username, registration.password, selectedInstrument);
                    setCreated(true);
                }
                setToken(await login(registration.username, registration.password));
                setCompleted(true);
                setRegistration(null);
                setSelectedInstrument(null);
                void navigate(PATHS.home, { replace: true });
            }
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : account ? "Enregistrement impossible." : "Inscription impossible.",
            );
        } finally {
            setBusy(false);
        }
    }

    const username = account?.username ?? registration?.username;

    return (
        <main className="confirmation-page">
            <button
                className="confirmation-back"
                type="button"
                aria-label="Retour"
                onClick={() => void navigate(PATHS.instrument)}
            >
                <img src="/pictos/arrow.svg" alt="" />
            </button>
            <h1 className="confirmation-title">
                <span>Tu fais partie de</span>{" "}
                <span>la communauté</span>{" "}
                <span>Harmonie</span>
            </h1>
            <div className="confirmation-symbol" aria-hidden="true">
                <img className="confirmation-star" src="/pictos/star.svg" alt="" />
                <img className="confirmation-key" src="/pictos/key.svg" alt="" />
            </div>
            {username && selectedInstrument && (
                <div className="confirmation-details">
                    <p>{username}</p>
                    <p>{INSTRUMENTS[selectedInstrument].label}</p>
                </div>
            )}
            {(accountError || error) && <p role="alert">{accountError || error}</p>}
            <DottedButton
                className="confirmation-submit"
                iconSrc="/pictos/arrow.svg"
                emphasized
                disabled={busy || loading || !username || !selectedInstrument}
                onClick={() => void continueToApp()}
            >
                Continuer
            </DottedButton>
        </main>
    );
}
