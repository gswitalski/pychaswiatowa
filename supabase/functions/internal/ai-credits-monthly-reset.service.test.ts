import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import { ApplicationError } from '../_shared/errors.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { runMonthlyAiCreditsReset } from './ai-credits-monthly-reset.service.ts';

function createResetClient(params: {
    data: number | null;
    error: { code: string; message: string } | null;
}): TypedSupabaseClient {
    return {
        rpc: () => Promise.resolve(params),
    } as unknown as TypedSupabaseClient;
}

Deno.test('runMonthlyAiCreditsReset: zwraca liczbę resetów i czas przetworzenia', async () => {
    const result = await runMonthlyAiCreditsReset({
        supabaseAdmin: createResetClient({ data: 12, error: null }),
    });

    assertEquals(result.reset_count, 12);
    assertEquals(Number.isNaN(Date.parse(result.processed_at)), false);
});

Deno.test('runMonthlyAiCreditsReset: akceptuje brak kont do resetu', async () => {
    const result = await runMonthlyAiCreditsReset({
        supabaseAdmin: createResetClient({ data: 0, error: null }),
    });

    assertEquals(result.reset_count, 0);
});

Deno.test('runMonthlyAiCreditsReset: błąd RPC mapuje na INTERNAL_ERROR', async () => {
    const error = await assertRejects(
        () => runMonthlyAiCreditsReset({
            supabaseAdmin: createResetClient({
                data: null,
                error: { code: 'XX000', message: 'database unavailable' },
            }),
        }),
        ApplicationError,
    );

    assertEquals(error.code, 'INTERNAL_ERROR');
});
