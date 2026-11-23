import { describe, expect, it } from 'vitest';
import { mapRecipeListItemToCardData } from './recipe-card.mapper';

describe('recipe card mapper', () => {
    const item = {
        id: 7,
        name: 'Lasagne',
        image_path: null,
        category_name: null,
        is_termorobot: false,
        is_grill: false,
        is_favorite: false,
        variant_name: 'Klasyczna',
        active_variant_count: 3,
        matching_variant_count: 2,
        matching_variant_names: ['Klasyczna', 'Wegetariańska'],
        matching_variant_overflow: 0,
    };

    it('mapuje opcjonalne metadane grupy addytywnie', () => {
        expect(mapRecipeListItemToCardData(item, null, true)).toMatchObject({
            id: 7,
            variantName: 'Klasyczna',
            activeVariantCount: 3,
            matchingVariantCount: 2,
            variantFilterActive: true,
        });
    });

    it('wyznacza liczbę zapisanych wariantów dla kolekcji', () => {
        expect(mapRecipeListItemToCardData(item, null, false, 2).savedVariantCount).toBe(2);
    });
});
