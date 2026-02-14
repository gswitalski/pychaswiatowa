import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { AiRecipeImageRequestSchema } from './ai.types.ts';

function createValidImageRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        recipe: {
            name: 'Sernik klasyczny',
            description: 'Kremowy sernik na spodzie z herbatników.',
            ingredients: [{ type: 'item', content: '500 g twarogu' }],
            steps: [{ type: 'item', content: 'Wymieszać składniki' }],
            tags: ['deser'],
        },
        output: {
            mime_type: 'image/webp',
            width: 1024,
            height: 1024,
        },
        mode: 'auto',
        output_format: 'pycha_recipe_image_v1',
        language: 'pl',
        ...overrides,
    };
}

Deno.test('AiRecipeImageRequestSchema: payload bez recipe.id przechodzi walidację', () => {
    const payload = createValidImageRequest();
    const result = AiRecipeImageRequestSchema.safeParse(payload);

    assertEquals(result.success, true);
});

Deno.test('AiRecipeImageRequestSchema: storage_path bez recipe.id zwraca błąd walidacji', () => {
    const payload = createValidImageRequest({
        reference_image: {
            source: 'storage_path',
            image_path: 'user-1/recipes/123/cover.webp',
        },
    });

    const result = AiRecipeImageRequestSchema.safeParse(payload);

    assertEquals(result.success, false);
    if (!result.success) {
        const hasExpectedMessage = result.error.errors.some(
            (error) => error.message.includes('storage_path') && error.message.includes('recipe.id'),
        );
        assertEquals(hasExpectedMessage, true);
    }
});

Deno.test('AiRecipeImageRequestSchema: mode=with_reference bez reference_image zwraca błąd', () => {
    const payload = createValidImageRequest({
        mode: 'with_reference',
    });

    const result = AiRecipeImageRequestSchema.safeParse(payload);

    assertEquals(result.success, false);
    if (!result.success) {
        const hasExpectedMessage = result.error.errors.some(
            (error) => error.message.includes('reference_image') && error.message.includes('with_reference'),
        );
        assertEquals(hasExpectedMessage, true);
    }
});

Deno.test('AiRecipeImageRequestSchema: prompt_hint powyżej limitu zwraca błąd', () => {
    const payload = createValidImageRequest({
        prompt_hint: 'x'.repeat(401),
    });

    const result = AiRecipeImageRequestSchema.safeParse(payload);

    assertEquals(result.success, false);
    if (!result.success) {
        const hasPromptHintError = result.error.errors.some(
            (error) => error.path.includes('prompt_hint'),
        );
        assertEquals(hasPromptHintError, true);
    }
});
