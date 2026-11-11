import { metadataForProject } from "../../shared/projectMetadata";
import type { Message } from "../messages/types";
import { isInstrument } from "../users/instrument";

export function messageInstrument(message: Message) {
    const value = metadataForProject(message.metadata).instrument;
    return isInstrument(value) ? value : "piano";
}
