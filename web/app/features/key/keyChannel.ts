import { KEY_CHANNEL_NAME } from "../../shared/config";
import { createOrEnterChannel } from "../channels/channels";
import { getMessages, sendMessage } from "../messages/api";
import type { Account } from "../users/types";

export async function ensureKeyChannel(account: Account) {
    return (
        account.channels?.find(
            (channel) => channel.name === KEY_CHANNEL_NAME,
        ) ?? createOrEnterChannel(KEY_CHANNEL_NAME)
    );
}

export function readKeyMessages(channelId: number) {
    return getMessages(channelId);
}

export function sendKeyAction(channelId: number, action: "claim" | "release") {
    return sendMessage(
        channelId,
        action === "claim" ? "Clé récupérée" : "Clé remise",
        { type: "classroom_key", action },
    );
}
