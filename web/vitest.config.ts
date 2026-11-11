import { defineConfig } from "vitest/config";

export default defineConfig({
    define: {
        "import.meta.env.VITE_API_URL": JSON.stringify("http://localhost:4000"),
    },
    test: {
        environment: "jsdom",
        setupFiles: ["./test/setup.ts"],
    },
});
