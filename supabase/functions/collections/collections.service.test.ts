import { assertEquals } from 'jsr:@std/assert@1';
import { groupRecipeListCandidates } from '../_shared/recipe-list-grouping.ts';

Deno.test('collection grouping keeps the saved default as representative', () => {
    const groups = groupRecipeListCandidates([
        {
            id: 21, name: 'Zupa', recipe_family_id: 'family-collection', variant_name: 'B',
            is_default: false, sort_order: 2, created_at: '2026-01-02', matches: true,
        },
        {
            id: 22, name: 'Zupa', recipe_family_id: 'family-collection', variant_name: 'A',
            is_default: true, sort_order: 3, created_at: '2026-01-01', matches: true,
        },
        {
            id: 20, name: 'Zupa', recipe_family_id: 'family-collection', variant_name: 'C',
            is_default: false, sort_order: 1, created_at: '2026-01-03', matches: true,
        },
    ]);

    assertEquals(groups[0].representative.id, 22);
    assertEquals(groups[0].matching_variant_count, 3);
    assertEquals(groups[0].matching_variant_names, ['C', 'B', 'A']);
    assertEquals(groups[0].matching_variant_overflow, 0);
});
