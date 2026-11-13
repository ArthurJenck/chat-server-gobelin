import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
    plugins: [
        reactRouter(),
        VitePWA({
            registerType: "autoUpdate",
            injectRegister: false,
            devOptions: { enabled: true },
            outDir: "build/client",
            workbox: {
                navigateFallback: null,
                skipWaiting: true,
                clientsClaim: true,
                globIgnores: ["**/ort-wasm-*.wasm"],
                runtimeCaching: [
                    {
                        urlPattern: ({ request }) =>
                            request.mode === "navigate",
                        handler: "NetworkOnly",
                        options: {
                            precacheFallback: { fallbackURL: "/offline.html" },
                        },
                    },
                ],
            },
            includeAssets: [
                "favicon.ico",
                "apple-touch-icon.png",
                "fonts/angeris-disco.ttf",
            ],
            manifest: {
                name: "Harmonie",
                short_name: "Harmonie",
                description: "Le tchat sur la musicalité du langage.",
                lang: "fr",
                start_url: "/",
                scope: "/",
                theme_color: "#FFFEF3",
                background_color: "#FFFEF3",
                display: "standalone",
                icons: [
                    {
                        src: "pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "pwa-maskable-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
        }),
    ],
    resolve: { tsconfigPaths: true },
});
