// deno-lint-ignore-file no-import-prefix

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import { ApplicationError } from '../_shared/errors.ts';
import {
    createRecipeVariant,
    createAiRecipeVariant,
    listRecipeVariants,
    reorderRecipeVariants,
} from './recipes.variants.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';

const USER_ID = '5fb3646f-8980-4afb-aeb1-8a4e5fa58212';

function mockClient(
    rpcResponse: { data: unknown; error: { code: string; message: string } | null },
    storageResponse?: { copyError?: { message: string } | null; removeError?: { message: string } | null },
) {
    const calls: Array<{ name: string; args: unknown }> = [];
    const updates: unknown[] = [];
    const client = {
        rpc: (name: string, args: unknown) => {
            calls.push({ name, args });
            return Promise.resolve(rpcResponse);
        },
        storage: {
            from: () => ({
                copy: () => Promise.resolve({ error: storageResponse?.copyError ?? null }),
                remove: () => Promise.resolve({ error: storageResponse?.removeError ?? null }),
            }),
        },
        from: () => ({
            update: (payload: unknown) => {
                updates.push(payload);
                return {
                    eq: () => ({
                        eq: () => Promise.resolve({ error: null }),
                    }),
                };
            },
        }),
    } as unknown as TypedSupabaseClient;
    return { client, calls, updates };
}

Deno.test('warianty: przekazują user_id z kontekstu JWT', async () => {
    const { client, calls } = mockClient({
        data: [{ recipe_id: 7, variant_name: 'Klasyczna', is_default: true, sort_order: 0, image_path: null }],
        error: null,
    });
    await listRecipeVariants(client, 7, USER_ID, false);
    assertEquals(calls[0].args, { p_recipe_id: 7, p_user_id: USER_ID, p_is_admin: false });
});

for (const [code, expected] of [
    ['P0003', 'FORBIDDEN'],
    ['P0002', 'NOT_FOUND'],
    ['P0009', 'CONFLICT'],
    ['23505', 'CONFLICT'],
    ['22023', 'VALIDATION_ERROR'],
] as const) {
    Deno.test(`warianty: mapują RPC ${code}`, async () => {
        const { client } = mockClient({ data: null, error: { code, message: 'domain error' } });
        const error = await assertRejects(
            () => reorderRecipeVariants(client, 7, USER_ID, [7], false),
            ApplicationError,
        );
        assertEquals(error.code, expected);
    });
}

Deno.test('warianty: kopiuje zdjęcie do ścieżki nowego wariantu', async () => {
    const { client, calls, updates } = mockClient({
        data: { recipe_id: 8, source_image_path: `${USER_ID}/7/cover_1.webp` },
        error: null,
    });
    const result = await createRecipeVariant(client, 7, USER_ID, 'Nowa', 7, false);
    assertEquals(result.image_warning, null);
    assertEquals(calls[0].args, {
        p_recipe_id: 7,
        p_user_id: USER_ID,
        p_variant_name: 'Nowa',
        p_source_recipe_id: 7,
        p_is_admin: false,
    });
    assertEquals(updates.length, 1);
});

Deno.test('warianty: błąd Storage nie wycofuje utworzonego wariantu', async () => {
    const { client } = mockClient(
        { data: { recipe_id: 8, source_image_path: `${USER_ID}/7/cover_1.webp` }, error: null },
        { copyError: { message: 'storage unavailable' } },
    );
    const result = await createRecipeVariant(client, 7, USER_ID, 'Nowa', 7, false);
    assertEquals(result.recipe_id, 8);
    assertEquals(result.image_warning !== null, true);
});

Deno.test('PS-118: zapis AI przekazuje dane formularza do RPC', async () => {
    const { client, calls } = mockClient({
        data: { recipe_id: 12 },
        error: null,
    });
    const recipeId = await createAiRecipeVariant(client, 7, USER_ID, {
        variantName: 'AI',
        familyName: 'Rodzina',
        visibility: 'PRIVATE',
        description: null,
        ingredientsRaw: 'mąka',
        stepsRaw: 'mieszaj',
        tags: ['szybkie'],
        tipsRaw: null,
        categoryId: null,
        servings: null,
        prepTimeMinutes: null,
        totalTimeMinutes: null,
        dietType: null,
        cuisine: null,
        difficulty: null,
        isTermorobot: false,
        isGrill: false,
    }, false);
    assertEquals(recipeId, 12);
    assertEquals(calls[0].name, 'create_recipe_variant_from_ai');
    assertEquals((calls[0].args as Record<string, unknown>).p_user_id, USER_ID);
    assertEquals((calls[0].args as Record<string, unknown>).p_tag_names, ['szybkie']);
});
