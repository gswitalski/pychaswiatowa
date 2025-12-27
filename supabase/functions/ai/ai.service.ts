/**
 * AI Service
 * Business logic for AI-powered recipe draft generation.
 * Integrates with OpenAI API for text extraction and recipe structuring.
 */

import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    GenerateRecipeDraftParams,
    LlmGenerationResult,
    AiRecipeDraftDto,
    AiRecipeDraftResponseDto,
    MAX_TAGS_COUNT,
    MAX_RECIPE_NAME_LENGTH,
} from './ai.types.ts';

// #region --- Constants ---

/** OpenAI API endpoint */
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/** Model to use for text generation */
const OPENAI_MODEL = 'gpt-4o-mini';

/** Maximum tokens for response */
const MAX_TOKENS = 2000;

/** Temperature for generation (low for consistency) */
const TEMPERATURE = 0.3;

/** Timeout for API calls in milliseconds */
const API_TIMEOUT_MS = 30_000;

// #endregion

// #region --- Prompts ---

/**
 * System prompt for recipe extraction.
 * Enforces single recipe validation and structured output.
 */
function getSystemPrompt(language: string): string {
    return `Jesteś asystentem do ekstrakcji i strukturyzacji przepisów kulinarnych. Twoje zadanie to:

1. Przeanalizować podany tekst lub opis obrazu
2. Określić, czy zawiera DOKŁADNIE JEDEN przepis kulinarny
3. Jeśli tak - wyekstrahować i ustrukturyzować przepis
4. Jeśli nie - zwrócić informację o błędzie z powodami

KRYTYCZNE ZASADY:
- Akceptuj TYLKO pojedynczy przepis
- Odrzuć: wiele przepisów, listy zakupów, menu, reklamy, treści nie-kulinarne
- Składniki i kroki muszą być niepuste
- Odpowiadaj w języku: ${language}

FORMAT ODPOWIEDZI (JSON):

Dla poprawnego przepisu:
{
  "is_valid_recipe": true,
  "draft": {
    "name": "Nazwa przepisu",
    "description": "Krótki opis lub null",
    "ingredients_raw": "Składnik 1\\nSkładnik 2\\n# Sekcja\\nSkładnik 3",
    "steps_raw": "Krok 1\\nKrok 2\\n# Sekcja\\nKrok 3",
    "category_name": "Obiad" lub null,
    "tags": ["tag1", "tag2"]
  },
  "meta": {
    "confidence": 0.95,
    "warnings": []
  }
}

Dla niepoprawnej treści:
{
  "is_valid_recipe": false,
  "reasons": ["Powód 1", "Powód 2"]
}

FORMATOWANIE:
- ingredients_raw i steps_raw: każdy element w nowej linii
- Sekcje/nagłówki poprzedź znakiem #
- Kategorie: Śniadanie, Obiad, Kolacja, Deser, Przekąska, Napój, Zupa, Sałatka, Pieczywo
- Tagi: krótkie, bez duplikatów, max 10 tagów`;
}

/**
 * User prompt for text-based extraction.
 */
function getTextExtractionPrompt(text: string): string {
    return `Przeanalizuj poniższy tekst i wyekstrahuj z niego przepis kulinarny:

---
${text}
---

Zwróć odpowiedź w formacie JSON zgodnie z instrukcjami.`;
}

/**
 * User prompt for image-based extraction.
 */
function getImageExtractionPrompt(): string {
    return `Przeanalizuj załączony obraz i wyekstrahuj z niego przepis kulinarny.

Jeśli obraz zawiera tekst przepisu - wyekstrahuj go.
Jeśli obraz przedstawia gotowe danie - opisz prawdopodobne składniki i kroki przygotowania.

Zwróć odpowiedź w formacie JSON zgodnie z instrukcjami.`;
}

// #endregion

// #region --- API Integration ---

/**
 * Calls OpenAI API with the given messages.
 * 
 * @param messages - Array of chat messages
 * @returns Parsed JSON response from the model
 * @throws ApplicationError on API or parsing errors
 */
async function callOpenAI(
    messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>
): Promise<unknown> {
    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
        logger.error('OpenAI API key not configured');
        throw new ApplicationError('INTERNAL_ERROR', 'AI service is not configured');
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
                throw new ApplicationError('TOO_MANY_REQUESTS', 'AI service rate limit exceeded. Please try again later.');
            }

            throw new ApplicationError('INTERNAL_ERROR', 'AI service temporarily unavailable');
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            logger.error('Empty response from OpenAI', { data });
            throw new ApplicationError('INTERNAL_ERROR', 'AI service returned empty response');
        }

        // Parse JSON response
        try {
            return JSON.parse(content);
        } catch {
            logger.error('Failed to parse OpenAI response as JSON', {
                content: content.substring(0, 500),
            });
            throw new ApplicationError('INTERNAL_ERROR', 'AI service returned invalid response format');
        }
    } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ApplicationError) {
            throw error;
        }

        if (error instanceof Error && error.name === 'AbortError') {
            logger.error('OpenAI API timeout');
            throw new ApplicationError('INTERNAL_ERROR', 'AI service request timed out');
        }

        logger.error('OpenAI API request failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to connect to AI service');
    }
}

// #endregion

// #region --- Post-Processing ---

/**
 * Normalizes and validates the extracted recipe draft.
 * - Trims strings
 * - Limits name length
 * - Deduplicates and limits tags
 * 
 * @param draft - Raw draft from LLM
 * @returns Normalized draft
 */
function normalizeDraft(draft: AiRecipeDraftDto): AiRecipeDraftDto {
    // Normalize name
    let name = draft.name.trim();
    if (name.length > MAX_RECIPE_NAME_LENGTH) {
        name = name.substring(0, MAX_RECIPE_NAME_LENGTH - 3) + '...';
    }

    // Normalize tags: trim, lowercase, deduplicate, limit count
    const seenTags = new Set<string>();
    const normalizedTags: string[] = [];
    
    for (const tag of draft.tags) {
        const trimmed = tag.trim();
        if (!trimmed) continue;
        
        const lower = trimmed.toLowerCase();
        if (seenTags.has(lower)) continue;
        
        seenTags.add(lower);
        normalizedTags.push(trimmed);
        
        if (normalizedTags.length >= MAX_TAGS_COUNT) break;
    }

    return {
        name,
        description: draft.description?.trim() || null,
        ingredients_raw: draft.ingredients_raw.trim(),
        steps_raw: draft.steps_raw.trim(),
        category_name: draft.category_name?.trim() || null,
        tags: normalizedTags,
    };
}

/**
 * Validates that the draft has required content.
 * 
 * @param draft - Draft to validate
 * @returns Array of validation errors (empty if valid)
 */
function validateDraftContent(draft: AiRecipeDraftDto): string[] {
    const errors: string[] = [];

    if (!draft.name || draft.name.trim().length === 0) {
        errors.push('Recipe name is missing');
    }

    if (!draft.ingredients_raw || draft.ingredients_raw.trim().length === 0) {
        errors.push('Recipe ingredients are missing');
    }

    if (!draft.steps_raw || draft.steps_raw.trim().length === 0) {
        errors.push('Recipe steps are missing');
    }

    return errors;
}

// #endregion

// #region --- Main Service Function ---

/**
 * Generates a recipe draft from text or image using AI.
 * 
 * @param params - Generation parameters including source type and content
 * @returns LlmGenerationResult with either success data or failure reasons
 * @throws ApplicationError for infrastructure/configuration errors
 */
export async function generateRecipeDraft(
    params: GenerateRecipeDraftParams
): Promise<LlmGenerationResult> {
    const { userId, source, text, imageBytes, imageMimeType, language } = params;

    logger.info('Starting recipe draft generation', {
        userId,
        source,
        language,
        textLength: text?.length,
        imageSize: imageBytes?.length,
    });

    // Build messages for OpenAI
    const systemMessage = {
        role: 'system',
        content: getSystemPrompt(language),
    };

    let userMessage: { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> };

    if (source === 'text' && text) {
        userMessage = {
            role: 'user',
            content: getTextExtractionPrompt(text),
        };
    } else if (source === 'image' && imageBytes && imageMimeType) {
        // Convert image bytes to base64 data URL
        const base64 = btoa(String.fromCharCode(...imageBytes));
        const dataUrl = `data:${imageMimeType};base64,${base64}`;

        userMessage = {
            role: 'user',
            content: [
                { type: 'text', text: getImageExtractionPrompt() },
                { type: 'image_url', image_url: { url: dataUrl } },
            ],
        };
    } else {
        logger.error('Invalid source configuration', { source, hasText: !!text, hasImage: !!imageBytes });
        throw new ApplicationError('INTERNAL_ERROR', 'Invalid source configuration');
    }

    // Call OpenAI API
    const llmResponse = await callOpenAI([systemMessage, userMessage]);

    // Check if response indicates invalid recipe
    if (
        typeof llmResponse === 'object' &&
        llmResponse !== null &&
        'is_valid_recipe' in llmResponse &&
        (llmResponse as { is_valid_recipe: boolean }).is_valid_recipe === false
    ) {
        const errorResponse = llmResponse as { is_valid_recipe: false; reasons: string[] };
        logger.info('LLM determined content is not a valid recipe', {
            userId,
            reasons: errorResponse.reasons,
        });
        return {
            success: false,
            reasons: errorResponse.reasons || ['Content does not appear to be a valid recipe'],
        };
    }

    // Parse successful response
    const successResponse = llmResponse as {
        is_valid_recipe: true;
        draft: AiRecipeDraftDto;
        meta: { confidence: number; warnings: string[] };
    };

    if (!successResponse.draft) {
        logger.error('LLM response missing draft field', { llmResponse });
        throw new ApplicationError('INTERNAL_ERROR', 'AI service returned incomplete response');
    }

    // Validate draft content
    const validationErrors = validateDraftContent(successResponse.draft);
    if (validationErrors.length > 0) {
        logger.info('Draft validation failed', {
            userId,
            errors: validationErrors,
        });
        return {
            success: false,
            reasons: validationErrors,
        };
    }

    // Normalize draft
    const normalizedDraft = normalizeDraft(successResponse.draft);

    const result: AiRecipeDraftResponseDto = {
        draft: normalizedDraft,
        meta: {
            confidence: successResponse.meta?.confidence ?? 0.8,
            warnings: successResponse.meta?.warnings ?? [],
        },
    };

    logger.info('Recipe draft generation completed', {
        userId,
        recipeName: result.draft.name,
        confidence: result.meta.confidence,
    });

    return {
        success: true,
        data: result,
    };
}

// #endregion

