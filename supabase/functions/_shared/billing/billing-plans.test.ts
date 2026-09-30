import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import { ApplicationError } from '../errors.ts';
import {
    addMonthsUtc,
    getPriceEnvName,
    getPriceId,
    resolvePlanFromPriceId,
} from './billing-plans.ts';

Deno.test('billing plans: mapuje plan i metodę na nazwę sekretu', () => {
    assertEquals(
        getPriceEnvName('premium_monthly', 'card'),
        'STRIPE_PRICE_PREMIUM_MONTHLY_RECURRING',
    );
    assertEquals(
        getPriceEnvName('premium_yearly', 'blik'),
        'STRIPE_PRICE_PREMIUM_YEARLY_ONETIME',
    );
});

Deno.test('billing plans: mapuje Price ID w obie strony', () => {
    const envName = 'STRIPE_PRICE_PREMIUM_YEARLY_RECURRING';
    const previous = Deno.env.get(envName);
    try {
        Deno.env.set(envName, 'price_yearly_card');
        assertEquals(getPriceId('premium_yearly', 'card'), 'price_yearly_card');
        assertEquals(resolvePlanFromPriceId('price_yearly_card'), {
            planId: 'premium_yearly',
            method: 'card',
        });
    } finally {
        if (previous === undefined) {
            Deno.env.delete(envName);
        } else {
            Deno.env.set(envName, previous);
        }
    }
});

Deno.test('billing plans: brak Price ID zwraca INTERNAL_ERROR', async () => {
    const envName = 'STRIPE_PRICE_PREMIUM_MONTHLY_ONETIME';
    const previous = Deno.env.get(envName);
    try {
        Deno.env.delete(envName);
        const error = await assertRejects(
            async () => getPriceId('premium_monthly', 'blik'),
            ApplicationError,
        );
        assertEquals(error.code, 'INTERNAL_ERROR');
    } finally {
        if (previous !== undefined) {
            Deno.env.set(envName, previous);
        }
    }
});

Deno.test('addMonthsUtc: ogranicza dzień na końcu miesiąca', () => {
    assertEquals(
        addMonthsUtc(new Date('2025-01-31T12:30:00.000Z'), 1).toISOString(),
        '2025-02-28T12:30:00.000Z',
    );
    assertEquals(
        addMonthsUtc(new Date('2024-02-29T12:30:00.000Z'), 12).toISOString(),
        '2025-02-28T12:30:00.000Z',
    );
});
