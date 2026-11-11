import { Link, useNavigate } from "react-router";
import { clearToken } from "../features/auth/token";
import PageHeader from "../components/PageHeader";
import { PATHS } from "../shared/config";
import { accountInstrument } from "../features/users/instrument";
import { useAccount } from "../features/auth/useAccount";
import { INSTRUMENTS } from "../features/sound/soundConfig";

export default function Profile() {
    const navigate = useNavigate();
    const { account, loading, error } = useAccount();
    const instrument = account && accountInstrument(account);

    function logout() {
        clearToken();
        void navigate(PATHS.welcome, { replace: true });
    }

    return (
        <main>
            <PageHeader title="Profil" back={PATHS.home} />
            {loading && <p>Chargement du profil…</p>}
            {error && <p role="alert">{error}</p>}
            {account && (
                <>
                    <section aria-labelledby="username-heading">
                        <h2 id="username-heading">Nom d’utilisateur</h2>
                        <p>{account.username}</p>
                    </section>
                    <section aria-labelledby="instrument-heading">
                        <h2 id="instrument-heading">Instrument</h2>
                        <p>
                            {instrument
                                ? INSTRUMENTS[instrument].label
                                : "Aucun instrument choisi"}
                        </p>
                        <Link to={PATHS.instrument}>Modifier l’instrument</Link>
                    </section>
                    <button type="button" onClick={logout}>
                        Se déconnecter
                    </button>
                </>
            )}
        </main>
    );
}
