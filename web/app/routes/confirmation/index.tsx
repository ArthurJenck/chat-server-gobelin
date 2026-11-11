import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import DottedButton from "../../components/DottedButton";
import ProfileSummary from "../../components/ProfileSummary";
import { login, register } from "../../features/auth/api";
import { useRegistration } from "../../features/auth/RegistrationContext";
import { getToken, setToken } from "../../features/auth/token";
import { useAccount } from "../../features/auth/useAccount";
import { accountInstrument, saveInstrument } from "../../features/users/instrument";
import { PATHS } from "../../shared/config";

export default function Confirmation() {
    const navigate = useNavigate();
    const hasSession = Boolean(getToken());
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
        if (hasSession ? !account : !registration) return;
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
            } else if (!hasSession && registration) {
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

    if (hasSession && (loading || !account)) {
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
                {loading ? (
                    <p>Chargement du profil…</p>
                ) : (
                    <p role="alert">{accountError || "Compte indisponible."}</p>
                )}
            </main>
        );
    }

    const username = hasSession ? account?.username : registration?.username;
    if (!selectedInstrument) return null;

    return (
        <ProfileSummary
            username={username}
            instrument={selectedInstrument}
            onBack={() => void navigate(PATHS.instrument)}
        >
            {error && <p role="alert">{error}</p>}
            <DottedButton
                className="confirmation-submit"
                iconSrc="/pictos/arrow.svg"
                emphasized
                disabled={busy || loading || !username || !selectedInstrument}
                onClick={() => void continueToApp()}
            >
                Continuer
            </DottedButton>
        </ProfileSummary>
    );
}
