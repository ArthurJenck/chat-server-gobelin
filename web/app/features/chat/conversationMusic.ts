import { metadataForProject } from "../../shared/projectMetadata";
import { getMessages, sendMessage } from "../messages/api";
import type { Message } from "../messages/types";

export type MusicKey = { root: number; mode: "major" | "minor" };

export const DEFAULT_MUSIC_KEY: MusicKey = { root: 0, mode: "major" };
// export const INACTIVITY_MS = 12 * 60 * 60 * 1000; // 12 hours
export const INACTIVITY_MS = 1 * 60 * 1000; // 1 minute

const COLORS = [
    ["#4DF8E7", "#FF0004"],
    ["#FFA200", "#A200C6"],
    ["#FFFF0A", "#1829E1"],
    ["#00D9BC", "#FF00A6"],
    ["#25CA63", "#823F17"],
    ["#7DFD48", "#4C74F9"],
    ["#FFD146", "#4CF9C3"],
    ["#C95D26", "#5C22CD"],
    ["#8BD9FE", "#FFAAE1"],
    ["#9502C5", "#FF4646"],
    ["#99C100", "#018EC0"],
    ["#2300C1", "#C11A00"],
] as const;

export function musicColor(key: MusicKey) {
    return COLORS[key.root][key.mode === "major" ? 0 : 1];
}

export function messageMusicKey(message: Message): MusicKey | null {
    const metadata = metadataForProject(message.metadata);
    const root = metadata.music_root;
    const mode = metadata.music_mode;
    if (
        typeof root !== "number" ||
        !Number.isInteger(root) ||
        root < 0 ||
        root > 11
    )
        return null;
    return { root, mode: mode === "minor" ? "minor" : "major" };
}

export function isConversationRest(message: Message) {
    return metadataForProject(message.metadata).type === "conversation_rest";
}

export function latestMusicKey(messages: Message[]): MusicKey {
    const keyed = [...messages]
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
        .find((message) => messageMusicKey(message));
    return keyed ? messageMusicKey(keyed)! : DEFAULT_MUSIC_KEY;
}

export function dueConversationRest(messages: Message[], now = Date.now()) {
    const latest = [...messages]
        .filter((message) => !message.content.startsWith("clock tick : "))
        .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    if (
        !latest ||
        isConversationRest(latest) ||
        latest.user === "internal-clock"
    )
        return false;
    const sent = Date.parse(latest.creation_date);
    return Number.isFinite(sent) && sent <= now && now - sent >= INACTIVITY_MS;
}

export async function publishDueConversationRest(
    channelId: number,
    now = Date.now(),
) {
    const check = async () => {
        const messages = await getMessages(channelId);
        if (!dueConversationRest(messages, now)) return false;
        const current = latestMusicKey(messages);
        const next: MusicKey = {
            root: (current.root + 1) % 12,
            mode: current.mode,
        };
        await sendMessage(
            channelId,
            "",
            {
                type: "conversation_rest",
                music_root: next.root,
                music_mode: next.mode,
            },
            true,
        );
        return true;
    };
    if (typeof navigator !== "undefined" && navigator.locks)
        return navigator.locks.request(`conversation-rest-${channelId}`, check);
    return check();
}
