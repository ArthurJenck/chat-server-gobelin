import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: { alias: { "~": new URL("./app", import.meta.url).pathname } },
    define: {
        "import.meta.env.VITE_API_URL": JSON.stringify("http://localhost:4000"),
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./test/setup.ts"],
    },
});
