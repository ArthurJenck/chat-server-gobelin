import { Link } from "react-router";

export default function PageHeader({
    title,
    back,
}: {
    title: string;
    back?: string;
}) {
    return (
        <header>
            {back && (
                <nav aria-label="Navigation">
                    <Link to={back}>Retour</Link>
                </nav>
            )}
            <h1>{title}</h1>
        </header>
    );
}
