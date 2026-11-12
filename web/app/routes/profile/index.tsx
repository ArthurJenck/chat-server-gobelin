import { Link, useNavigate } from "react-router";
import EmphasizedText from "../../components/EmphasizedText";
import { clearToken } from "../../features/auth/token";
import { useRegistration } from "../../features/auth/RegistrationContext";
import { useAccount } from "../../features/auth/useAccount";
import { INSTRUMENTS } from "../../features/sound/soundConfig";
import { accountInstrument } from "../../features/users/instrument";
import { PATHS } from "../../shared/config";
import "./profile.css";

export default function Profile() {
    const navigate = useNavigate();
    const { account, loading, error } = useAccount();
    const { setSelectedInstrument } = useRegistration();
    const instrument = account ? accountInstrument(account) : null;

    function logout() {
        clearToken();
        void navigate(PATHS.welcome, { replace: true });
    }

    return (
        <main className="profile-page">
            <button
                className="profile-back"
                type="button"
                aria-label="Retour"
                onClick={() => void navigate(PATHS.home)}
            >
                <img src="/pictos/arrow.svg" alt="" />
            </button>
            <h1 className="profile-title">Mon pupitre</h1>
            {loading && <p className="profile-status">Chargement du profil…</p>}
            {error && <p className="profile-status" role="alert">{error}</p>}
            {account && instrument && (
                <>
                    <div className="profile-details">
                        <div className="profile-detail">
                            <p className="profile-label">Nom d’utilisateur :</p>
                            <p className="profile-value" title={account.username}>{account.username}</p>
                        </div>
                        <div className="profile-detail">
                            <p className="profile-label">Instrument :</p>
                            <p className="profile-value" title={INSTRUMENTS[instrument].label}>
                                {INSTRUMENTS[instrument].label}
                            </p>
                        </div>
                        <Link
                            className="profile-change-instrument"
                            to={PATHS.instrument}
                            onClick={() => setSelectedInstrument(instrument)}
                        >
                            Je veux changer d’instrument
                        </Link>
                    </div>
                    <button className="profile-logout" type="button" onClick={logout}>
                        <EmphasizedText>Me déconnecter</EmphasizedText>
                    </button>
                </>
            )}
        </main>
    );
}
