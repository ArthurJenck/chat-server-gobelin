import { useNavigate } from "react-router";
import { PATHS } from "../shared/config";

export default function Welcome() {
    const navigate = useNavigate();

    return (
        <main>
            <h1>Bienvenue à Harmonie</h1>
            <button type="button" onClick={() => void navigate(PATHS.login)}>
                C'est parti !
            </button>
        </main>
    );
}
