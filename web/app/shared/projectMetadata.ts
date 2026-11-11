import { NAMESPACE } from "./config";

export function metadataForProject(
    metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
    const value = metadata?.[NAMESPACE];
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
}
