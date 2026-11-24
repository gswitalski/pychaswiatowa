import { assertEquals } from 'jsr:@std/assert@1';
import {
    getRecipeVariantSearchText,
    groupRecipeListCandidates,
    isTechnicalVariantName,
    type RecipeListCandidate,
} from './recipe-list-grouping.ts';

const candidate = (overrides: Partial<RecipeListCandidate>): RecipeListCandidate => ({
    id: 1,
    name: 'Lasagne',
    recipe_family_id: 'family-a',
    variant_name: 'Klasyczna',
    is_default: false,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00Z',
    matches: true,
    ...overrides,
});

Deno.test('groups variants before pagination and chooses default on a tie', () => {
    const result = groupRecipeListCandidates([
        candidate({ id: 2, variant_name: 'Wegetariańska', sort_order: 2 }),
        candidate({ id: 1, variant_name: 'Klasyczna', is_default: true, sort_order: 0 }),
        candidate({ id: 3, variant_name: 'Bezglutenowa', sort_order: 3, matches: false }),
    ]);

    assertEquals(result.length, 1);
    assertEquals(result[0].representative.id, 1);
    assertEquals(result[0].active_variant_count, 3);
    assertEquals(result[0].matching_variant_count, 2);
});

Deno.test('chooses the best matching variant and returns all names in family order', () => {
    const result = groupRecipeListCandidates([
        candidate({ id: 4, variant_name: 'Keto', sort_order: 3, relevance_score: 3 }),
        candidate({ id: 2, variant_name: 'Wegetariańska', sort_order: 1, relevance_score: 5 }),
        candidate({ id: 1, variant_name: 'Klasyczna', is_default: true, sort_order: 0, relevance_score: 2 }),
        candidate({ id: 3, variant_name: 'Bezglutenowa', sort_order: 2, relevance_score: 4 }),
    ]);

    assertEquals(result[0].representative.id, 2);
    assertEquals(result[0].matching_variant_names, ['Klasyczna', 'Wegetariańska', 'Bezglutenowa', 'Keto']);
    assertEquals(result[0].matching_variant_overflow, 0);
});

Deno.test('trims names, skips empty names, and keeps technical names', () => {
    const result = groupRecipeListCandidates([
        candidate({ id: 3, variant_name: ' Wariant podstawowy ', sort_order: 2 }),
        candidate({ id: 2, variant_name: '   ', sort_order: 1 }),
        candidate({ id: 1, variant_name: ' Klasyczna ', sort_order: 0 }),
    ]);

    assertEquals(result[0].matching_variant_names, ['Klasyczna', 'Wariant podstawowy']);
    assertEquals(result[0].matching_variant_overflow, 0);
});

Deno.test('excludes technical names from variant matching text', () => {
    assertEquals(isTechnicalVariantName(' Wariant podstawowy '), true);
    assertEquals(isTechnicalVariantName('Podstawowa'), true);
    assertEquals(getRecipeVariantSearchText(candidate({ variant_name: 'Wariant podstawowy' })), 'Lasagne');
    assertEquals(getRecipeVariantSearchText(candidate({ variant_name: 'Wegańska' })), 'Lasagne Wegańska');
});

Deno.test('does not return groups without a matching visible candidate', () => {
    assertEquals(groupRecipeListCandidates([candidate({ matches: false })]), []);
});
