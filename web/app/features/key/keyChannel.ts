import { KEY_CHANNEL_NAME } from "../../shared/config";
import { createOrEnterChannel } from "../channels/channels";
import { getMessages, sendMessage } from "../messages/api";
import type { Account } from "../users/types";
import { keyStateFromMessages, type KeyState } from "./keyState";

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
