import { assertEquals } from 'jsr:@std/assert@1';
import { groupRecipeListCandidates } from '../_shared/recipe-list-grouping.ts';

Deno.test('public list groups visible variants before page slicing', () => {
    const groups = groupRecipeListCandidates([
        {
            id: 11, name: 'Lasagne', recipe_family_id: 'family-public', variant_name: 'Klasyczna',
            is_default: true, sort_order: 0, created_at: '2026-01-01', matches: true,
        },
        {
            id: 12, name: 'Lasagne', recipe_family_id: 'family-public', variant_name: 'Wegetariańska',
            is_default: false, sort_order: 1, created_at: '2026-01-02', matches: true,
        },
    ]);

    assertEquals(groups.length, 1);
    assertEquals(groups[0].representative.id, 11);
    assertEquals(groups[0].active_variant_count, 2);
});
