import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import PageHeader from "../components/PageHeader";
import { PATHS } from "../shared/config";
import {
    accountInstrument,
    saveInstrument,
} from "../features/users/instrument";
import { useAccount } from "../features/auth/useAccount";
import { INSTRUMENTS, type Instrument } from "../features/sound/soundConfig";

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
        <main>
            <PageHeader
                title="Choisir un instrument"
                back={initial ? PATHS.profile : undefined}
            />
            {loading && <p>Chargement…</p>}
            {accountError && <p role="alert">{accountError}</p>}
            {account && (
                <form onSubmit={(event) => void submit(event)}>
                    <fieldset>
                        <legend>Instruments</legend>
                        {(
                            Object.entries(INSTRUMENTS) as [
                                Instrument,
                                { label: string },
                            ][]
                        ).map(([value, config]) => (
                            <label key={value}>
                                <input
                                    type="radio"
                                    name="instrument"
                                    value={value}
                                    checked={selected === value}
                                    onChange={() => setSelected(value)}
                                />
                                {config.label}
                            </label>
                        ))}
                    </fieldset>
                    {error && <p role="alert">{error}</p>}
                    <button type="submit" disabled={!selected || busy}>
                        Continuer
                    </button>
                </form>
            )}
        </main>
    );
}
