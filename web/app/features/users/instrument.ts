import { metadataForProject } from "../../shared/projectMetadata";
import { INSTRUMENTS, type Instrument } from "../sound/soundConfig";
import { editUserMetadata } from "./api";
import type { Account } from "./types";

export function isInstrument(value: unknown): value is Instrument {
    return typeof value === "string" && Object.hasOwn(INSTRUMENTS, value);
}

export function accountInstrument(account: Account): Instrument | null {
    const value = metadataForProject(account.metadata).instrument;
    return isInstrument(value) ? value : null;
}

export function saveInstrument(account: Account, instrument: Instrument) {
    return editUserMetadata({
        ...metadataForProject(account.metadata),
        instrument,
    });
}
