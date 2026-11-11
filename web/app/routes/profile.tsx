import { useNavigate } from "react-router";
import DottedButton from "../components/DottedButton";
import ProfileSummary from "../components/ProfileSummary";
import { clearToken } from "../features/auth/token";
import { useRegistration } from "../features/auth/RegistrationContext";
import { PATHS } from "../shared/config";
import { accountInstrument } from "../features/users/instrument";
import { useAccount } from "../features/auth/useAccount";

export default function Profile() {
    const navigate = useNavigate();
    const { account, loading, error } = useAccount();
    const { setSelectedInstrument } = useRegistration();
    const instrument = account ? accountInstrument(account) : null;

    function logout() {
        clearToken();
        void navigate(PATHS.welcome, { replace: true });
    }

    function changeInstrument() {
        if (!instrument) return;
        setSelectedInstrument(instrument);
        void navigate(PATHS.instrument);
    }

    return (
        <ProfileSummary
            username={account?.username}
            instrument={instrument}
            onBack={() => void navigate(PATHS.home)}
            onInstrumentClick={changeInstrument}
        >
            {loading && <p>Chargement du profil…</p>}
            {error && <p role="alert">{error}</p>}
            {account && (
                <DottedButton
                    className="confirmation-submit"
                    iconSrc="/pictos/arrow.svg"
                    emphasized
                    onClick={logout}
                >
                    Se déconnecter
                </DottedButton>
            )}
        </ProfileSummary>
    );
}
