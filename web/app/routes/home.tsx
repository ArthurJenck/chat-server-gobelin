import { Link } from "react-router";
import PageHeader from "../components/PageHeader";
import { PATHS } from "../config";
import { visibleChannels } from "../managers/channels";
import { useAccount } from "../managers/useAccount";

export default function Home() {
    const { account, loading, error } = useAccount();
    const channels = account ? visibleChannels(account) : [];

    return (
        <main>
            <PageHeader title="Mes groupes" />
            <nav aria-label="Actions principales">
                <Link to={PATHS.profile}>Profil</Link>
                <Link to={PATHS.newChannel}>Ajouter un groupe</Link>
            </nav>
            {loading && <p>Chargement des groupes…</p>}
            {error && <p role="alert">{error}</p>}
            {account && (
                <section aria-labelledby="groups-heading">
                    <h2 id="groups-heading">Groupes</h2>
                    {channels.length ? (
                        <ul>
                            {channels.map((channel) => (
                                <li key={channel.id}>
                                    <Link to={PATHS.channel(channel.id)}>
                                        {channel.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>Aucun groupe.</p>
                    )}
                </section>
            )}
        </main>
    );
}
