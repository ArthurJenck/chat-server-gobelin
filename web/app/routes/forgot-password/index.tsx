import { useNavigate } from "react-router";
import DottedButton from "../../components/DottedButton";
import "./forgot-password.css";

export default function ForgotPassword() {
    const navigate = useNavigate();

    return (
        <main className="forgot-password-page">
            <div className="forgot-password-content">
                <h1>
                    Gros loser ! <br />
                    Crée un nouveau <br />
                    compte
                </h1>
                <DottedButton
                    iconSrc="/pictos/arrow.svg"
                    emphasized
                    onClick={() => void navigate("/register")}
                >
                    S’inscrire
                </DottedButton>
            </div>
        </main>
    );
}
