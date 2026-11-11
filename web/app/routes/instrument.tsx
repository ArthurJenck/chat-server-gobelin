import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import DottedButton from "../components/DottedButton";
import InstrumentList from "../components/InstrumentList";
import { PATHS } from "../shared/config";
import {
    accountInstrument,
    saveInstrument,
} from "../features/users/instrument";
import { useAccount } from "../features/auth/useAccount";
import type { Instrument } from "../features/sound/soundConfig";
import "./instrument.css";

export default function InstrumentPage() {
    const navigate = useNavigate();
    const { account, loading, error: accountError } = useAccount(false);
    const initial = account && accountInstrument(account);
    const [selected, setSelected] = useState<Instrument | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (initial) setSelected(initial);
    }, [initial]);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!account || !selected || busy) return;
        setBusy(true);
        setError("");
        try {
            await saveInstrument(account, selected);
            void navigate(initial ? PATHS.profile : PATHS.home, {
                replace: true,
            });
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Enregistrement impossible.",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="instrument-page">
            <h1 id="instrument-title">
                <span>Choisis ton</span>
                <span>instrument</span>
            </h1>
            {loading && <p>Chargement…</p>}
            {accountError && <p role="alert">{accountError}</p>}
            {account && (
                <form
                    className="instrument-form"
                    onSubmit={(event) => void submit(event)}
                >
                    <InstrumentList
                        selected={selected}
                        onChange={setSelected}
                        labelledBy="instrument-title"
                    />
                    {error && <p role="alert">{error}</p>}
                    <DottedButton
                        className="instrument-submit"
                        type="submit"
                        iconSrc="/pictos/arrow.svg"
                        emphasized
                        disabled={!selected || busy}
                    >
                        Continuer
                    </DottedButton>
                </form>
            )}
        </main>
    );
}
