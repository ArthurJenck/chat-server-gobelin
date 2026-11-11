import { useNavigate } from "react-router";
import DottedButton from "../components/DottedButton";
import { PATHS } from "../shared/config";
import "./welcome.css";

export default function Welcome() {
    const navigate = useNavigate();

    return (
        <main className="welcome-page">
            <h1 className="welcome-title">
                <span>Bienvenue à</span> <span>Harmonie</span>
            </h1>
            <div className="welcome-symbol" aria-hidden="true">
                <img className="welcome-star" src="/pictos/star.svg" alt="" />
                <img className="welcome-key" src="/pictos/key.svg" alt="" />
            </div>
            <DottedButton
                iconSrc="/pictos/arrow.svg"
                onClick={() => void navigate(PATHS.login)}
            >
                C'est parti !
            </DottedButton>
        </main>
    );
}
