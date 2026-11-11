import { apiFetch } from "../../shared/http/client";
import type { Account } from "./types";

export async function getAccount(): Promise<Account> {
    const response = await apiFetch("/me");
    return response.json() as Promise<Account>;
}

export async function editUserMetadata(
    metadata: Record<string, unknown>,
): Promise<void> {
    await apiFetch("/user/edit", {
        method: "POST",
        body: JSON.stringify({ metadata }),
    });
}
