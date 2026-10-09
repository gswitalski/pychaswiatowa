import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import { ApplicationError } from '../_shared/errors.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { deleteRecipe } from './recipes.service.ts';

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
