import { assertEquals } from 'jsr:@std/assert@1';
import {
    getRecipeVariantSearchText,
    groupRecipeListCandidates,
} from '../_shared/recipe-list-grouping.ts';

Deno.test('global search excludes technical variant names', () => {
    const technicalText = getRecipeVariantSearchText({
        name: 'Lasagne',
        variant_name: 'Wariant podstawowy',
    });
    const technicalMatch = technicalText.toLocaleLowerCase().includes('wariant');
    const variantText = getRecipeVariantSearchText({
        name: 'Lasagne',
        variant_name: 'Wegetariańska',
    });
    const grouped = groupRecipeListCandidates([{
        id: 31, name: 'Lasagne', recipe_family_id: 'family-search', variant_name: 'Wegetariańska',
        is_default: false, sort_order: 1, created_at: '2026-01-01', matches: variantText.includes('Wegetariańska'),
    }]);

    assertEquals(technicalMatch, false);
    assertEquals(grouped.length, 1);
    assertEquals(grouped[0].representative.variant_name, 'Wegetariańska');
});
