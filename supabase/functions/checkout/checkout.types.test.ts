import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { CreateCheckoutSessionSchema } from './checkout.types.ts';

const validCommand = {
    plan_id: 'premium_yearly',
    payment_method: 'card',
    accepted_terms: true,
    accepted_digital_content_waiver: true,
} as const;

Deno.test('checkout schema: akceptuje poprawne żądanie i usuwa nieznane pola', () => {
    const result = CreateCheckoutSessionSchema.parse({
        ...validCommand,
        success_url: 'https://attacker.example',
    });

    assertEquals(result, validCommand);
});

for (const invalidCommand of [
    { ...validCommand, plan_id: 'premium_weekly' },
    { ...validCommand, payment_method: 'transfer' },
    { ...validCommand, accepted_terms: false },
    { ...validCommand, accepted_digital_content_waiver: false },
]) {
    Deno.test(`checkout schema: odrzuca ${JSON.stringify(invalidCommand)}`, () => {
        assertEquals(CreateCheckoutSessionSchema.safeParse(invalidCommand).success, false);
    });
}
