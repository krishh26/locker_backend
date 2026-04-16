/**
 * Resolves numeric user id from JWT-decoded `req.user`.
 * Some tokens nest `user_id` as `{ user_id: number }` (sometimes repeated), which breaks integer SQL parameters.
 */
function scalarUserId(raw: unknown): number | null {
    if (typeof raw === "number" && Number.isFinite(raw)) {
        return raw;
    }
    if (typeof raw === "string") {
        const n = parseInt(raw, 10);
        return Number.isNaN(n) ? null : n;
    }
    return null;
}

export function getAuthUserId(user: { user_id?: unknown } | undefined | null): number | null {
    if (user == null) return null;
    let raw: unknown = user.user_id;
    for (let depth = 0; depth < 6 && raw != null; depth++) {
        const n = scalarUserId(raw);
        if (n != null) return n;
        if (typeof raw === "object" && "user_id" in (raw as object)) {
            raw = (raw as { user_id: unknown }).user_id;
            continue;
        }
        break;
    }
    return null;
}
