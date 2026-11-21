import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ApplicationError } from './errors.ts';
import type { TypedSupabaseClient } from './supabase-client.ts';
import {
    resolveRecipeVariantDetail,
    type RecipeVariantSummaryDto,
} from './recipe-variant-detail.ts';

const OWNER = 'owner';
const OTHER = 'other';

interface MockRecipe {
    id: number;
    user_id: string;
    visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
    deleted_at: string | null;
    recipe_family_id: string;
    variant_name: string;
    is_default: boolean;
    sort_order: number;
    image_path: string | null;
    diet_type: string | null;
    is_termorobot: boolean;
    is_grill: boolean;
    difficulty: string | null;
    servings: number | null;
}

const FAMILY: MockRecipe[] = [
    {
        id: 10, user_id: OWNER, visibility: 'PUBLIC', deleted_at: null,
        recipe_family_id: 'family-a', variant_name: 'Klasyczna', is_default: true,
        sort_order: 0, image_path: null, diet_type: 'MEAT', is_termorobot: false,
        is_grill: false, difficulty: 'EASY', servings: 4,
    },
    {
        id: 11, user_id: OWNER, visibility: 'PUBLIC', deleted_at: null,
        recipe_family_id: 'family-a', variant_name: 'Wegetariańska', is_default: false,
        sort_order: 1, image_path: null, diet_type: 'VEGETARIAN', is_termorobot: false,
        is_grill: false, difficulty: 'EASY', servings: 4,
    },
    {
        id: 12, user_id: OWNER, visibility: 'PRIVATE', deleted_at: null,
        recipe_family_id: 'family-a', variant_name: 'Prywatna', is_default: false,
        sort_order: 2, image_path: null, diet_type: 'VEGAN', is_termorobot: false,
        is_grill: false, difficulty: 'HARD', servings: 2,
    },
    {
        id: 14, user_id: OWNER, visibility: 'SHARED', deleted_at: null,
        recipe_family_id: 'family-a', variant_name: 'Współdzielona', is_default: false,
        sort_order: 4, image_path: null, diet_type: 'MEAT', is_termorobot: false,
        is_grill: false, difficulty: 'EASY', servings: 4,
    },
    {
        id: 13, user_id: OWNER, visibility: 'PRIVATE', deleted_at: '2026-01-01',
        recipe_family_id: 'family-a', variant_name: 'Usunięta', is_default: false,
        sort_order: 3, image_path: null, diet_type: 'MEAT', is_termorobot: false,
        is_grill: false, difficulty: 'EASY', servings: 4,
    },
];

function createMockClient(mode: 'all' | 'admin' | 'disabled' = 'all'): TypedSupabaseClient {
    const from = (table: string) => {
        const filters = new Map<string, unknown>();
        const builder = {
            select: () => builder,
            eq: (key: string, value: unknown) => {
                filters.set(key, value);
                return builder;
            },
            is: (key: string, value: unknown) => {
                filters.set(`is:${key}`, value);
                return builder;
            },
            not: (key: string, operator: string, value: unknown) => {
                filters.set(`not:${key}`, { operator, value });
                return builder;
            },
            order: () => builder,
            maybeSingle: async () => {
                if (table === 'feature_flags') return { data: { mode }, error: null };
                const id = filters.get('id');
                if (id !== undefined) {
                    const row = FAMILY.find((recipe) => recipe.id === id) ?? null;
                    return { data: row, error: null };
                }
                const familyId = filters.get('recipe_family_id');
                const rows = FAMILY.filter((recipe) => recipe.recipe_family_id === familyId);
                const deletedLookup = filters.has('not:deleted_at')
                    ? rows.find((recipe) => recipe.deleted_at !== null) ?? null
                    : null;
                return { data: deletedLookup, error: null };
            },
            then: (resolve: (value: unknown) => unknown) => {
                const familyId = filters.get('recipe_family_id');
                const rows = FAMILY.filter((recipe) =>
                    recipe.recipe_family_id === familyId && recipe.deleted_at === null
                );
                return Promise.resolve(resolve({ data: rows, error: null }));
            },
        };
        // The resolver awaits only terminal methods; `from` is intentionally minimal.
        return builder;
    };

    return { from } as unknown as TypedSupabaseClient;
}

function resolve(params: {
    recipeId: number;
    requesterUserId: string | null;
    rawVariantId?: string;
    endpoint?: 'recipes' | 'explore';
    mode?: 'all' | 'admin' | 'disabled';
}) {
    return resolveRecipeVariantDetail({
        client: createMockClient(params.mode ?? 'all'),
        recipeId: params.recipeId,
        requesterUserId: params.requesterUserId,
        rawVariantId: params.rawVariantId,
        endpoint: params.endpoint ?? 'explore',
        isAdmin: false,
    });
}

Deno.test('PS-110 GWT 1–2: wybiera aktywny A/B i wariant równy anchorowi', async () => {
    const selectedB = await resolve({ recipeId: 10, requesterUserId: OWNER, rawVariantId: '11' });
    assertEquals(selectedB.selectedId, 11);
    assertEquals(selectedB.resolution, null);
    assertEquals(selectedB.summaries.map((item) => item.recipe_id), [10, 11, 12, 14]);

    const selectedA = await resolve({ recipeId: 10, requesterUserId: OWNER, rawVariantId: '10' });
    assertEquals(selectedA.selectedId, 10);
    assertEquals(selectedA.resolution, null);
});

Deno.test('PS-110 GWT 3–5: niepoprawny, obcy i usunięty variant uruchamiają ratunek', async () => {
    const invalid = await resolve({ recipeId: 10, requesterUserId: OWNER, rawVariantId: 'abc' });
    assertEquals(invalid.selectedId, 10);
    assertEquals(invalid.resolution?.reason, 'INVALID_PARAMETER');

    const foreign = await resolve({ recipeId: 10, requesterUserId: OWNER, rawVariantId: '999' });
    assertEquals(foreign.resolution?.reason, 'INVALID_PARAMETER');

    const deleted = await resolve({ recipeId: 10, requesterUserId: OWNER, rawVariantId: '13' });
    assertEquals(deleted.selectedId, 10);
    assertEquals(deleted.resolution?.reason, 'VARIANT_DELETED');

    const deletedAnchor = await resolve({ recipeId: 13, requesterUserId: OWNER });
    assertEquals(deletedAnchor.selectedId, 10);
    assertEquals(deletedAnchor.resolution?.reason, 'VARIANT_DELETED');

    await assertRejects(
        () => resolve({ recipeId: 13, requesterUserId: OTHER }),
        ApplicationError,
        'Recipe not found',
    );
});

Deno.test('PS-110 GWT 8: filtruje rodzeństwo według właściciela i widoczności', async () => {
    const owner = await resolve({ recipeId: 10, requesterUserId: OWNER });
    assertEquals(owner.summaries.map((item) => item.recipe_id), [10, 11, 12, 14]);

    const publicVisitor = await resolve({ recipeId: 10, requesterUserId: OTHER });
    assertEquals(publicVisitor.summaries.map((item) => item.recipe_id), [10, 11]);

    const guest = await resolve({ recipeId: 10, requesterUserId: null });
    assertEquals(guest.summaries.map((item) => item.recipe_id), [10, 11]);

    await assertRejects(
        () => resolve({ recipeId: 12, requesterUserId: OTHER, endpoint: 'recipes' }),
        ApplicationError,
        'Recipe not found',
    );
});

Deno.test('PS-110 GWT 9 i 21: wyłączona flaga ignoruje variant i nie dodaje listy', async () => {
    const result = await resolve({
        recipeId: 10,
        requesterUserId: OWNER,
        rawVariantId: '11',
        mode: 'disabled',
    });
    assertEquals(result.enabled, false);
    assertEquals(result.selectedId, 10);
    assertEquals(result.summaries, []);
    assertEquals(result.resolution, null);
});

Deno.test('PS-110 GWT 10–11: mapowanie chipów pomija cechy identyczne', async () => {
    const result = await resolve({ recipeId: 10, requesterUserId: OWNER });
    const classic = result.summaries[0] as RecipeVariantSummaryDto;
    assertEquals(classic.chips.diet_type, 'MEAT');
    assertEquals(classic.chips.difficulty, 'EASY');
    assertEquals(classic.chips.is_termorobot, false);
    assertEquals(classic.chips.is_grill, false);
    assertEquals(classic.chips.servings, 4);
});
