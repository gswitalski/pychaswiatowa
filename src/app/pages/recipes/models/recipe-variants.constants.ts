/** Nazwy techniczne pierwszego wariantu — wymagają zmiany przy ≥2 wariantach. */
export const TECHNICAL_VARIANT_NAMES = ['Wariant podstawowy', 'Podstawowa'] as const;

export const DEFAULT_VARIANT_NAME = 'Wariant podstawowy';

export function isTechnicalVariantName(name: string): boolean {
    const normalized = name.trim();
    return (TECHNICAL_VARIANT_NAMES as readonly string[]).includes(normalized);
}