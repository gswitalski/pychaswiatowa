import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import {
    evaluateCheckoutEligibility,
    type BillingStateSnapshot,
} from './billing-eligibility.ts';

const NOW = new Date('2026-09-30T20:00:00.000Z');

function state(
    overrides: Partial<BillingStateSnapshot>,
): BillingStateSnapshot {
    return {
        appRole: 'user',
        subscription: null,
        ...overrides,
    };
}

Deno.test('billing eligibility: admin jest zablokowany', () => {
    assertEquals(
        evaluateCheckoutEligibility(state({ appRole: 'admin' }), NOW),
        'forbidden_admin',
    );
});

Deno.test('billing eligibility: użytkownik Free może kupić', () => {
    assertEquals(evaluateCheckoutEligibility(state({}), NOW), 'allowed');
});

Deno.test('billing eligibility: Premium nadane ręcznie jest zablokowane', () => {
    assertEquals(
        evaluateCheckoutEligibility(state({ appRole: 'premium' }), NOW),
        'already_active',
    );
});

Deno.test('billing eligibility: zakup podczas trialu jest dozwolony', () => {
    assertEquals(evaluateCheckoutEligibility(state({
        appRole: 'premium',
        subscription: {
            status: 'trialing',
            current_period_end: '2026-10-01T20:00:00.000Z',
            auto_renew: false,
        },
    }), NOW), 'allowed');
});

Deno.test('billing eligibility: aktywny opłacony okres jest zablokowany', () => {
    assertEquals(evaluateCheckoutEligibility(state({
        appRole: 'premium',
        subscription: {
            status: 'active',
            current_period_end: '2026-10-01T20:00:00.000Z',
            auto_renew: true,
        },
    }), NOW), 'already_active');
});

Deno.test('billing eligibility: BLIK po końcu okresu jest dozwolony', () => {
    assertEquals(evaluateCheckoutEligibility(state({
        appRole: 'premium',
        subscription: {
            status: 'active',
            current_period_end: NOW.toISOString(),
            auto_renew: false,
        },
    }), NOW), 'allowed');
});

Deno.test('billing eligibility: karta po końcu okresu pozostaje zablokowana', () => {
    assertEquals(evaluateCheckoutEligibility(state({
        appRole: 'premium',
        subscription: {
            status: 'active',
            current_period_end: NOW.toISOString(),
            auto_renew: true,
        },
    }), NOW), 'already_active');
});

Deno.test('billing eligibility: wygasła subskrypcja jest dozwolona', () => {
    assertEquals(evaluateCheckoutEligibility(state({
        subscription: {
            status: 'expired',
            current_period_end: '2026-09-01T20:00:00.000Z',
            auto_renew: false,
        },
    }), NOW), 'allowed');
});
