import { Injectable } from '@angular/core';

import { sanitizeNextUrl } from '../utils/post-auth-redirect.util';

export const POST_AUTH_REDIRECT_STORAGE_KEY = 'pych.postAuthRedirect';
export const POST_AUTH_REDIRECT_TTL_MS = 24 * 60 * 60 * 1_000;

interface StoredPostAuthRedirect {
    url: string;
    savedAt: number;
}

@Injectable({
    providedIn: 'root',
})
export class PostAuthRedirectService {
    save(rawNext: string | null | undefined): void {
        const url = sanitizeNextUrl(rawNext);

        try {
            if (!url) {
                sessionStorage.removeItem(POST_AUTH_REDIRECT_STORAGE_KEY);
                return;
            }

            const value: StoredPostAuthRedirect = {
                url,
                savedAt: Date.now(),
            };
            sessionStorage.setItem(POST_AUTH_REDIRECT_STORAGE_KEY, JSON.stringify(value));
        } catch {
            // Przekierowanie jest opcjonalne; zablokowany storage nie blokuje logowania.
        }
    }

    consume(): string | null {
        try {
            const raw = sessionStorage.getItem(POST_AUTH_REDIRECT_STORAGE_KEY);
            sessionStorage.removeItem(POST_AUTH_REDIRECT_STORAGE_KEY);

            if (!raw) {
                return null;
            }

            const stored = JSON.parse(raw) as Partial<StoredPostAuthRedirect>;
            if (
                typeof stored.savedAt !== 'number' ||
                Date.now() - stored.savedAt > POST_AUTH_REDIRECT_TTL_MS ||
                Date.now() < stored.savedAt
            ) {
                return null;
            }

            return sanitizeNextUrl(stored.url);
        } catch {
            return null;
        }
    }
}
