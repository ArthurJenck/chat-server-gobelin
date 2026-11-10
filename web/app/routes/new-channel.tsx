import { useState } from "react";
import { useNavigate } from "react-router";
import PageHeader from "../components/PageHeader";
import { KEY_CHANNEL_NAME, PATHS } from "../config";
import { createOrEnterChannel } from "../managers/channels";
import { useAccount } from "../managers/useAccount";

export default function NewChannel() {
    const navigate = useNavigate();
    const { account, loading, error: accountError } = useAccount();
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const value = name.trim();
        if (!value || value === KEY_CHANNEL_NAME || busy) return;
        const existing = account?.channels?.find(
            (channel) => channel.name === value,
        );
        if (existing) {
            void navigate(PATHS.channel(existing.id), { replace: true });
            return;
        }
        setBusy(true);
        setError("");
        try {
            const channel = await createOrEnterChannel(value);
            void navigate(PATHS.channel(channel.id), { replace: true });
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Impossible de rejoindre ou créer le groupe.",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <main>
            <PageHeader
                title="Rejoindre ou créer un groupe"
                back={PATHS.home}
            />
            {loading && <p>Chargement…</p>}
            {accountError && <p role="alert">{accountError}</p>}
            {account && (
                <form onSubmit={(event) => void submit(event)}>
                    <label htmlFor="channel-name">Nom du groupe</label>
                    <input
                        id="channel-name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                    />
                    {name.trim() === KEY_CHANNEL_NAME && (
                        <p role="alert">Ce nom est réservé.</p>
                    )}
                    {error && <p role="alert">{error}</p>}
                    <button
                        type="submit"
                        disabled={
                            !name.trim() ||
                            name.trim() === KEY_CHANNEL_NAME ||
                            busy
                        }
                    >
                        Rejoindre / Créer
                    </button>
                </form>
            )}
        </main>
    );
}
