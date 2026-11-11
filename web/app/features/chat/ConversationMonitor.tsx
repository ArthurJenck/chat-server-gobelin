import { useEffect } from "react";
import { useLocation } from "react-router";
import { getToken } from "../auth/token";
import { visibleChannels } from "../channels/channels";
import { getAccount } from "../users/api";
import { publishDueConversationRest } from "./conversationMusic";

export default function ConversationMonitor() {
    const location = useLocation();

    useEffect(() => {
        if (location.pathname !== "/" && !location.pathname.startsWith("/channels/")) return;
        let active = true;
        let running = false;
        const check = async () => {
            if (
                !active ||
                running ||
                !getToken() ||
                document.visibilityState === "hidden"
            )
                return;
            running = true;
            try {
                const account = await getAccount();
                if (!active) return;
                await Promise.all(
                    visibleChannels(account).map((channel) =>
                        publishDueConversationRest(channel.id).catch(
                            () => false,
                        ),
                    ),
                );
            } catch {
                return;
            } finally {
                running = false;
            }
        };
        void check();
        const timer = setInterval(() => void check(), 60_000);
        document.addEventListener("visibilitychange", check);
        return () => {
            active = false;
            clearInterval(timer);
            document.removeEventListener("visibilitychange", check);
        };
    }, [location.pathname]);

    return null;
}
