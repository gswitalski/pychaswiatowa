import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { mapLinesToAiRecipeImageContentItems } from './recipe-form-page.component';

describe('mapLinesToAiRecipeImageContentItems', () => {
    it('powinien mapować wiersze nagłówków i elementów na content items', () => {
        const result = mapLinesToAiRecipeImageContentItems([
            '# Sekcja',
            '  #  Druga sekcja  ',
            ' jajka ',
            'mleko',
        ]);

        expect(result).toEqual([
            { type: 'header', content: 'Sekcja' },
            { type: 'header', content: 'Druga sekcja' },
            { type: 'item', content: 'jajka' },
            { type: 'item', content: 'mleko' },
        ]);
    });
});
