import { describe, expect, it } from 'vitest';
import {
    buildRatingSummary,
    buildReadonlyAriaLabel,
    formatAverageRating,
    pluralizeRatings,
} from './recipe-rating.utils';

describe('recipe rating utilities', () => {
    it('formatuje średnią niezależnie od locale aplikacji', () => {
        expect(formatAverageRating(4.3)).toBe('4,3');
        expect(formatAverageRating(5)).toBe('5,0');
    });

    it('odmienia słowo „ocena” po polsku', () => {
        expect(pluralizeRatings(1)).toBe('ocena');
        expect(pluralizeRatings(2)).toBe('oceny');
        expect(pluralizeRatings(5)).toBe('ocen');
        expect(pluralizeRatings(12)).toBe('ocen');
        expect(pluralizeRatings(14)).toBe('ocen');
        expect(pluralizeRatings(22)).toBe('oceny');
    });

    it('buduje podsumowanie bez fałszywej średniej dla zera ocen', () => {
        expect(buildRatingSummary(null, 0)).toBe('Brak ocen');
        expect(buildRatingSummary(4.3, 27)).toBe('★ 4,3 / 5 · 27 ocen');
        expect(buildRatingSummary(null, 27)).toBe('27 ocen');
    });

    it('buduje dostępny opis stanu tylko do odczytu', () => {
        expect(buildReadonlyAriaLabel(null, 0)).toBe('Brak ocen');
        expect(buildReadonlyAriaLabel(5, 1)).toBe(
            'Średnia ocena 5,0 na 5 na podstawie 1 ocena'
        );
    });
});
