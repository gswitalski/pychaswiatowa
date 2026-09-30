import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import {
    ApplicationError,
    createErrorResponse,
    RateLimitedError,
} from './errors.ts';

const expectedStatuses = [
    ['FORBIDDEN_ROLE', 403],
    ['SUBSCRIPTION_ALREADY_ACTIVE', 409],
    ['RATE_LIMITED', 429],
    ['PAYMENT_PROVIDER_ERROR', 502],
    ['INVALID_SIGNATURE', 400],
] as const;

for (const [code, expectedStatus] of expectedStatuses) {
    Deno.test(`ApplicationError: ${code} maps to ${expectedStatus}`, () => {
        const error = new ApplicationError(code, 'Test error');

        assertEquals(error.statusCode, expectedStatus);
    });
}

Deno.test('createErrorResponse: adds Retry-After for RateLimitedError', () => {
    const response = createErrorResponse(new RateLimitedError(12.2));

    assertEquals(response.status, 429);
    assertEquals(response.headers.get('Retry-After'), '13');
});

Deno.test('createErrorResponse: omits Retry-After for other errors', () => {
    const response = createErrorResponse(
        new ApplicationError('PAYMENT_PROVIDER_ERROR', 'Provider unavailable'),
    );

    assertEquals(response.headers.get('Retry-After'), null);
});
