import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
} from "react-router";
import { useEffect, useRef, useState } from "react";

import type { Route } from "./+types/root";
import InstallPrompt from "./InstallPrompt";

export const links: Route.LinksFunction = () => [
    { rel: "manifest", href: "/manifest.webmanifest" },
    { rel: "icon", href: "/favicon.ico" },
    { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr">
            <head>
                <meta charSet="utf-8" />
                <meta name="theme-color" content="#ffffff" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <Meta />
                <Links />
            </head>
            <body>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    const swRegistered = useRef(false);
    const [online, setOnline] = useState(true);

    useEffect(() => {
        const updateOnline = () => setOnline(navigator.onLine);
        updateOnline();
        window.addEventListener("online", updateOnline);
        window.addEventListener("offline", updateOnline);
        return () => {
            window.removeEventListener("online", updateOnline);
            window.removeEventListener("offline", updateOnline);
        };
    }, []);

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;

        if (import.meta.env.DEV) {
            void navigator.serviceWorker
                .getRegistration("/")
                .then((registration) => registration?.unregister())
                .catch((error) => console.error("SW cleanup failed", error));
            return;
        }

        if (swRegistered.current) return;
        swRegistered.current = true;

        void navigator.serviceWorker
            .register("/sw.js", { scope: "/" })
            .catch((error) => console.error("SW registration failed", error));
    }, []);

    return (
        <>
            {!online && (
                <p role="status">
                    Connexion indisponible. Les messages nécessitent une
                    connexion.
                </p>
            )}
            <Outlet />
            <InstallPrompt />
        </>
    );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
    let message = "Oops!";
    let details = "An unexpected error occurred.";

    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? "404" : "Error";
        details = error.statusText || details;
    } else if (import.meta.env.DEV && error instanceof Error) {
        details = error.message;
    }

    return (
        <main>
            <h1>{message}</h1>
            <p>{details}</p>
        </main>
    );
}
