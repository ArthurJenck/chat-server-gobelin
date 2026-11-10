import { createChannel, enterChannel, type Account } from "../api";
import { KEY_CHANNEL_NAME } from "../config";

export function visibleChannels(account: Account) {
    return (account.channels ?? []).filter(
        (channel) => channel.name !== KEY_CHANNEL_NAME,
    );
}

export async function createOrEnterChannel(name: string) {
    try {
        return await createChannel(name);
    } catch (cause) {
        try {
            return await enterChannel(name);
        } catch {
            throw cause;
        }
    }
}
