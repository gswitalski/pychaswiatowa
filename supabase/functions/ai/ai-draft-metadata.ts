/**
 * Recipe draft metadata normalization.
 *
 * Values returned by the LLM are intentionally treated as untrusted. This
 * module converts them to the strict API contract without throwing errors.
 */

import { z } from 'npm:zod@3.22.4';

export const DIET_TYPES = ['MEAT', 'VEGETARIAN', 'VEGAN'] as const;
export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export const CUISINES = [
    'POLISH',
    'ASIAN',
    'MEXICAN',
    'MIDDLE_EASTERN',
    'AFRICAN',
    'AMERICAN',
    'BALKAN',
    'BRAZILIAN',
    'BRITISH',
    'CARIBBEAN',
    'CHINESE',
    'FRENCH',
    'GERMAN',
    'GREEK',
    'INDIAN',
    'ITALIAN',
    'JAPANESE',
    'KOREAN',
    'MEDITERRANEAN',
    'RUSSIAN',
    'SCANDINAVIAN',
    'SPANISH',
    'THAI',
    'TURKISH',
    'VIETNAMESE',
] as const;

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 99;
export const MIN_TIME_MINUTES = 0;
export const MAX_TIME_MINUTES = 999;

/** Metadata keys in the stable order used by incomplete-data warnings. */
export const DRAFT_METADATA_KEYS = [
    'servings',
    'prep_time_minutes',
    'total_time_minutes',
    'diet_type',
    'cuisine',
    'difficulty',
    'is_termorobot',
    'is_grill',
] as const;

export const AiRecipeDraftMetadataSchema = z.object({
    servings: z.number().int().min(MIN_SERVINGS).max(MAX_SERVINGS).nullable(),
    prep_time_minutes: z.number().int().min(MIN_TIME_MINUTES).max(MAX_TIME_MINUTES).nullable(),
    total_time_minutes: z.number().int().min(MIN_TIME_MINUTES).max(MAX_TIME_MINUTES).nullable(),
    diet_type: z.enum(DIET_TYPES).nullable(),
    cuisine: z.enum(CUISINES).nullable(),
    difficulty: z.enum(DIFFICULTIES).nullable(),
    is_termorobot: z.boolean(),
    is_grill: z.boolean(),
});

export type AiRecipeDraftMetadata = z.infer<typeof AiRecipeDraftMetadataSchema>;

export interface NormalizedDraftMetadataResult {
    metadata: AiRecipeDraftMetadata;
    warnings: string[];
}

function hasOwn(object: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function coerceInteger(value: unknown, min: number, max: number): number | null {
    let numericValue: number;

    if (typeof value === 'number') {
        numericValue = value;
    } else if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim())) {
        numericValue = Number(value.trim());
    } else {
        return null;
    }

    if (!Number.isFinite(numericValue)) {
        return null;
    }

    const roundedValue = Math.round(numericValue);
    if (roundedValue < min || roundedValue > max) {
        return null;
    }

    return roundedValue;
}

function coerceEnum<T extends string>(
    value: unknown,
    allowedValues: readonly T[],
): T | null {
    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim().toUpperCase();
    if (!allowedValues.includes(normalizedValue as T)) {
        return null;
    }

    return normalizedValue as T;
}

function coerceBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value !== 'string') {
        return null;
    }

    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'true') {
        return true;
    }

    if (normalizedValue === 'false') {
        return false;
    }

    return null;
}

/**
 * Normalizes untrusted LLM metadata to the strict API contract.
 *
 * Missing values use safe defaults and invalid values are rejected per field.
 * The function does not mutate its input and never deliberately throws.
 */
export function normalizeDraftMetadata(
    raw: Record<string, unknown>,
): NormalizedDraftMetadataResult {
    const warnings: string[] = [];
    const missingFields: string[] = [];

    const normalizeIntegerField = (
        key: 'servings' | 'prep_time_minutes' | 'total_time_minutes',
        min: number,
        max: number,
    ): number | null => {
        if (!hasOwn(raw, key) || raw[key] === null) {
            missingFields.push(key);
            return null;
        }

        const normalizedValue = coerceInteger(raw[key], min, max);
        if (normalizedValue === null) {
            warnings.push(
                `Odrzucono nieprawidłową wartość pola ${key} (poza zakresem ${min}–${max}).`,
            );
        }

        return normalizedValue;
    };

    const normalizeEnumField = <T extends string>(
        key: 'diet_type' | 'cuisine' | 'difficulty',
        allowedValues: readonly T[],
        allowNull = false,
    ): T | null => {
        if (!hasOwn(raw, key) || (raw[key] === null && !allowNull)) {
            missingFields.push(key);
            return null;
        }

        if (raw[key] === null) {
            return null;
        }

        const normalizedValue = coerceEnum(raw[key], allowedValues);
        if (normalizedValue === null) {
            warnings.push(
                `Odrzucono nieprawidłową wartość pola ${key} (nieznana wartość).`,
            );
        }

        return normalizedValue;
    };

    const normalizeBooleanField = (
        key: 'is_termorobot' | 'is_grill',
    ): boolean => {
        if (!hasOwn(raw, key) || raw[key] === null) {
            missingFields.push(key);
            return false;
        }

        const normalizedValue = coerceBoolean(raw[key]);
        if (normalizedValue === null) {
            warnings.push(`Odrzucono nieprawidłową wartość pola ${key}.`);
            return false;
        }

        return normalizedValue;
    };

    const servings = normalizeIntegerField('servings', MIN_SERVINGS, MAX_SERVINGS);
    const prepTimeMinutes = normalizeIntegerField(
        'prep_time_minutes',
        MIN_TIME_MINUTES,
        MAX_TIME_MINUTES,
    );
    let totalTimeMinutes = normalizeIntegerField(
        'total_time_minutes',
        MIN_TIME_MINUTES,
        MAX_TIME_MINUTES,
    );
    const dietType = normalizeEnumField('diet_type', DIET_TYPES);
    const cuisine = normalizeEnumField('cuisine', CUISINES, true);
    const difficulty = normalizeEnumField('difficulty', DIFFICULTIES);
    const isTermorobot = normalizeBooleanField('is_termorobot');
    const isGrill = normalizeBooleanField('is_grill');

    if (
        prepTimeMinutes !== null &&
        totalTimeMinutes !== null &&
        totalTimeMinutes < prepTimeMinutes
    ) {
        totalTimeMinutes = prepTimeMinutes;
        warnings.unshift(
            'Skorygowano czas całkowity: był krótszy niż czas przygotowania.',
        );
    }

    if (missingFields.length > 0) {
        warnings.push(
            `Niekompletne metadane przepisu — brak pól: ${missingFields.join(', ')}.`,
        );
    }

    return {
        metadata: {
            servings,
            prep_time_minutes: prepTimeMinutes,
            total_time_minutes: totalTimeMinutes,
            diet_type: dietType,
            cuisine,
            difficulty,
            is_termorobot: isTermorobot,
            is_grill: isGrill,
        },
        warnings,
    };
}

/**
 * Returns the system-prompt section responsible for extracting all metadata.
 * Enum lists are generated from the same constants used by normalization.
 */
export function getMetadataPromptSection(): string {
    return `8. METADANE PRZEPISU:
   - Zwróć każde z pól: servings, prep_time_minutes, total_time_minutes, diet_type, cuisine, difficulty, is_termorobot, is_grill.
   - Wartość jawnie podana w tekście lub na obrazie MA ZAWSZE pierwszeństwo przed Twoim szacunkiem. Jeśli wartości nie ma w źródle — wywnioskuj ją na podstawie całego przepisu (nazwa, składniki, kroki).
   - servings: liczba całkowita od ${MIN_SERVINGS} do ${MAX_SERVINGS}. Przedział porcji, np. "4–6", zamień na dolną granicę.
   - prep_time_minutes i total_time_minutes: liczby całkowite w minutach od ${MIN_TIME_MINUTES} do ${MAX_TIME_MINUTES}. Przelicz zapis czasu, np. "1 godz. 30 min" na 90. Czas całkowity obejmuje także czas bierny, np. marynowanie, wyrastanie i chłodzenie. total_time_minutes musi być większy lub równy prep_time_minutes.
   - diet_type: jedna z wartości: ${DIET_TYPES.join(', ')}.
   - cuisine: jedna z wartości: ${CUISINES.join(', ')}. Jeśli żadna nie pasuje, użyj null.
   - difficulty: jedna z wartości: ${DIFFICULTIES.join(', ')}.
   - is_termorobot: true, gdy przepis używa urządzenia Thermomix, Termorobot, Bimby lub Cookeo albo zawiera kroki typu "5 min / 100°C / obroty 1"; w przeciwnym razie false.
   - is_grill: true przy grillu, grillowaniu, barbecue, rożnie lub ruszcie ogrodowym. Sama funkcja "grill" w piekarniku nie wystarcza — oceń kontekst. W przeciwnym razie false.
   - Dla obrazu bez tekstu wywnioskuj wszystkie metadane ze zdjęcia. Ustaw flagę true tylko przy wyraźnych przesłankach, np. widocznym grillowanym mięsie, i obniż meta.confidence.
   - Każde z ośmiu pól musi być obecne. Użyj null wyłącznie dla cuisine, gdy brak pasującej wartości; flagi zawsze ustaw na true albo false.`;
}
