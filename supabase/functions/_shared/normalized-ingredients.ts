/**
 * Normalized Ingredients - Shared Module
 *
 * This module contains shared logic for AI-powered ingredient normalization.
 * Used by both:
 * - POST /ai/recipes/normalized-ingredients (user-facing API)
 * - Internal worker for async background processing
 *
 * IMPORTANT: This module depends on OpenAI API and should handle API errors appropriately.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { logger } from './logger.ts';
import { ApplicationError } from './errors.ts';

// #region --- Constants ---

/** Supported unit types for normalized ingredients (MVP controlled list) */
export const NORMALIZED_INGREDIENT_UNITS = [
    'g',
    'ml',
    'szt.',
    'ząbek',
    'łyżeczka',
    'łyżka',
    'szczypta',
    'pęczek',
] as const;

export type NormalizedIngredientUnit = typeof NORMALIZED_INGREDIENT_UNITS[number];

/** OpenAI API configuration */
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 4000;
const TEMPERATURE = 0.3;
const API_TIMEOUT_MS = 60_000;

// #endregion

// #region --- Types ---

/**
 * Schema for normalized ingredient item in response.
 */
const NormalizedIngredientSchema = z.object({
    amount: z.number().nullable(),
    unit: z.enum(NORMALIZED_INGREDIENT_UNITS).nullable(),
    name: z.string().min(1, 'Ingredient name cannot be empty'),
});

/**
 * Schema for validating LLM output (normalized ingredients).
 */
const AiNormalizedIngredientsLlmResponseSchema = z.object({
    normalized_ingredients: z.array(NormalizedIngredientSchema)
        .min(1, 'Normalized ingredients list cannot be empty'),
    meta: z.object({
        confidence: z.number().min(0).max(1),
        warnings: z.array(z.string()).default([]),
    }),
});

/** Type for normalized ingredient item */
export type NormalizedIngredientDto = z.infer<typeof NormalizedIngredientSchema>;

/** Type for complete API response */
export interface AiNormalizedIngredientsLlmResponse {
    normalized_ingredients: NormalizedIngredientDto[];
    meta: {
        confidence: number;
        warnings: string[];
    };
}

/**
 * Parameters for the generateNormalizedIngredients function.
 */
export interface GenerateNormalizedIngredientsParams {
    /** User ID for logging purposes */
    userId: string;
    /** Recipe ID for logging purposes */
    recipeId: number;
    /** Ingredient items to normalize (only type="item", headers should be filtered out) */
    ingredientItems: Array<{ type: string; content: string }>;
    /** Whitelist of allowed units */
    allowedUnits: NormalizedIngredientUnit[];
    /** Output language (default: 'pl') */
    language: string;
}

/**
 * Result from normalized ingredients generation - either success or validation failure.
 */
export type NormalizedIngredientsGenerationResult =
    | { success: true; data: AiNormalizedIngredientsLlmResponse }
    | { success: false; reasons: string[] };

// #endregion

// #region --- AI Integration ---

/**
 * Calls OpenAI API with the given messages.
 *
 * @param messages - Array of chat messages
 * @returns Parsed JSON response from the model
 * @throws ApplicationError on API or parsing errors
 */
async function callOpenAI(
    messages: Array<{ role: string; content: string }>,
): Promise<unknown> {
    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
        logger.error('OpenAI API key not configured');
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'AI service is not configured',
        );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages,
                max_tokens: MAX_TOKENS,
                temperature: TEMPERATURE,
                response_format: { type: 'json_object' },
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.text();
            logger.error('OpenAI API error', {
                status: response.status,
                body: errorBody.substring(0, 500),
            });

            if (response.status === 429) {
                throw new ApplicationError(
                    'TOO_MANY_REQUESTS',
                    'AI service rate limit exceeded. Please try again later.',
                );
            }

            throw new ApplicationError(
                'INTERNAL_ERROR',
                'AI service temporarily unavailable',
            );
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            logger.error('Empty response from OpenAI', { data });
            throw new ApplicationError(
                'INTERNAL_ERROR',
                'AI service returned empty response',
            );
        }

        // Parse JSON response
        try {
            return JSON.parse(content);
        } catch {
            logger.error('Failed to parse OpenAI response as JSON', {
                content: content.substring(0, 500),
            });
            throw new ApplicationError(
                'INTERNAL_ERROR',
                'AI service returned invalid response format',
            );
        }
    } catch (error) {
        clearTimeout(timeoutId);

        // Re-throw ApplicationError
        if (error instanceof ApplicationError) {
            throw error;
        }

        // Handle timeout
        if (error instanceof Error && error.name === 'AbortError') {
            logger.error('OpenAI API timeout', { timeoutMs: API_TIMEOUT_MS });
            throw new ApplicationError(
                'INTERNAL_ERROR',
                'AI service request timeout',
            );
        }

        // Handle network errors
        logger.error('OpenAI API network error', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'AI service network error',
        );
    }
}

// #endregion

// #region --- Prompts ---

/**
 * System prompt for ingredient normalization.
 * Instructs LLM to normalize ingredient list to structured format for shopping lists.
 */
function getNormalizedIngredientsSystemPrompt(
    allowedUnits: string[],
    language: string,
): string {
    return `Jesteś asystentem AI specjalizującym się w normalizacji list składników kulinarnych do ustrukturyzowanego formatu nadającego się na listę zakupów.

Twoje zadanie to przeanalizowanie podanej listy składników i przekształcenie jej do standardowego formatu z polami: name (nazwa), amount (ilość), unit (jednostka).

<allowed_units>
${allowedUnits.join(', ')}
</allowed_units>

<language>
${language}
</language>

KRYTYCZNE ZASADY NORMALIZACJI:

1. NAZWA SKŁADNIKA (name):
   - ZAWSZE liczba pojedyncza lub mnoga, mianownik (np. "jajko" zamiast "jajka", "pomidor" zamiast "pomidory"), tam gdzie lepiej pasuje liczba mnoga to użyj jej np. "rodzynki" zamiast "rodzynek"
   - jesli składnik jest dodatkowo opisany to użyj tego opisu do nazwy składnika np. "mąka pszenna typ 450" zamiast "mąka"
   - Tylko nazwa składnika, bez ilości i jednostek
   - Małe litery
   - Przykłady: "mąka", "cukier", "jajko", "masło", "mleko"

2. ILOŚĆ (amount):
   - Konwertuj na liczby dziesiętne gdzie możliwe
   - Konwersje masy: kg → g (1 kg = 1000 g, 5 dag = 50 g)
   - Konwersje objętości: l → ml (1 l = 1000 ml, 1 dl = 100 ml)
   - Jeśli ilość jest niejednoznaczna lub do smaku: amount = null
   - Przykłady niejednoznacznych: "do smaku", "opcjonalnie", "na oko", "odrobina", "garść"

3. JEDNOSTKA (unit):
   - TYLKO wartości z listy allowed_units
   - Konwertuj na dostępne jednostki (kg→g, l→ml)
   - Jeśli jednostka nie pasuje do żadnej dozwolonej: unit = null
   - Jeśli ilość jest niejednoznaczna: unit = null

4. IGNORUJ:
   - Nagłówki sekcji (type = "header") - pomiń je całkowicie
   - Puste linie
   - Komentarze

PRZYKŁADY NORMALIZACJI:

Wejście: "1 kg mąki"
Wyjście: { "amount": 1000, "unit": "g", "name": "mąka" }

Wejście: "2 łyżki cukru"
Wyjście: { "amount": 2, "unit": "łyżka", "name": "cukier" }

Wejście: "do smaku sól"
Wyjście: { "amount": null, "unit": null, "name": "sól" }

Wejście: "3 jajka"
Wyjście: { "amount": 3, "unit": "szt.", "name": "jajko" }

Wejście: "pęczek koperku"
Wyjście: { "amount": 1, "unit": "pęczek", "name": "koperek" }

Wejście: "2 ząbki czosnku"
Wyjście: { "amount": 2, "unit": "ząbek", "name": "czosnek" }

FORMAT ODPOWIEDZI JSON:

{
  "normalized_ingredients": [
    { "amount": 1000, "unit": "g", "name": "mąka" },
    { "amount": 2, "unit": "łyżka", "name": "cukier" },
    { "amount": null, "unit": null, "name": "sól" }
  ],
  "meta": {
    "confidence": 0.85,
    "warnings": ["Lista ostrzeżeń o potencjalnych problemach"]
  }
}

WAŻNE:
- Zwracaj TYLKO poprawny JSON, bez dodatkowych komentarzy
- confidence: 0-1 (jak pewnie przeprowadzona normalizacja)
- warnings: tablica stringów z ostrzeżeniami lub pusta tablica []
`;
}

/**
 * User prompt for ingredient normalization.
 */
function getNormalizedIngredientsUserPrompt(ingredients: string): string {
    return `Znormalizuj poniższą listę składników do formatu JSON:

---
${ingredients}
---

Zwróć odpowiedź w formacie JSON zgodnie z instrukcjami.`;
}

// #endregion

// #region --- Main Function ---

/**
 * Generates normalized ingredients list from recipe ingredients using AI.
 *
 * This is the core normalization logic shared between:
 * - User-facing API endpoint (POST /ai/recipes/normalized-ingredients)
 * - Internal worker for background processing
 *
 * @param params - Generation parameters including ingredient items and allowed units
 * @returns NormalizedIngredientsGenerationResult with either success data or failure reasons
 * @throws ApplicationError for infrastructure/configuration errors (API key missing, network errors, etc.)
 */
export async function generateNormalizedIngredients(
    params: GenerateNormalizedIngredientsParams,
): Promise<NormalizedIngredientsGenerationResult> {
    const { userId, recipeId, ingredientItems, allowedUnits, language } = params;

    logger.info('Starting normalized ingredients generation', {
        userId,
        recipeId,
        itemsCount: ingredientItems.length,
        language,
    });

    // Build ingredients text (only items, no headers)
    const ingredientsText = ingredientItems
        .map(item => item.content)
        .join('\n');

    if (!ingredientsText.trim()) {
        logger.warn('Empty ingredients text after filtering', {
            userId,
            recipeId,
        });
        return {
            success: false,
            reasons: ['No ingredient items to normalize (only headers or empty list)'],
        };
    }

    // Build messages for OpenAI
    const systemMessage = {
        role: 'system',
        content: getNormalizedIngredientsSystemPrompt(allowedUnits, language),
    };

    const userMessage = {
        role: 'user',
        content: getNormalizedIngredientsUserPrompt(ingredientsText),
    };

    // Call OpenAI API
    const llmResponse = await callOpenAI([systemMessage, userMessage]);

    // Validate response structure
    let validatedResponse;
    try {
        validatedResponse = AiNormalizedIngredientsLlmResponseSchema.parse(llmResponse);
    } catch (error) {
        logger.error('LLM response validation failed for normalized ingredients', {
            userId,
            recipeId,
            error: error instanceof Error ? error.message : 'Unknown error',
            response: llmResponse,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'AI service returned invalid response format for normalized ingredients',
        );
    }

    // Validate that all units are from allowed list
    for (const item of validatedResponse.normalized_ingredients) {
        if (item.unit !== null && !allowedUnits.includes(item.unit)) {
            logger.error('LLM returned unit not in allowed list', {
                userId,
                recipeId,
                unit: item.unit,
                allowedUnits,
            });
            throw new ApplicationError(
                'INTERNAL_ERROR',
                'AI service returned invalid unit (not in allowed list)',
            );
        }
    }

    logger.info('Normalized ingredients generation completed', {
        userId,
        recipeId,
        normalizedCount: validatedResponse.normalized_ingredients.length,
        confidence: validatedResponse.meta.confidence,
    });

    return {
        success: true,
        data: validatedResponse,
    };
}

// #endregion
