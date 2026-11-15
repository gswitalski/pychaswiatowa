import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { mapPostgrestErrorToApplicationError } from './postgrest-errors.ts';

Deno.test('mapPostgrestErrorToApplicationError: enum 22P02 → VALIDATION_ERROR', () => {
    const result = mapPostgrestErrorToApplicationError(
        {
            code: '22P02',
            message: 'invalid input value for enum recipe_cuisine: "ITALIAN"',
        },
        { fallbackMessage: 'Failed to create recipe' },
    );

    assertEquals(result.code, 'VALIDATION_ERROR');
    assertEquals(
        result.message,
        'Nieprawidłowa wartość klasyfikacji przepisu (kuchnia, dieta lub trudność).',
    );
});

Deno.test('mapPostgrestErrorToApplicationError: P0001 pozostaje komunikatem RPC', () => {
    const result = mapPostgrestErrorToApplicationError(
        {
            code: 'P0001',
            message: 'Ingredients must contain at least one item',
        },
        { fallbackMessage: 'Failed to create recipe' },
    );

    assertEquals(result.code, 'VALIDATION_ERROR');
    assertEquals(result.message, 'Ingredients must contain at least one item');
});