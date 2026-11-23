import { describe, expect, it } from 'vitest';
import { formatRecipeVariantLabel } from './recipe-variant-label';

describe('formatRecipeVariantLabel', () => {
    it('dodaje wariant dla rodziny z co najmniej dwoma wariantami', () => {
        expect(formatRecipeVariantLabel('Zupa', 'Wegańska', 2)).toBe('Zupa · Wegańska');
    });

    it('zachowuje starą nazwę dla jednego wariantu i brakujących pól', () => {
        expect(formatRecipeVariantLabel('Zupa', 'Klasyczna', 1)).toBe('Zupa');
        expect(formatRecipeVariantLabel('Zupa', null, 2)).toBe('Zupa');
        expect(formatRecipeVariantLabel('Zupa', '  ', 2)).toBe('Zupa');
    });
});
