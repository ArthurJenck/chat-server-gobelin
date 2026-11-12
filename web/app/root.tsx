import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLocation,
} from "react-router";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

import type { Route } from "./+types/root";
import RegistrationProvider from "./features/auth/RegistrationContext";
import { getToken } from "./features/auth/token";
import ConversationMonitor from "./features/chat/ConversationMonitor";
import { preloadEmotionModel } from "./features/chat/emotionClient";
import "./tokens.css";

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
                <meta name="theme-color" content="#FFFEF3" />
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
    const location = useLocation();
    const swRegistered = useRef(false);
    const [online, setOnline] = useState(true);

    useEffect(() => {
        let pressed: { button: HTMLButtonElement; pointerId: number } | null = null;
        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

        const reset = () => {
            if (!pressed) return;
            gsap.to(pressed.button, {
                scale: 1,
                duration: 0.12,
                overwrite: true,
            });
            pressed = null;
        };

        const press = (event: PointerEvent) => {
            if (event.button !== 0 || !event.isPrimary || reducedMotion?.matches) return;
            const button = event.target instanceof Element
                ? event.target.closest("button")
                : null;
            if (!(button instanceof HTMLButtonElement) || button.disabled) return;
            reset();
            pressed = { button, pointerId: event.pointerId };
            gsap.to(button, {
                scale: 0.95,
                duration: 0.1,
                ease: "power2.out",
                overwrite: true,
            });
        };

        const release = (event: PointerEvent) => {
            if (!pressed || event.pointerId !== pressed.pointerId) return;
            const { button } = pressed;
            pressed = null;
            if (!button.isConnected) return;
            gsap.killTweensOf(button);
            gsap.timeline()
                .to(button, { scale: 0.95, duration: 0.05, ease: "power2.out" })
                .to(button, { scale: 1.05, duration: 0.15, ease: "power2.out" })
                .to(button, { scale: 1, duration: 0.2, ease: "power2.out" });
        };

        document.addEventListener("pointerdown", press);
        document.addEventListener("pointerup", release);
        document.addEventListener("pointercancel", reset);
        window.addEventListener("blur", reset);
        return () => {
            document.removeEventListener("pointerdown", press);
            document.removeEventListener("pointerup", release);
            document.removeEventListener("pointercancel", reset);
            window.removeEventListener("blur", reset);
            reset();
        };
    }, []);

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
        if (!getToken() && location.pathname !== "/login" && location.pathname !== "/register") return;
        void preloadEmotionModel().catch(() => undefined);
    }, [location.pathname]);

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
            <RegistrationProvider>
                <ConversationMonitor />
                <Outlet />
            </RegistrationProvider>
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
