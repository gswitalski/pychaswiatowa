import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import { ApplicationError } from '../_shared/errors.ts';
import {
    handlePostWebhook,
    paymentsWebhookRouter,
} from './payments-webhook.handlers.ts';

Deno.test('payments webhook handler: odrzuca metodę inną niż POST', async () => {
    const error = await assertRejects(
        () => paymentsWebhookRouter(new Request('http://localhost/payments-webhook', {
            method: 'GET',
        })),
        ApplicationError,
    );

    assertEquals(error.code, 'METHOD_NOT_ALLOWED');
});

Deno.test('payments webhook handler: odrzuca brak podpisu', async () => {
    const error = await assertRejects(
        () => handlePostWebhook(new Request('http://localhost/payments-webhook', {
            method: 'POST',
            body: '{}',
        })),
        ApplicationError,
    );

    assertEquals(error.code, 'INVALID_SIGNATURE');
});

Deno.test('payments webhook handler: odrzuca deklarowany zbyt duży payload', async () => {
    const error = await assertRejects(
        () => handlePostWebhook(new Request('http://localhost/payments-webhook', {
            method: 'POST',
            headers: { 'Content-Length': String(512 * 1024 + 1) },
            body: '{}',
        })),
        ApplicationError,
    );

    assertEquals(error.code, 'PAYLOAD_TOO_LARGE');
});
