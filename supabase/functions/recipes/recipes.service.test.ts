import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import { ApplicationError } from '../_shared/errors.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { deleteRecipe, setRecipeFlags } from './recipes.service.ts';

const USER_ID = '5fb3646f-8980-4afb-aeb1-8a4e5fa58212';

function createDeleteRecipeClient(params: {
    wasDeleted: boolean | null;
    error?: { code: string; message: string } | null;
    onRpc?: (functionName: string, args: unknown) => void;
}): TypedSupabaseClient {
    return {
        rpc: (functionName: string, args: unknown) => {
            params.onRpc?.(functionName, args);
            return Promise.resolve({
                data: params.wasDeleted,
                error: params.error ?? null,
            });
        },
    } as unknown as TypedSupabaseClient;
}

Deno.test('deleteRecipe: wykonuje soft-delete przez bezpieczne RPC', async () => {
    let calledFunction: string | undefined;
    let calledArgs: unknown;

    await deleteRecipe(
        createDeleteRecipeClient({
            wasDeleted: true,
            onRpc: (functionName, args) => {
                calledFunction = functionName;
                calledArgs = args;
            },
        }),
        348,
        USER_ID
    );

    assertEquals(calledFunction, 'soft_delete_recipe');
    assertEquals(calledArgs, { p_recipe_id: 348 });
});

Deno.test('deleteRecipe: zwraca NOT_FOUND, gdy żaden rekord nie został zmieniony', async () => {
    const error = await assertRejects(
        () => deleteRecipe(
            createDeleteRecipeClient({ wasDeleted: false }),
            348,
            USER_ID
        ),
        ApplicationError
    );

    assertEquals(error.code, 'NOT_FOUND');
});

Deno.test('deleteRecipe: mapuje błąd bazy na INTERNAL_ERROR', async () => {
    const error = await assertRejects(
        () => deleteRecipe(
            createDeleteRecipeClient({
                wasDeleted: null,
                error: {
                    code: '42501',
                    message: 'new row violates row-level security policy',
                },
            }),
            348,
            USER_ID
        ),
        ApplicationError
    );

    assertEquals(error.code, 'INTERNAL_ERROR');
});

Deno.test('setRecipeFlags: przekazuje częściowe flagi i mapuje pełny stan', async () => {
    let calledFunction: string | undefined;
    let calledArgs: unknown;

    const client = {
        rpc: (functionName: string, args: unknown) => {
            calledFunction = functionName;
            calledArgs = args;
            return Promise.resolve({
                data: [{
                    out_recipe_id: 348,
                    out_is_favorite: true,
                    out_is_want_to_try: false,
                }],
                error: null,
            });
        },
    } as unknown as TypedSupabaseClient;

    const result = await setRecipeFlags(client, {
        recipeId: 348,
        isFavorite: true,
    });

    assertEquals(calledFunction, 'set_recipe_flags');
    assertEquals(calledArgs, {
        p_recipe_id: 348,
        p_is_favorite: true,
        p_is_want_to_try: undefined,
    });
    assertEquals(result, {
        recipe_id: 348,
        is_favorite: true,
        is_want_to_try: false,
    });
});

Deno.test('setRecipeFlags: mapuje kody błędów RPC', async () => {
    const error = await assertRejects(
        () => setRecipeFlags({
            rpc: () => Promise.resolve({
                data: null,
                error: { code: 'P0002', message: 'Recipe not found' },
            }),
        } as unknown as TypedSupabaseClient, {
            recipeId: 348,
            isFavorite: false,
        }),
        ApplicationError
    );

    assertEquals(error.code, 'NOT_FOUND');
});
