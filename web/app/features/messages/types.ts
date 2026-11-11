export type Message = {
    id?: number;
    content: string;
    user_id: number;
    user: string;
    creation_date: string;
    posted_at?: string;
    metadata?: Record<string, unknown> | null;
};
