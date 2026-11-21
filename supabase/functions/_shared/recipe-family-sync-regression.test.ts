import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';

/** Lustrzane odwzorowanie logiki recipe_family_sync_recipes (AFTER UPDATE recipe_families). */
function applyRecipeFamilySyncRecipes(
    family: { name: string; visibility: string; deleted_at: string | null },
    variants: Array<{ id: number; name: string; visibility: string; deleted_at: string | null }>,
): typeof variants {
    const next = variants.map((variant) => ({ ...variant }));
    for (const variant of next) {
        if (variant.deleted_at === null) {
            variant.name = family.name;
            variant.visibility = family.visibility;
        }
        if (family.deleted_at !== null && variant.deleted_at === null) {
            variant.deleted_at = family.deleted_at;
        }
    }
    return next;
}

Deno.test('regresja recipe_family_sync_recipes: zapis przepisu nie przywraca usuniętego wariantu', () => {
    const familyDeletedAt = '2026-02-01T12:00:00.000Z';
    const variantDeletedAt = '2026-01-15T10:00:00.000Z';
    let variants = [
        { id: 1, name: 'Stara nazwa', visibility: 'PRIVATE', deleted_at: null },
        { id: 2, name: 'Stara nazwa', visibility: 'PRIVATE', deleted_at: variantDeletedAt },
    ];

    variants = applyRecipeFamilySyncRecipes(
        { name: 'Nowa nazwa', visibility: 'PUBLIC', deleted_at: null },
        variants,
    );

    const active = variants.find((variant) => variant.id === 1)!;
    const deleted = variants.find((variant) => variant.id === 2)!;
    assertEquals(active.name, 'Nowa nazwa');
    assertEquals(active.visibility, 'PUBLIC');
    assertEquals(active.deleted_at, null);
    assertEquals(deleted.deleted_at, variantDeletedAt);
    assertEquals(deleted.name, 'Stara nazwa');
});

Deno.test('regresja recipe_family_sync_recipes: soft_delete rodziny usuwa aktywne warianty', () => {
    const familyDeletedAt = '2026-02-01T12:00:00.000Z';
    const variantDeletedAt = '2026-01-15T10:00:00.000Z';
    let variants = [
        { id: 1, name: 'Nazwa', visibility: 'PRIVATE', deleted_at: null },
        { id: 2, name: 'Nazwa', visibility: 'PRIVATE', deleted_at: variantDeletedAt },
    ];

    variants = applyRecipeFamilySyncRecipes(
        { name: 'Nazwa', visibility: 'PRIVATE', deleted_at: familyDeletedAt },
        variants,
    );

    assertEquals(variants.find((variant) => variant.id === 1)!.deleted_at, familyDeletedAt);
    assertEquals(variants.find((variant) => variant.id === 2)!.deleted_at, variantDeletedAt);
});