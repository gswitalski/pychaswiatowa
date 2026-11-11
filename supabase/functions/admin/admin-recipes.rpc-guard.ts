export interface LocalDbGuardResult {
    allowed: boolean;
    reason: string;
    origin?: string;
}

export function evaluateLocalDbGuard(
    url: string | undefined,
    serviceRoleKey: string | undefined,
): LocalDbGuardResult {
    if (!url || !serviceRoleKey) {
        return { allowed: false, reason: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required' };
    }
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { allowed: false, reason: 'Only HTTP(S) URLs are allowed' };
        }
        if (parsed.username || parsed.password) {
            return { allowed: false, reason: 'Credentials in URL are not allowed' };
        }
        if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
            return { allowed: false, reason: 'Only localhost and 127.0.0.1 are allowed' };
        }
        return { allowed: true, reason: 'Local database URL accepted', origin: parsed.origin };
    } catch {
        return { allowed: false, reason: 'Invalid SUPABASE_URL' };
    }
}
