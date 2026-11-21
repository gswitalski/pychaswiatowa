import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mapToRecipeDetailDto } from './recipes.service.ts';
import { mapToDto } from '../explore/explore.service.ts';

const rows = [{
    recipe_id: 10,
    variant_name: 'Klasyczna',
    is_default: true,
    sort_order: 0,
    image_path: null,
    chips: {
        diet_type: 'MEAT',
        is_termorobot: false,
        is_grill: false,
        difficulty: 'EASY',
        servings: 4,
    },
}];

const resolution = {
    enabled: true,
    summaries: rows,
    resolution: null,
};

const detailRow = {
    id: 10,
    user_id: 'owner',
    category_id: null,
    name: 'Przepis',
    description: null,
    image_path: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    deleted_at: null,
    category_name: null,
    visibility: 'PUBLIC',
    ingredients: [{ type: 'item', content: 'mąka' }],
    steps: [{ type: 'item', content: 'Wymieszaj' }],
    tips: [],
    tags: [],
    servings: 4,
    is_termorobot: false,
    prep_time_minutes: null,
    total_time_minutes: null,
    diet_type: 'MEAT',
    cuisine: null,
    difficulty: 'EASY',
    is_grill: false,
    normalized_ingredients_status: 'PENDING',
    normalized_ingredients_updated_at: null,
    ratings_count: 0,
    average_rating: null,
    variant_name: 'Klasyczna',
    active_variant_count: 1,
} as unknown as Parameters<typeof mapToDto>[0];

Deno.test('PS-110 GWT 12: recipes mapuje listę bez treści rodzeństwa', () => {
    const result = mapToRecipeDetailDto(
        detailRow,
        false,
        [],
        { id: 'owner', username: 'owner' },
        undefined,
        undefined,
        null,
        resolution,
    );

    assertEquals(result.variants, rows);
    assertEquals('ingredients' in (result.variants?.[0] ?? {}), false);
    assertEquals(result.variant_resolution, null);
});

Deno.test('PS-110 GWT 9: recipes i explore pomijają pola wariantów przy wyłączonej fladze', () => {
    const recipesResult = mapToRecipeDetailDto(
        detailRow,
        false,
        [],
        { id: 'owner', username: 'owner' },
        undefined,
        undefined,
        null,
        { enabled: false, summaries: [], resolution: null },
    );
    assertEquals('variants' in recipesResult, false);

    const exploreResult = mapToDto(
        detailRow,
        false,
        [],
        { id: 'owner', username: 'owner' },
        undefined,
        undefined,
        false,
        null,
        { enabled: false, summaries: [], resolution: null },
    );
    assertEquals('variants' in exploreResult, false);
});
