import { editUserMetadata, type Account, type Message } from "../api";
import { NAMESPACE } from "../config";
import { INSTRUMENTS, type Instrument } from "../sound/soundConfig";

export function isInstrument(value: unknown): value is Instrument {
    return typeof value === "string" && Object.hasOwn(INSTRUMENTS, value);
}

function metadataForProject(
    metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
    const value = metadata?.[NAMESPACE];
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}

export function accountInstrument(account: Account): Instrument | null {
    const value = metadataForProject(account.metadata).instrument;
    return isInstrument(value) ? value : null;
}

export function messageInstrument(message: Message): Instrument {
    const value = metadataForProject(message.metadata).instrument;
    return isInstrument(value) ? value : "piano";
}

export function saveInstrument(account: Account, instrument: Instrument) {
    return editUserMetadata({
        ...metadataForProject(account.metadata),
        instrument,
    });
}
