import { assertEquals } from 'jsr:@std/assert@1';
import { groupRecipeListCandidates } from '../_shared/recipe-list-grouping.ts';

Deno.test('public list groups visible variants before page slicing', () => {
    const groups = groupRecipeListCandidates([
        {
            id: 14, name: 'Lasagne', recipe_family_id: 'family-public', variant_name: 'Keto',
            is_default: false, sort_order: 3, created_at: '2026-01-04', matches: true,
        },
        {
            id: 11, name: 'Lasagne', recipe_family_id: 'family-public', variant_name: 'Klasyczna',
            is_default: true, sort_order: 0, created_at: '2026-01-01', matches: true,
        },
        {
            id: 12, name: 'Lasagne', recipe_family_id: 'family-public', variant_name: 'Wegetariańska',
            is_default: false, sort_order: 1, created_at: '2026-01-02', matches: true,
        },
        {
            id: 13, name: 'Lasagne', recipe_family_id: 'family-public', variant_name: 'Bezglutenowa',
            is_default: false, sort_order: 2, created_at: '2026-01-03', matches: true,
        },
    ]);

    assertEquals(groups.length, 1);
    assertEquals(groups[0].representative.id, 11);
    assertEquals(groups[0].active_variant_count, 4);
    assertEquals(groups[0].matching_variant_names, ['Klasyczna', 'Wegetariańska', 'Bezglutenowa', 'Keto']);
    assertEquals(groups[0].matching_variant_overflow, 0);
});
