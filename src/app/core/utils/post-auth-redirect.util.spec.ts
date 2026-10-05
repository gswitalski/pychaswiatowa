import { describe, expect, it } from 'vitest';

import { sanitizeNextUrl } from './post-auth-redirect.util';

describe('sanitizeNextUrl', () => {
    it.each([
        null,
        '',
        'checkout',
        '//evil.example/checkout',
        'https://evil.example/checkout',
        '/checkout\\evil',
        '/checkout/../admin',
        'javascript:alert(1)',
    ])('powinien odrzucić niebezpieczny URL: %s', (value) => {
        expect(sanitizeNextUrl(value)).toBeNull();
    });

    it('powinien dopuścić checkout bez parametrów', () => {
        expect(sanitizeNextUrl('/checkout')).toBe('/checkout');
    });

    it('powinien zachować dozwolony plan i metodę', () => {
        expect(sanitizeNextUrl('/checkout?plan=premium_monthly&method=blik')).toBe(
            '/checkout?plan=premium_monthly&method=blik',
        );
    });

    it('powinien usunąć nieznane i nieprawidłowe parametry', () => {
        expect(
            sanitizeNextUrl('/checkout?plan=enterprise&method=card&unknown=value'),
        ).toBe('/checkout?method=card');
    });
});
