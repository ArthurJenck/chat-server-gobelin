import { NAMESPACE, PARIS_TIME_ZONE } from "../../shared/config";
import type { Message } from "../messages/types";

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
                Date.parse(a.posted_at ?? a.creation_date) -
                    Date.parse(b.posted_at ?? b.creation_date) ||
                (a.id ?? 0) - (b.id ?? 0),
        );
    let state: KeyState = { holderId: null, holderName: null };
    for (const message of events) {
        const action = (message.metadata?.[NAMESPACE] as Record<string, unknown>).action;
        if (action === "claim" && state.holderId === null)
            state = { holderId: message.user_id, holderName: message.user };
        else if (action === "release" && state.holderId === message.user_id)
            state = { holderId: null, holderName: null };
    }
    return state;
}
