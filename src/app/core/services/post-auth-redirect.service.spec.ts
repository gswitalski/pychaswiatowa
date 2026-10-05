import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    POST_AUTH_REDIRECT_STORAGE_KEY,
    POST_AUTH_REDIRECT_TTL_MS,
    PostAuthRedirectService,
} from './post-auth-redirect.service';

describe('PostAuthRedirectService', () => {
    let service: PostAuthRedirectService;

    beforeEach(() => {
        service = new PostAuthRedirectService();
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('powinien zapisać i jednokrotnie zwrócić bezpieczny URL', () => {
        service.save('/checkout?plan=premium_yearly&method=card');

        expect(service.consume()).toBe('/checkout?plan=premium_yearly&method=card');
        expect(service.consume()).toBeNull();
    });

    it('powinien odrzucić wygasły wpis', () => {
        sessionStorage.setItem(
            POST_AUTH_REDIRECT_STORAGE_KEY,
            JSON.stringify({
                url: '/checkout',
                savedAt: Date.now() - POST_AUTH_REDIRECT_TTL_MS - 1,
            }),
        );

        expect(service.consume()).toBeNull();
    });

    it('powinien bezpiecznie obsłużyć zablokowany sessionStorage', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Storage blocked');
        });

        expect(() => service.save('/checkout')).not.toThrow();
    });
});
