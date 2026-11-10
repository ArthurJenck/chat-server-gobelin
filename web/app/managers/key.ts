import { getMessages, sendMessage, type Account, type Message } from "../api";
import { KEY_CHANNEL_NAME, NAMESPACE, PARIS_TIME_ZONE } from "../config";
import { createOrEnterChannel } from "./channels";

export type KeyState = { holderId: number | null; holderName: string | null };

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

export function keyStateFromMessages(
    messages: Message[],
    now = new Date(),
): KeyState {
    const today = dayFormatter.format(now);
    const events = messages
        .filter((message) => {
            const metadata = message.metadata?.[NAMESPACE];
            if (
                !metadata ||
                typeof metadata !== "object" ||
                Array.isArray(metadata)
            )
                return false;
            const event = metadata as Record<string, unknown>;
            return (
                event.type === "classroom_key" &&
                (event.action === "claim" || event.action === "release") &&
                dayFormatter.format(
                    new Date(message.posted_at ?? message.creation_date),
                ) === today
            );
        })
        .sort(
            (a, b) =>
                Date.parse(b.posted_at ?? b.creation_date) -
                    Date.parse(a.posted_at ?? a.creation_date) ||
                (b.id ?? 0) - (a.id ?? 0),
        );
    const latest = events[0];
    if (
        !latest ||
        (latest.metadata?.[NAMESPACE] as Record<string, unknown>).action ===
            "release"
    )
        return { holderId: null, holderName: null };
    return { holderId: latest.user_id, holderName: latest.user };
}

export async function ensureKeyChannel(account: Account) {
    return (
        account.channels?.find(
            (channel) => channel.name === KEY_CHANNEL_NAME,
        ) ?? createOrEnterChannel(KEY_CHANNEL_NAME)
    );
}

export async function readKeyState(channelId: number) {
    return keyStateFromMessages(await getMessages(channelId));
}

export async function toggleKeyState(
    channelId: number,
    account: Account,
    expected: KeyState,
) {
    const current = await readKeyState(channelId);
    if (
        current.holderId !== expected.holderId ||
        (current.holderId !== null && current.holderId !== account.id)
    )
        return current;
    const action = current.holderId === null ? "claim" : "release";
    await sendMessage(
        channelId,
        action === "claim" ? "Clé récupérée" : "Clé remise",
        { type: "classroom_key", action },
    );
    return readKeyState(channelId);
}
