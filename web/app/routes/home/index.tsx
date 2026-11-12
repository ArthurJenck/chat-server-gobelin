import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { visibleChannels } from "../../features/channels/channels";
import { useAccount } from "../../features/auth/useAccount";
import { PATHS } from "../../shared/config";
import notebookSvg from "./notebook.svg?raw";
import "./home.css";

const notebookTones = ["dark", "medium", "light", "dark"] as const;

export default function Home() {
    const { account, loading, error } = useAccount();
    const channels = account ? visibleChannels(account) : [];
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);
    const [scrollIndicatorTop, setScrollIndicatorTop] = useState(0);

    function updateOverflow() {
        const scrollArea = scrollRef.current;
        if (!scrollArea) return;
        const remaining = scrollArea.scrollHeight - scrollArea.clientHeight;
        setCanScrollUp(scrollArea.scrollTop > 1);
        setCanScrollDown(scrollArea.scrollTop < remaining - 1);
        setScrollIndicatorTop(
            remaining > 0
                ? Math.min(1, Math.max(0, scrollArea.scrollTop / remaining)) *
                  Math.max(0, scrollArea.clientHeight - 40)
                : 0,
        );
    }

    useEffect(() => {
        const scrollArea = scrollRef.current;
        if (!scrollArea) return;

        updateOverflow();
        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(updateOverflow);
            observer.observe(scrollArea);
            return () => observer.disconnect();
        }
        window.addEventListener("resize", updateOverflow);
        return () => window.removeEventListener("resize", updateOverflow);
    }, [channels.length]);

    return (
        <main className="home-page">
            <nav className="home-actions" aria-label="Actions principales">
                <Link className="home-profile" to={PATHS.profile} aria-label="Profil">
                    <img src="/pictos/profile.svg" alt="" />
                </Link>
                <Link className="home-add" to={PATHS.newChannel} aria-label="Ajouter un groupe">
                    <span className="home-add-icon home-add-icon-blur" aria-hidden="true" />
                    <span className="home-add-icon" aria-hidden="true" />
                </Link>
            </nav>
            <h1 className="home-title" id="home-title">Mes partitions</h1>
            {loading && <p>Chargement des groupes…</p>}
            {error && <p role="alert">{error}</p>}
            {account && channels.length === 0 && <p>Aucun groupe.</p>}
            {account && channels.length > 0 && (
                <section
                    className={`home-notebooks${canScrollUp ? " home-notebooks--fade-top" : ""}${canScrollDown ? " home-notebooks--fade-bottom" : ""}`}
                    aria-labelledby="home-title"
                >
                    <div
                        className="home-notebooks-scroll"
                        ref={scrollRef}
                        onScroll={updateOverflow}
                    >
                        <ul className="home-notebooks-list">
                            {channels.map((channel, index) => (
                                <li
                                    className={`home-notebook home-notebook--${notebookTones[index % notebookTones.length]}`}
                                    key={channel.id}
                                >
                                    <Link className="home-notebook-link" to={PATHS.channel(channel.id)}>
                                        <span
                                            className="home-notebook-art"
                                            aria-hidden="true"
                                            dangerouslySetInnerHTML={{ __html: notebookSvg }}
                                        />
                                        <img
                                            className="home-notebook-group"
                                            src="/pictos/group.svg"
                                            alt=""
                                            aria-hidden="true"
                                        />
                                        <span className="home-notebook-name">{channel.name}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {(canScrollUp || canScrollDown) && (
                        <span
                            className="home-scroll-indicator"
                            style={{ top: scrollIndicatorTop }}
                            aria-hidden="true"
                        />
                    )}
                </section>
            )}
        </main>
    );
}
