import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import { ApplicationError } from '../_shared/errors.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { updateUserAiCredits } from './admin-ai-credits.service.ts';

const TARGET_USER_ID = '5fb3646f-8980-4afb-aeb1-8a4e5fa58212';

function createAdminCreditsClient(params: {
    userExists?: boolean;
    updateError?: { code: string; message: string } | null;
}): TypedSupabaseClient {
    const userExists = params.userExists ?? true;

    return {
        auth: {
            admin: {
                getUserById: () => Promise.resolve({
                    data: { user: userExists ? { id: TARGET_USER_ID } : null },
                    error: userExists
                        ? null
                        : { status: 404, message: 'User not found' },
                }),
            },
        },
        from: () => ({
            upsert: () => ({
                select: () => ({
                    single: () => Promise.resolve({
                        data: {
                            user_id: TARGET_USER_ID,
                            draft_credits_total: 10,
                            draft_credits_used: 2,
                            image_credits_total: 4,
                            image_credits_used: 1,
                            limit_type: 'monthly',
                            next_reset_at: '2026-10-15T00:00:00.000Z',
                            updated_at: '2026-09-15T00:00:00.000Z',
                        },
                        error: params.updateError ?? null,
                    }),
                }),
            }),
        }),
    } as unknown as TypedSupabaseClient;
}

Deno.test('updateUserAiCredits: mapuje zaktualizowane saldo', async () => {
    const result = await updateUserAiCredits({
        targetUserId: TARGET_USER_ID,
        command: {
            draft_credits_total: 10,
            image_credits_total: 4,
            limit_type: 'monthly',
            next_reset_at: '2026-10-15T00:00:00.000Z',
        },
        supabaseAdmin: createAdminCreditsClient({}),
    });

    assertEquals(result.draft.remaining, 8);
    assertEquals(result.image.remaining, 3);
    assertEquals(result.limit_type, 'monthly');
});

Deno.test('updateUserAiCredits: brak użytkownika mapuje na NOT_FOUND', async () => {
    const error = await assertRejects(
        () => updateUserAiCredits({
            targetUserId: TARGET_USER_ID,
            command: { draft_credits_total: 10 },
            supabaseAdmin: createAdminCreditsClient({ userExists: false }),
        }),
        ApplicationError,
    );

    assertEquals(error.code, 'NOT_FOUND');
});

Deno.test('updateUserAiCredits: naruszenie constraint mapuje na VALIDATION_ERROR', async () => {
    const error = await assertRejects(
        () => updateUserAiCredits({
            targetUserId: TARGET_USER_ID,
            command: { draft_credits_used: 11 },
            supabaseAdmin: createAdminCreditsClient({
                updateError: {
                    code: '23514',
                    message: 'check constraint violation',
                },
            }),
        }),
        ApplicationError,
    );

    assertEquals(error.code, 'VALIDATION_ERROR');
});
