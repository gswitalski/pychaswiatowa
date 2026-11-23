/**
 * Buduje nazwę przepisu zgodną z kontraktem PS-112.
 * Nazwa wariantu jest prezentowana wyłącznie dla rodzin zawierających
 * co najmniej dwa aktywne warianty.
 */
export function formatRecipeVariantLabel(
    recipeName: string,
    variantName: string | null | undefined,
    activeVariantCount: number | null | undefined
): string {
    if ((activeVariantCount ?? 1) < 2 || !variantName?.trim()) {
        return recipeName;
    }

    return `${recipeName} · ${variantName.trim()}`;
}
