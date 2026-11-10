import type { Config } from "@react-router/dev/config";

export default {
    ssr: process.env.STATIC_WORKSHOP !== "1",
} satisfies Config;
