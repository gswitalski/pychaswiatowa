import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { setRecipeNoteSchema, recipesRouter } from './recipes.handlers.ts';

Deno.test('setRecipeNoteSchema: akceptuje null i normalizuje puste notatki', () => {
    assertEquals(setRecipeNoteSchema.parse({ note: null }), { note: null });
    assertEquals(setRecipeNoteSchema.parse({ note: '  x  ' }), { note: 'x' });
    assertEquals(setRecipeNoteSchema.parse({ note: ' \n\t ' }), { note: null });
});

Deno.test('setRecipeNoteSchema: odrzuca NUL jako VALIDATION_ERROR wejścia', () => {
    const result = setRecipeNoteSchema.safeParse({ note: 'x\u0000y' });
    assertEquals(result.success, false);
});

for (const method of ['GET', 'POST', 'DELETE']) {
    Deno.test(`recipesRouter: ${method} note zwraca 405 i Allow PUT, OPTIONS`, async () => {
        const response = await recipesRouter(
            new Request('http://localhost/functions/v1/recipes/348/note', { method })
        );

        assertEquals(response.status, 405);
        assertEquals(response.headers.get('Allow'), 'PUT, OPTIONS');
    });
}

Deno.test('recipesRouter: OPTIONS zwraca preflight bez wywołania handlera', async () => {
    const response = await recipesRouter(
        new Request('http://localhost/functions/v1/recipes/348/note', { method: 'OPTIONS' })
    );

    assertEquals(response.status, 204);
});
