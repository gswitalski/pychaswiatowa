import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import {
    createVariantSchema,
    reorderSchema,
    setRecipeNoteSchema,
    getRequestedVariant,
    recipesRouter,
} from './recipes.handlers.ts';

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

Deno.test('recipesRouter: dłuższa ścieżka wariantów jest routowana przed /recipes/{id}', async () => {
    const response = await recipesRouter(new Request('http://localhost/recipes/123/variants'));
    assertEquals(response.status, 401);
});

Deno.test('warianty: walidują nazwę i kolejność', () => {
    assertEquals(createVariantSchema.safeParse({ variant_name: '  Nowa  ' }).success, true);
    assertEquals(createVariantSchema.safeParse({ variant_name: '' }).success, false);
    assertEquals(reorderSchema.safeParse({ recipe_ids: [1, 2, 2] }).success, true);
    assertEquals(reorderSchema.safeParse({ recipe_ids: ['1'] }).success, false);
});

Deno.test('PS-110 GWT 2–4: recipes przekazuje surowy variant z query stringa', () => {
    const request = new Request('http://localhost/recipes/10?variant=abc');
    assertEquals(getRequestedVariant(request), 'abc');
});
