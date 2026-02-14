import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { checkAiImageRateLimit, checkAiImageRateLimitWithStorage } from './rate-limit.ts';

Deno.test('checkAiImageRateLimit: blokuje drugi request w krótkim oknie', () => {
    const userId = 'test-short-window-user';
    const nowMs = Date.now();

    const first = checkAiImageRateLimit({ userId, nowMs });
    const second = checkAiImageRateLimit({ userId, nowMs: nowMs + 5000 });

    assertEquals(first.allowed, true);
    assertEquals(second.allowed, false);
    assertEquals(second.violatedWindow, 'short');
});

Deno.test('checkAiImageRateLimit: pozwala po wygaśnięciu krótkiego okna', () => {
    const userId = 'test-short-window-reset-user';
    const nowMs = Date.now();

    const first = checkAiImageRateLimit({ userId, nowMs });
    const second = checkAiImageRateLimit({ userId, nowMs: nowMs + 31_000 });

    assertEquals(first.allowed, true);
    assertEquals(second.allowed, true);
});

Deno.test('checkAiImageRateLimitWithStorage: fallback działa bez klienta DB', async () => {
    const userId = 'test-storage-fallback-user';
    const nowMs = Date.now();

    const viaStorageFirst = await checkAiImageRateLimitWithStorage({ userId, nowMs });
    const viaStorageSecond = await checkAiImageRateLimitWithStorage({ userId, nowMs: nowMs + 1_000 });
    const directForAnotherUser = checkAiImageRateLimit({ userId: `${userId}-direct`, nowMs });

    assertEquals(viaStorageFirst.allowed, true);
    assertEquals(viaStorageSecond.allowed, false);
    assertEquals(viaStorageSecond.violatedWindow, 'short');
    assertEquals(directForAnotherUser.allowed, true);
});
