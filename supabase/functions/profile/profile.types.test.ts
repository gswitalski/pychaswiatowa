import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import {
    changePasswordSchema,
    updateProfileSettingsSchema,
    usernameAvailabilityQuerySchema,
} from './profile.types.ts';

Deno.test('updateProfileSettingsSchema: poprawny payload przechodzi walidację', () => {
    const result = updateProfileSettingsSchema.safeParse({
        username: 'ania-k',
        marketing_consent: true,
        marketing_consent_text_version: 'marketing-consent-pl-v1',
    });

    assertEquals(result.success, true);
});

Deno.test('updateProfileSettingsSchema: za krótki username zwraca błąd', () => {
    const result = updateProfileSettingsSchema.safeParse({
        username: 'ab',
        marketing_consent: true,
        marketing_consent_text_version: 'marketing-consent-pl-v1',
    });

    assertEquals(result.success, false);
});

Deno.test('changePasswordSchema: poprawny payload przechodzi walidację', () => {
    const result = changePasswordSchema.safeParse({
        current_password: 'OldSecret123!',
        new_password: 'NewSecret123!',
    });

    assertEquals(result.success, true);
});

Deno.test('changePasswordSchema: identyczne hasła zwracają błąd', () => {
    const result = changePasswordSchema.safeParse({
        current_password: 'SameSecret123!',
        new_password: 'SameSecret123!',
    });

    assertEquals(result.success, false);
});

Deno.test('usernameAvailabilityQuerySchema: poprawny username przechodzi walidację', () => {
    const result = usernameAvailabilityQuerySchema.safeParse({
        username: 'ania-kowalska',
    });

    assertEquals(result.success, true);
});

Deno.test('usernameAvailabilityQuerySchema: username ze spacją zwraca błąd', () => {
    const result = usernameAvailabilityQuerySchema.safeParse({
        username: 'ania kowalska',
    });

    assertEquals(result.success, false);
});
