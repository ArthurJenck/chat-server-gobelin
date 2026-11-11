import type { Channel } from "../channels/types";

export type Account = {
    id: number;
    username: string;
    channels: Channel[] | null;
    metadata?: Record<string, unknown> | null;
};
