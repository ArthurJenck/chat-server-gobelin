import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import DottedButton from "../components/DottedButton";
import InstrumentList from "../components/InstrumentList";
import { PATHS } from "../shared/config";
import { accountInstrument, saveInstrument } from "../features/users/instrument";
import { useAccount } from "../features/auth/useAccount";
import { getToken } from "../features/auth/token";
import { useRegistration } from "../features/auth/RegistrationContext";
import "./instrument.css";

export default function InstrumentPage() {
    const navigate = useNavigate();
    const { registration, selectedInstrument, setSelectedInstrument } = useRegistration();
    const { account, loading, error: accountError } = useAccount(false, false);
    const initial = account && accountInstrument(account);
    const enteredWithSelection = useRef(Boolean(selectedInstrument));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!getToken() && !registration) void navigate("/register", { replace: true });
    }, [navigate, registration]);

    useEffect(() => {
        if (initial && !selectedInstrument && !registration && !enteredWithSelection.current)
            void navigate(PATHS.home, { replace: true });
    }, [initial, navigate, registration, selectedInstrument]);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedInstrument || (!account && !registration) || busy) return;
        if (account && initial) {
            setBusy(true);
            setError("");
            try {
                if (selectedInstrument !== initial)
                    await saveInstrument(account, selectedInstrument);
                setSelectedInstrument(null);
                void navigate(PATHS.profile, { replace: true });
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Enregistrement impossible.");
            } finally {
                setBusy(false);
            }
        } else {
            void navigate(PATHS.confirmation);
        }
    }

    return (
        <main className="instrument-page">
            <h1 id="instrument-title">
                <span>Choisis ton</span>{" "}
                <span>instrument</span>
            </h1>
            {loading && <p>Chargement…</p>}
            {accountError && <p role="alert">{accountError}</p>}
            {error && <p role="alert">{error}</p>}
            {(account || registration) && (
                <form
                    className="instrument-form"
                    onSubmit={submit}
                >
                    <InstrumentList
                        selected={selectedInstrument}
                        onChange={setSelectedInstrument}
                        labelledBy="instrument-title"
                    />
                    <DottedButton
                        className="instrument-submit"
                        type="submit"
                        iconSrc="/pictos/arrow.svg"
                        emphasized
                        disabled={!selectedInstrument || busy}
                    >
                        {initial ? "Valider" : "Continuer"}
                    </DottedButton>
                </form>
            )}
        </main>
    );
}
