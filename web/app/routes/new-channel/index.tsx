import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import DottedButton from "../../components/DottedButton";
import DottedInput from "../../components/DottedInput";
import { useAccount } from "../../features/auth/useAccount";
import { createChannel, enterChannel } from "../../features/channels/api";
import { KEY_CHANNEL_NAME, PATHS } from "../../shared/config";
import "../auth.css";
import "./new-channel.css";

export default function NewChannel() {
    const navigate = useNavigate();
    const { action } = useParams();
    const { account, error: accountError } = useAccount();
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const isJoin = action === "rejoindre";
    const isCreate = action === "creer";
    const isForm = isJoin || isCreate;
    const label = isJoin ? "Rejoindre" : "Créer";

    useEffect(() => {
        setName("");
        setError("");
    }, [action]);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const value = name.trim();
        if (!account || !value || value === KEY_CHANNEL_NAME || busy) return;

        if (isJoin) {
            const existing = account.channels?.find((channel) => channel.name === value);
            if (existing) {
                void navigate(PATHS.channel(existing.id), { replace: true });
                return;
            }
        }

        setBusy(true);
        setError("");
        try {
            const channel = isJoin
                ? await enterChannel(value)
                : await createChannel(value);
            void navigate(PATHS.channel(channel.id), { replace: true });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "La requête a échoué. Réessaie plus tard.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className={`new-channel-page${isForm ? " new-channel-page--form" : " new-channel-page--choice"}`}>
            <button
                className="new-channel-back"
                type="button"
                aria-label="Retour"
                onClick={() => void navigate(isForm ? PATHS.newChannel : PATHS.home)}
            >
                <img src="/pictos/arrow.svg" alt="" />
            </button>
            {isForm ? (
                <>
                    <h1 className="new-channel-title">{label} un orchestre</h1>
                    <form className="new-channel-form" onSubmit={(event) => void submit(event)}>
                        <DottedInput
                            id="channel-name"
                            label="Nom de l’orchestre :"
                            placeholder="team_raclette"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            invalid={Boolean(error) || name.trim() === KEY_CHANNEL_NAME}
                            required
                        />
                        {name.trim() === KEY_CHANNEL_NAME && (
                            <p className="form-error new-channel-error" role="alert">Ce nom est réservé.</p>
                        )}
                        {error && <p className="form-error new-channel-error" role="alert">{error}</p>}
                        {accountError && <p className="form-error new-channel-error" role="alert">{accountError}</p>}
                        <DottedButton
                            className="new-channel-action new-channel-submit"
                            type="submit"
                            iconSrc="/pictos/arrow.svg"
                            emphasized
                            disabled={!account || !name.trim() || name.trim() === KEY_CHANNEL_NAME || busy}
                        >
                            {label}
                        </DottedButton>
                    </form>
                </>
            ) : (
                <>
                    <h1 className="new-channel-title">Nouvel orchestre</h1>
                    <div className="new-channel-choices">
                        <DottedButton
                            className="new-channel-action"
                            iconSrc="/pictos/arrow.svg"
                            emphasized
                            onClick={() => void navigate(PATHS.joinChannel)}
                        >
                            Rejoindre
                        </DottedButton>
                        <DottedButton
                            className="new-channel-action"
                            iconSrc="/pictos/arrow.svg"
                            emphasized
                            onClick={() => void navigate(PATHS.createChannel)}
                        >
                            Créer
                        </DottedButton>
                    </div>
                </>
            )}
        </main>
    );
}
