import { describe, expect, it } from 'vitest';
import { buildAuthorDisplayId } from './admin-recipes.models';

describe('admin-recipes.models', () => {
    it('skraca identyfikator autora zgodnie ze wzorcem listy użytkowników', () => {
        expect(buildAuthorDisplayId('')).toBe('');
        expect(buildAuthorDisplayId('123456789012')).toBe('123456789012');
        expect(buildAuthorDisplayId('1234567890123')).toBe('12345678...0123');
        expect(buildAuthorDisplayId('1a2b3c4d-aaaa-bbbb-cccc-1234567890ab')).toBe(
            '1a2b3c4d...90ab'
        );
    });
});
