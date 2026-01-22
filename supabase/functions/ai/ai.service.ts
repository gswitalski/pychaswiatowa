/**
 * AI Service
 * Business logic for AI-powered recipe draft generation.
 * Integrates with OpenAI API for text extraction and recipe structuring.
 */

import { ApplicationError } from "../_shared/errors.ts";
import { logger } from "../_shared/logger.ts";
import {
    AiNormalizedIngredientsLlmResponseSchema,
    AiNormalizedIngredientsResponseDto,
    AiRecipeDraftDto,
    AiRecipeDraftErrorResponseSchema,
    AiRecipeDraftLlmResponseSchema,
    AiRecipeDraftResponseDto,
    AiRecipeImageStyleContract,
    GenerateNormalizedIngredientsParams,
    GenerateRecipeDraftParams,
    GenerateRecipeImageParams,
    ImageGenerationResult,
    LlmGenerationResult,
    MAX_RECIPE_NAME_LENGTH,
    MAX_TAGS_COUNT,
    NormalizedIngredientsGenerationResult,
    ReferenceImageData,
} from "./ai.types.ts";

// #region --- Constants ---

/** OpenAI API endpoint */
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/** Model to use for text generation */
const OPENAI_MODEL = "gpt-4o-mini";

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
    return `Jesteś asystentem AI specjalizującym się w ekstrakcji i strukturyzacji przepisów kulinarnych. Twoje zadanie to przeanalizowanie podanej treści, określenie czy zawiera dokładnie jeden przepis kulinarny, a następnie wyekstrahowanie i ustrukturyzowanie go w standardowym formacie JSON.

Oto treść do przeanalizowania:

<input>
{{INPUT}}
</input>

Język odpowiedzi:
<language>
${language}
</language>

KRYTYCZNE ZASADY WALIDACJI:

Akceptuj TYLKO treści zawierające DOKŁADNIE JEDEN kompletny przepis kulinarny.

ODRZUĆ treści, które zawierają:
- Wiele różnych przepisów w jednym tekście
- Same listy zakupów bez instrukcji przygotowania
- Menu restauracyjne lub karty dań
- Reklamy produktów spożywczych
- Treści niezwiązane z gotowaniem
- Fragmenty przepisów bez składników LUB bez kroków
- Puste lub nieczytelne treści

ZASADY EKSTRAKCJI I STRUKTURYZACJI:

1. NAZWA PRZEPISU:
   - Wyekstrahuj lub wygeneruj krótką, opisową nazwę
   - Jeśli brak tytułu, stwórz go na podstawie głównych składników

2. OPIS:
   - Wygeneruj krótki, przyjazny opis (1-3 zdania)
   - Może być lekko dowcipny lub zawierać ciekawostkę
   - Jeśli nie da się stworzyć sensownego opisu, użyj null

3. SKŁADNIKI (ingredients_raw):
   - Każdy składnik w osobnej linii (separator: \n)
   - Sekcje/nagłówki poprzedź znakiem # (np. "# Ciasto", "# Krem")
   - Przelicz wszystkie wagi na gramy: 1 kg → 1000 g, 5 dag → 50 g
   - Objętości podawaj w mililitrach gdzie możliwe
   - Oddzielaj jednostki od liczb spacją: "500 g", "200 ml"
   - zawsze podawaj najpierw ilosc a potem nazwę składnika np "100 g mąki typ 450"
   - Przeanalizuj kroki wykonania i posortuj składniki w kolejności ich użycia
   - wykrywaj nagłówki w sekcji składników i przed nimi umieszczaj znak #
   - Lista NIE MOŻE być pusta

4. KROKI WYKONANIA (steps_raw):
   - Każdy krok w osobnej linii (separator: \n)
   - Sekcje/nagłówki poprzedź znakiem # (np. "# Przygotowanie ciasta")
   - ZAWSZE używaj bezokoliczników: "Wymieszaj" → "Wymieszać", "Dodaj" → "Dodać"
   - tam gdzie to ma sens używaj trybu dokonanego np. "Wymieszać" zamiast "Mieszać". Ale gdy pada faza "podawać" to zachowaj formę niedokonaną.
   - ZACHOWAJ notacje Thermomix bez zmian: "5 s/obr. 5", "6 min/120°C/obr. 1", "32 min/100°C/obr. 5"
   - wykrywaj nagłówki w sekcji kroków i przed nimi umieszczaj znak #
   - Lista NIE MOŻE być pusta

5. WSKAZÓWKI (tips_raw) - OPCJONALNE:
   - Jeśli tekst zawiera dodatkowe wskazówki, porady lub ciekawostki kulinarne - wyekstrahuj je
   - Każda wskazówka w osobnej linii (separator: \n)
   - Sekcje/nagłówki poprzedź znakiem # (np. "# Przechowywanie", "# Warianty")
   - Wskazówki mogą dotyczyć: przechowywania, podawania, wariantów, substytucji składników, technicznych porad
   - Jeśli brak wskazówek w źródle - POMIŃ to pole całkowicie (nie generuj własnych wskazówek)
   - To pole jest całkowicie opcjonalne

6. KATEGORIA (category_name):
   - Wybierz JEDNĄ z: Śniadanie, Obiad, Kolacja, Deser, Przekąska, Napój, Zupa, Sałatka, Pieczywo
   - Jeśli nie pasuje do żadnej, użyj null

6. TAGI (tags):
   - Generuj krótkie, opisowe tagi (np. "wegetariańskie", "szybkie", "włoskie")
   - Maksymalnie 10 tagów
   - Bez duplikatów
   - Tablica może być pusta []

OBSŁUGA NIECZYTELNYCH FORMATÓW:
- Jeśli format źródłowy jest chaotyczny, samodzielnie zrekonstruuj logiczną strukturę
- Napraw oczywiste błędy ortograficzne i formatowanie
- Zgaduj intencje autora na podstawie kontekstu
- zawsze przetłumacz przepis na język polski

PROCES ANALIZY:

Przed wygenerowaniem finalnej odpowiedzi, użyj tagów <scratchpad> do przemyślenia:

<scratchpad>
1. Czy treść zawiera dokładnie jeden przepis? (TAK/NIE)
2. Czy są obecne składniki? (TAK/NIE)
3. Czy są obecne kroki wykonania? (TAK/NIE)
4. Jakie sekcje składników i kroków mogę wyodrębnić?
5. Jaka kategoria najlepiej pasuje?
6. Jakie tagi będą odpowiednie?
7. Czy są jakieś ostrzeżenia lub problemy z jakością danych?
</scratchpad>

FORMAT ODPOWIEDZI JSON:

Dla POPRAWNEGO przepisu:

json
{
  "is_valid_recipe": true,
  "draft": {
    "name": "Nazwa przepisu",
    "description": "Krótki, przyjazny opis lub null",
    "ingredients_raw": "Składnik 1\nSkładnik 2\n# Sekcja opcjonalna\nSkładnik 3",
    "steps_raw": "Krok 1\nKrok 2\n# Sekcja opcjonalna\nKrok 3",
    "tips_raw": "Wskazówka 1\nWskazówka 2\n# Sekcja opcjonalna\nWskazówka 3",
    "category_name": "Obiad",
    "tags": ["tag1", "tag2", "tag3"]
  },
  "meta": {
    "confidence": 0.95,
    "warnings": ["Opcjonalne ostrzeżenia o jakości danych"]
  }
}

UWAGA O POLACH:
- "tips_raw" jest OPCJONALNE - dodaj je TYLKO jeśli źródło zawiera wskazówki. Jeśli brak wskazówek - po prostu POMIŃ to pole w JSON.
- WSZYSTKIE INNE POLA SĄ WYMAGANE i MUSZĄ być obecne w odpowiedzi:
  - "name" - zawsze wymagane (string)
  - "description" - zawsze obecne (string lub null)
  - "ingredients_raw" - zawsze wymagane (string)
  - "steps_raw" - zawsze wymagane (string)
  - "category_name" - zawsze obecne (string lub null jeśli nie pasuje do żadnej kategorii)
  - "tags" - zawsze obecne (tablica stringów, może być pusta [])


Dla NIEPOPRAWNEJ treści:

json
{
  "is_valid_recipe": false,
  "reasons": ["Szczegółowy powód 1", "Szczegółowy powód 2"]
}


WAŻNE:
- Odpowiadaj w języku określonym w zmiennej {{LANGUAGE}}
- Używaj przyjaznego, naturalnego stylu w opisach
- Sam przepis (składniki i kroki) ma być neutralny i profesjonalny
- Zwracaj TYLKO poprawny JSON, bez dodatkowych komentarzy poza tagami scratchpad

Rozpocznij analizę teraz.

`;
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
    messages: Array<
        {
            role: string;
            content:
                | string
                | Array<
                    { type: string; text?: string; image_url?: { url: string } }
                >;
        }
    >,
): Promise<unknown> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
        logger.error("OpenAI API key not configured");
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "AI service is not configured",
        );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                messages,
                max_tokens: MAX_TOKENS,
                temperature: TEMPERATURE,
                response_format: { type: "json_object" },
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.text();
            logger.error("OpenAI API error", {
                status: response.status,
                body: errorBody.substring(0, 500),
            });

            if (response.status === 429) {
                throw new ApplicationError(
                    "TOO_MANY_REQUESTS",
                    "AI service rate limit exceeded. Please try again later.",
                );
            }

            throw new ApplicationError(
                "INTERNAL_ERROR",
                "AI service temporarily unavailable",
            );
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            logger.error("Empty response from OpenAI", { data });
            throw new ApplicationError(
                "INTERNAL_ERROR",
                "AI service returned empty response",
            );
        }

        // Parse JSON response
        try {
            return JSON.parse(content);
        } catch {
            logger.error("Failed to parse OpenAI response as JSON", {
                content: content.substring(0, 500),
            });
            throw new ApplicationError(
                "INTERNAL_ERROR",
                "AI service returned invalid response format",
            );
        }
    } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ApplicationError) {
            throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
            logger.error("OpenAI API timeout");
            throw new ApplicationError(
                "INTERNAL_ERROR",
                "AI service request timed out",
            );
        }

        logger.error("OpenAI API request failed", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "Failed to connect to AI service",
        );
    }
}

// #endregion

// #region --- Post-Processing ---

/**
 * Normalizes and validates the extracted recipe draft.
 * - Trims strings
 * - Limits name length
 * - Deduplicates and limits tags
 * - Normalizes optional tips_raw field
 *
 * @param draft - Raw draft from LLM
 * @returns Normalized draft
 */
function normalizeDraft(draft: AiRecipeDraftDto): AiRecipeDraftDto {
    // Normalize name
    let name = draft.name.trim();
    if (name.length > MAX_RECIPE_NAME_LENGTH) {
        name = name.substring(0, MAX_RECIPE_NAME_LENGTH - 3) + "...";
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

    // Normalize tips_raw: trim, convert empty to undefined
    let normalizedTipsRaw: string | undefined = undefined;
    if (draft.tips_raw !== undefined) {
        const trimmed = draft.tips_raw.trim();
        if (trimmed.length > 0) {
            normalizedTipsRaw = trimmed;
        }
    }

    return {
        name,
        description: draft.description?.trim() || null,
        ingredients_raw: draft.ingredients_raw.trim(),
        steps_raw: draft.steps_raw.trim(),
        tips_raw: normalizedTipsRaw,
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
        errors.push("Recipe name is missing");
    }

    if (!draft.ingredients_raw || draft.ingredients_raw.trim().length === 0) {
        errors.push("Recipe ingredients are missing");
    }

    if (!draft.steps_raw || draft.steps_raw.trim().length === 0) {
        errors.push("Recipe steps are missing");
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
    params: GenerateRecipeDraftParams,
): Promise<LlmGenerationResult> {
    const { userId, source, text, imageBytes, imageMimeType, language } =
        params;

    logger.info("Starting recipe draft generation", {
        userId,
        source,
        language,
        textLength: text?.length,
        imageSize: imageBytes?.length,
    });

    // Build messages for OpenAI
    const systemMessage = {
        role: "system",
        content: getSystemPrompt(language),
    };

    let userMessage: {
        role: string;
        content:
            | string
            | Array<
                { type: string; text?: string; image_url?: { url: string } }
            >;
    };

    if (source === "text" && text) {
        userMessage = {
            role: "user",
            content: getTextExtractionPrompt(text),
        };
    } else if (source === "image" && imageBytes && imageMimeType) {
        // Convert image bytes to base64 data URL
        // Process in chunks to avoid stack overflow for large images
        const CHUNK_SIZE = 8192;
        let binaryString = "";
        for (let i = 0; i < imageBytes.length; i += CHUNK_SIZE) {
            const chunk = imageBytes.slice(i, i + CHUNK_SIZE);
            binaryString += String.fromCharCode(...chunk);
        }
        const base64 = btoa(binaryString);
        const dataUrl = `data:${imageMimeType};base64,${base64}`;

        userMessage = {
            role: "user",
            content: [
                { type: "text", text: getImageExtractionPrompt() },
                { type: "image_url", image_url: { url: dataUrl } },
            ],
        };
    } else {
        logger.error("Invalid source configuration", {
            source,
            hasText: !!text,
            hasImage: !!imageBytes,
        });
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "Invalid source configuration",
        );
    }

    // Call OpenAI API
    const llmResponse = await callOpenAI([systemMessage, userMessage]);

    // Check if response indicates invalid recipe
    if (
        typeof llmResponse === "object" &&
        llmResponse !== null &&
        "is_valid_recipe" in llmResponse &&
        (llmResponse as { is_valid_recipe: boolean }).is_valid_recipe === false
    ) {
        // Validate error response schema
        const errorParseResult = AiRecipeDraftErrorResponseSchema.safeParse(llmResponse);
        if (!errorParseResult.success) {
            logger.error("Invalid error response from LLM", {
                llmResponse,
                zodError: errorParseResult.error
            });
            throw new ApplicationError(
                "INTERNAL_ERROR",
                "AI service returned invalid error response format",
            );
        }

        const errorResponse = errorParseResult.data;
        logger.info("LLM determined content is not a valid recipe", {
            userId,
            reasons: errorResponse.reasons,
        });
        return {
            success: false,
            reasons: errorResponse.reasons,
        };
    }

    // Validate successful response schema
    const successParseResult = AiRecipeDraftLlmResponseSchema.safeParse(llmResponse);
    if (!successParseResult.success) {
        logger.error("Invalid success response from LLM", {
            llmResponse,
            zodError: successParseResult.error
        });
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "AI service returned invalid response format",
        );
    }

    const successResponse = successParseResult.data;

    // Validate draft content
    const validationErrors = validateDraftContent(successResponse.draft);
    if (validationErrors.length > 0) {
        logger.info("Draft validation failed", {
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

    logger.info("Recipe draft generation completed", {
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

// #region --- Recipe Image Generation ---

/** OpenAI Images API endpoint */
const IMAGES_API_URL = "https://api.openai.com/v1/images/generations";

/** Image generation model to use (gpt-image-1 for webp output support) */
const IMAGE_MODEL = "gpt-image-1.5";

/** Timeout for Image API calls in milliseconds */
const IMAGE_API_TIMEOUT_MS = 60_000;

// #region --- Gemini API Constants ---

/** Gemini API endpoint (for image-to-image generation) */
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini image generation model (image-to-image with reference) */
// Note: Use latest stable model from Gemini documentation
// const GEMINI_IMAGE_MODEL = "gemini-2.0-flash-exp";
const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";



/** Timeout for Gemini API calls in milliseconds */
const GEMINI_API_TIMEOUT_MS = 90_000;

// #endregion

/**
 * Returns style contract for the given generation mode.
 * Different modes have different visual style guidelines.
 *
 * @param mode - Generation mode (recipe_only or with_reference)
 * @returns Style contract object
 */
function getStyleContract(
    mode: 'recipe_only' | 'with_reference',
): AiRecipeImageStyleContract {
    if (mode === 'recipe_only') {
        return {
            photorealistic: true,
            rustic_table: true,
            natural_light: true,
            no_people: true,
            no_text: true,
            no_watermark: true,
        };
    } else {
        // with_reference mode uses elegant kitchen/dining aesthetic
        return {
            photorealistic: true,
            rustic_table: false,
            natural_light: true,
            no_people: true,
            no_text: true,
            no_watermark: true,
        };
    }
}

/**
 * Builds a condensed description of ingredients for the prompt.
 * Limits to key ingredients to reduce token usage.
 *
 * @param ingredients - Array of ingredient content items
 * @returns Condensed ingredient description
 */
function buildIngredientsSummary(
    ingredients: Array<{ type: string; content: string }>,
): string {
    const items = ingredients
        .filter((i) => i.type === "item")
        .map((i) => i.content)
        .slice(0, 10); // Limit to 10 key ingredients

    return items.join(", ");
}

/**
 * Builds a condensed description of preparation steps for the prompt.
 * Limits to key steps to reduce token usage.
 *
 * @param steps - Array of step content items
 * @returns Condensed steps description
 */
function buildStepsSummary(
    steps: Array<{ type: string; content: string }>,
): string {
    const items = steps
        .filter((s) => s.type === "item")
        .map((s) => s.content)
        .slice(0, 8); // Limit to 8 key steps

    return items.join("\n");
}

/**
 * Validates if recipe has enough information to generate a sensible image.
 * Returns array of reasons if insufficient, empty array if valid.
 *
 * @param recipe - Recipe data to validate
 * @returns Array of validation failure reasons
 */
function validateRecipeForImageGeneration(
    recipe: GenerateRecipeImageParams["recipe"],
): string[] {
    const reasons: string[] = [];

    // Check recipe name
    if (!recipe.name || recipe.name.trim().length < 3) {
        reasons.push("Recipe name is too short or missing");
    }

    // Check ingredients - need at least some actual items
    const ingredientItems = recipe.ingredients.filter((i) => i.type === "item");
    if (ingredientItems.length === 0) {
        reasons.push("Recipe has no ingredient items (only headers)");
    }

    // Check steps - need at least one step
    const stepItems = recipe.steps.filter((s) => s.type === "item");
    if (stepItems.length === 0) {
        reasons.push("Recipe has no preparation steps");
    }

    // Check if name is too generic
    const genericNames = ["przepis", "recipe", "danie", "dish", "jedzenie", "food"];
    if (genericNames.includes(recipe.name.toLowerCase().trim())) {
        reasons.push("Recipe name is too generic to generate a specific dish image");
    }

    return reasons;
}

/**
 * Builds common recipe context section for prompts.
 *
 * @param recipe - Recipe data
 * @returns Recipe context string
 */
function buildRecipeContext(
    recipe: GenerateRecipeImageParams["recipe"],
): string {
    const ingredientsSummary = buildIngredientsSummary(recipe.ingredients);
    const stepsSummary = buildStepsSummary(recipe.steps);

    // Build dish description
    let dishInfo = recipe.name;
    if (recipe.description) {
        dishInfo += `. ${recipe.description}`;
    }
    if (recipe.category_name) {
        dishInfo += ` (${recipe.category_name})`;
    }

    // Add cooking method context if applicable
    let cookingMethodNote = "";
    if (recipe.is_termorobot) {
        cookingMethodNote += "\nNote: This dish is prepared using a kitchen robot (Thermomix-style).";
    }
    if (recipe.is_grill) {
        cookingMethodNote += "\nNote: This dish is prepared on a grill/barbecue.";
    }

    // Add timing context if available
    let timingNote = "";
    if (recipe.prep_time_minutes || recipe.total_time_minutes) {
        timingNote = "\nTiming: ";
        if (recipe.prep_time_minutes) {
            timingNote += `Prep ${recipe.prep_time_minutes} min`;
        }
        if (recipe.total_time_minutes) {
            if (recipe.prep_time_minutes) timingNote += ", ";
            timingNote += `Total ${recipe.total_time_minutes} min`;
        }
    }

    // Add tags context if available
    let tagsNote = "";
    if (recipe.tags && recipe.tags.length > 0) {
        tagsNote = `\nTags: ${recipe.tags.slice(0, 5).join(", ")}`;
    }

    return `<recipe>
${dishInfo}

Main ingredients: ${ingredientsSummary}

Preparation steps:
${stepsSummary}
${cookingMethodNote}${timingNote}${tagsNote}
</recipe>`;
}

/**
 * Builds the image generation prompt for recipe_only mode.
 * Uses rustic table aesthetic with natural light.
 *
 * @param recipe - Recipe data
 * @param _language - Output language (reserved for future use)
 * @returns Prompt string for image generation
 */
function buildImagePromptRecipeOnly(
    recipe: GenerateRecipeImageParams["recipe"],
    _language: string,
): string {
    const recipeContext = buildRecipeContext(recipe);

    const prompt = `You will be generating an image of a dish based on a recipe provided below.

Here is the recipe for the dish you need to photograph:
${recipeContext}

Requirements for the image you generate:

WHAT TO INCLUDE:
- The finished dish from the recipe as the main subject
- A rustic, homey table setting with natural wood surfaces
- Natural lighting that makes the food look warm and inviting
- Professional food photography composition
- Simple, authentic props like wooden boards, linen napkins, or rustic dishware
- Complementary raw ingredients placed naturally around the dish

WHAT NOT TO INCLUDE:
- Do not include any text, words, or writing of any kind
- Do not include any logos or brand names
- Do not include any people or parts of people (hands, faces, etc.)
- Do not include any modern, sleek, or overly styled elements

STYLE GUIDELINES:
- Create a fresh, original composition with a rustic, homemade feel
- Use warm, natural lighting (think golden hour or soft window light)
- Ensure the dish is the clear focal point on a natural wood table
- Make the image look homey, comforting, and appetizing
- Consider overhead shots or 45-degree angles that show the dish well
- Keep styling authentic and not overly staged

CRITICAL INGREDIENT RULES:
- Jeśli w przepisie nie ma nic o posypaniu potrawy pietruszką czy inną zielenią - NIE dodawaj tego do zdjęcia!
- Only include ingredients that are explicitly mentioned in the recipe
- Do not add decorative herbs or garnishes unless specified in the recipe

Generate the image now based on these instructions.`;

    return prompt;
}

/**
 * Builds the image generation prompt for with_reference mode (Gemini).
 * The reference image is passed directly to Gemini alongside this prompt.
 * The prompt instructs Gemini to use the reference for understanding the dish appearance
 * but create a new, original photograph.
 *
 * @param recipe - Recipe data
 * @param _language - Output language
 * @returns Prompt string for Gemini image-to-image generation
 */
function buildImagePromptWithReferenceGemini(
    recipe: GenerateRecipeImageParams["recipe"],
    _language: string,
): string {
    const recipeContext = buildRecipeContext(recipe);

    const prompt = `You are given a REFERENCE IMAGE of a dish. Your task is to generate a NEW, ORIGINAL photograph of the same dish but with a completely different composition, angle, and setting.

Here is the recipe for the dish:
${recipeContext}

CRITICAL INSTRUCTIONS:

1. REFERENCE IMAGE USAGE:
   - Use the reference image ONLY to understand what the dish looks like (shape, texture, colors, ingredients visible)
   - DO NOT copy the composition, angle, background, or styling of the reference
   - Create an entirely NEW photograph as if you were a professional food photographer

2. WHAT TO INCLUDE IN THE NEW IMAGE:
   - The same dish from the recipe, looking like the reference but photographed differently
   - An elegant, sophisticated kitchen or dining room setting
   - Professional food photography composition with artistic styling
   - Refined lighting that makes the food look premium and appetizing
   - Elegant props: fine dishware, polished cutlery, marble or wooden surfaces, or contemporary table settings

3. WHAT NOT TO INCLUDE:
   - Do not include any text, words, or writing
   - Do not include any logos or brand names
   - Do not include any people or parts of people (hands, faces)
   - Do not copy the exact composition or setting from the reference image

4. STYLE GUIDELINES:
   - Create a completely fresh, original composition
   - Use an elegant, upscale aesthetic (modern kitchen or refined dining room)
   - Ensure the dish is the clear focal point with sophisticated styling
   - Make the image look professional, premium, and restaurant-quality
   - Use interesting angles, perfect depth of field, and artistic plating

5. CRITICAL INGREDIENT RULES:
   - Jeśli w przepisie nie ma nic o posypaniu potrawy pietruszką czy inną zielenią - NIE dodawaj tego do zdjęcia!
   - Only include garnishes and ingredients that are visible in the reference image or explicitly mentioned in the recipe

Generate the new photograph now based on the reference image and these instructions.`;

    return prompt;
}

/**
 * Calls OpenAI Images API to generate an image.
 * Uses gpt-image-1 model with webp output format (MVP configuration).
 *
 * @param prompt - The image generation prompt
 * @returns Base64 encoded webp image data
 * @throws ApplicationError on API or processing errors
 */
async function callImageAPI(prompt: string): Promise<string> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
        logger.error("OpenAI API key not configured");
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "AI image service is not configured",
        );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_API_TIMEOUT_MS);

    try {
        const response = await fetch(IMAGES_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: IMAGE_MODEL,
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                output_format: "webp",
                background: "auto",
                quality: "auto",
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.text();
            logger.error("Image API error", {
                status: response.status,
                body: errorBody.substring(0, 500),
            });

            if (response.status === 429) {
                throw new ApplicationError(
                    "TOO_MANY_REQUESTS",
                    "AI image service rate limit exceeded. Please try again later.",
                );
            }

            if (response.status === 400) {
                // Content policy violation or bad request
                throw new ApplicationError(
                    "VALIDATION_ERROR",
                    "Image generation request was rejected. The recipe content may violate content policies.",
                );
            }

            throw new ApplicationError(
                "INTERNAL_ERROR",
                "AI image service temporarily unavailable",
            );
        }

        const data = await response.json();
        // gpt-image-1 returns b64_json in data[0].b64_json
        const imageData = data.data?.[0]?.b64_json;

        if (!imageData) {
            logger.error("Empty image response from Image API", { data });
            throw new ApplicationError(
                "INTERNAL_ERROR",
                "AI image service returned empty response",
            );
        }

        return imageData;
    } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ApplicationError) {
            throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
            logger.error("Image API timeout");
            throw new ApplicationError(
                "INTERNAL_ERROR",
                "AI image service request timed out",
            );
        }

        logger.error("Image API request failed", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "Failed to connect to AI image service",
        );
    }
}

/**
 * Calls Gemini API for image-to-image generation.
 * Takes a prompt and a reference image, returns a newly generated image.
 *
 * @param prompt - The image generation prompt
 * @param referenceImage - Reference image data (bytes + mimeType)
 * @returns Base64 encoded image data and mime type
 * @throws ApplicationError on API or processing errors
 */
async function callGeminiImageAPI(
    prompt: string,
    referenceImage: ReferenceImageData,
): Promise<{ imageBase64: string; mimeType: string }> {
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
        logger.error("Gemini API key not configured");
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "Gemini AI service is not configured",
        );
    }

    // Convert image bytes to base64
    const CHUNK_SIZE = 8192;
    let binaryString = "";
    for (let i = 0; i < referenceImage.bytes.length; i += CHUNK_SIZE) {
        const chunk = referenceImage.bytes.slice(i, i + CHUNK_SIZE);
        binaryString += String.fromCharCode(...chunk);
    }
    const imageBase64 = btoa(binaryString);

    // Build Gemini API payload (image-to-image format)
    // Note: Gemini REST API uses camelCase for field names
    const geminiPayload = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: referenceImage.mimeType,
                            data: imageBase64,
                        },
                    },
                ],
            },
        ],
        generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
        },
    };

    // log payload
    logger.info("Gemini API payload", { geminiPayload });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_API_TIMEOUT_MS);

    try {
        const geminiUrl = `${GEMINI_API_URL}/${GEMINI_IMAGE_MODEL}:generateContent`;

        const response = await fetch(geminiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body: JSON.stringify(geminiPayload),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.text();
            logger.error("Gemini API error", {
                status: response.status,
                body: errorBody.substring(0, 500),
            });

            if (response.status === 429) {
                throw new ApplicationError(
                    "TOO_MANY_REQUESTS",
                    "Gemini AI service rate limit exceeded. Please try again later.",
                );
            }

            if (response.status === 400) {
                throw new ApplicationError(
                    "VALIDATION_ERROR",
                    "Image generation request was rejected. The content may violate policies.",
                );
            }

            throw new ApplicationError(
                "INTERNAL_ERROR",
                "Gemini AI service temporarily unavailable",
            );
        }

        const geminiJson = await response.json();

        // Extract image from response: candidates[0].content.parts[n].inlineData
        // Note: Gemini REST API uses camelCase for field names in responses
        const candidate = geminiJson.candidates?.[0];
        const parts = candidate?.content?.parts ?? [];

        // deno-lint-ignore no-explicit-any
        const imagePart = parts.find((p: any) => p.inlineData?.data);

        if (!imagePart) {
            logger.error("No image in Gemini response", {
                geminiJson,
                candidatesCount: geminiJson.candidates?.length ?? 0,
                partsCount: parts.length,
            });
            throw new ApplicationError(
                "INTERNAL_ERROR",
                "Gemini AI service did not return an image",
            );
        }

        const generatedBase64 = imagePart.inlineData.data as string;
        const generatedMime = imagePart.inlineData.mimeType ?? "image/png";

        return {
            imageBase64: generatedBase64,
            mimeType: generatedMime,
        };
    } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof ApplicationError) {
            throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
            logger.error("Gemini API timeout");
            throw new ApplicationError(
                "INTERNAL_ERROR",
                "Gemini AI service request timed out",
            );
        }

        logger.error("Gemini API request failed", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "Failed to connect to Gemini AI service",
        );
    }
}

/**
 * Generates a preview image of a recipe dish using AI.
 *
 * This is a premium feature that creates a photorealistic image
 * of the dish described by the recipe data.
 *
 * Supports two modes:
 * - recipe_only: Generate from recipe text only (rustic style)
 * - with_reference: Generate with optional reference image (elegant style, no-copy constraint)
 *
 * @param params - Generation parameters including recipe data, mode, and optional reference image
 * @returns ImageGenerationResult with either success data or failure reasons
 * @throws ApplicationError for infrastructure/configuration errors
 */
export async function generateRecipeImage(
    params: GenerateRecipeImageParams,
): Promise<ImageGenerationResult> {
    const { userId, recipe, language, resolvedMode, referenceImage } = params;

    logger.info("Starting recipe image generation", {
        userId,
        recipeId: recipe.id,
        recipeName: recipe.name,
        language,
        mode: resolvedMode,
        hasReferenceImage: !!referenceImage,
        ingredientsCount: recipe.ingredients.length,
        stepsCount: recipe.steps.length,
    });

    // Step 1: Validate recipe has enough information
    const validationErrors = validateRecipeForImageGeneration(recipe);
    if (validationErrors.length > 0) {
        logger.info("Recipe validation failed for image generation", {
            userId,
            recipeId: recipe.id,
            reasons: validationErrors,
        });
        return {
            success: false,
            reasons: validationErrors,
        };
    }

    // Step 2: Generate image based on mode
    let imageBase64: string;
    let imageMimeType: string;

    if (resolvedMode === 'recipe_only') {
        // Recipe-only mode: use OpenAI Images API
        const prompt = buildImagePromptRecipeOnly(recipe, language);
        logger.debug("Built recipe_only prompt", {
            userId,
            recipeId: recipe.id,
            promptLength: prompt.length,
        });

        // Call OpenAI Images API
        imageBase64 = await callImageAPI(prompt);
        imageMimeType = "image/webp";

        logger.info("Recipe image generated successfully (OpenAI)", {
            userId,
            recipeId: recipe.id,
            mode: resolvedMode,
            imageSize: imageBase64.length,
        });
    } else {
        // with_reference mode: use Gemini API for image-to-image generation
        if (!referenceImage) {
            logger.error("with_reference mode requires a reference image", {
                userId,
                recipeId: recipe.id,
            });
            return {
                success: false,
                reasons: ["Reference image is required for with_reference mode"],
            };
        }

        // Build prompt for Gemini (image is passed directly)
        const prompt = buildImagePromptWithReferenceGemini(recipe, language);

        logger.debug("Built with_reference prompt for Gemini", {
            userId,
            recipeId: recipe.id,
            promptLength: prompt.length,
        });

        // Call Gemini API with both prompt and reference image
        logger.info("Generating image with Gemini (image-to-image)", {
            userId,
            recipeId: recipe.id,
            referenceImageSize: referenceImage.bytes.length,
        });

        const geminiResult = await callGeminiImageAPI(prompt, referenceImage);
        imageBase64 = geminiResult.imageBase64;
        imageMimeType = geminiResult.mimeType;

        logger.info("Recipe image generated successfully (Gemini)", {
            userId,
            recipeId: recipe.id,
            mode: resolvedMode,
            imageSize: imageBase64.length,
            mimeType: imageMimeType,
        });
    }

    // Step 3: Get style contract for the mode
    const styleContract = getStyleContract(resolvedMode);

    // Step 4: Determine output mime type (normalize if needed)
    // Gemini may return different formats, but we prefer webp
    const outputMimeType = imageMimeType === "image/webp" ? "image/webp" : "image/webp";

    // Step 5: Return successful result
    return {
        success: true,
        data: {
            image: {
                mime_type: outputMimeType,
                data_base64: imageBase64,
            },
            meta: {
                mode: resolvedMode,
                style_contract: styleContract,
                warnings: imageMimeType !== "image/webp"
                    ? [`Original format was ${imageMimeType}, served as webp`]
                    : [],
            },
        },
    };
}

// #endregion

// #region --- Normalized Ingredients Generation ---

/**
 * Re-export generateNormalizedIngredients from shared module.
 * This maintains backward compatibility with existing imports while using the shared implementation.
 */
export { generateNormalizedIngredients } from '../_shared/normalized-ingredients.ts';

// #endregion
