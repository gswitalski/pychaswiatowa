/**
 * AI Service
 * Business logic for AI-powered recipe draft generation.
 * Integrates with OpenAI API for text extraction and recipe structuring.
 */

import { ApplicationError } from "../_shared/errors.ts";
import { logger } from "../_shared/logger.ts";
import {
    AiRecipeDraftDto,
    AiRecipeDraftResponseDto,
    AiRecipeImageStyleContract,
    GenerateRecipeDraftParams,
    GenerateRecipeImageParams,
    ImageGenerationResult,
    LlmGenerationResult,
    MAX_RECIPE_NAME_LENGTH,
    MAX_TAGS_COUNT,
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

UWAGA: Pole "tips_raw" jest OPCJONALNE - dodaj je TYLKO jeśli źródło zawiera wskazówki. Jeśli brak wskazówek - po prostu POMIŃ to pole w JSON.


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
 * Calls OpenAI Vision API to analyze an image.
 * Returns text description (not JSON).
 */
async function analyzeImageWithVision(
    imageBytes: Uint8Array,
    mimeType: string,
    prompt: string,
): Promise<string> {
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
        throw new ApplicationError("INTERNAL_ERROR", "OpenAI API key not configured");
    }

    // Convert to base64
    const CHUNK_SIZE = 8192;
    let binaryString = "";
    for (let i = 0; i < imageBytes.length; i += CHUNK_SIZE) {
        const chunk = imageBytes.slice(i, i + CHUNK_SIZE);
        binaryString += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binaryString);
    const dataUrl = `data:${mimeType};base64,${base64}`;

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
                model: OPENAI_MODEL, // gpt-4o-mini is multimodal
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: dataUrl } },
                        ],
                    },
                ],
                max_tokens: 500,
                temperature: 0.3,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorBody = await response.text();
            logger.error("OpenAI Vision API error", {
                status: response.status,
                body: errorBody.substring(0, 500),
            });
            throw new ApplicationError("INTERNAL_ERROR", "AI vision service failed");
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new ApplicationError("INTERNAL_ERROR", "AI vision returned empty response");
        }

        return content;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof ApplicationError) throw error;
        logger.error("Vision analysis failed", { error });
        throw new ApplicationError("INTERNAL_ERROR", "Vision analysis failed");
    }
}

/**
 * Extracts visual description of the dish from reference image.
 * Focuses ONLY on the food itself, ignoring background/style.
 */
async function describeDishFromImage(
    referenceImage: ReferenceImageData
): Promise<string> {
    const prompt = `Analyze this food image and describe ONLY the visual appearance of the dish itself.

Focus on:
1. Shape and form of the food (e.g. round cake, stacked pancakes, stew in a bowl)
2. Visible textures (e.g. crispy crust, smooth sauce, fluffy crumb)
3. Key colors of the food elements
4. Visible ingredients and garnishes on the food
5. How the food is arranged/plated (e.g. scattered, piled high, geometric)

CRITICAL INSTRUCTIONS:
- IGNORE the background, table, cutlery, and lighting.
- IGNORE the artistic style of the photo.
- DESCRIBE ONLY THE FOOD OBJECT.
- Be concise and descriptive.`;

    return await analyzeImageWithVision(
        referenceImage.bytes,
        referenceImage.mimeType,
        prompt
    );
}

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
        const errorResponse = llmResponse as {
            is_valid_recipe: false;
            reasons: string[];
        };
        logger.info("LLM determined content is not a valid recipe", {
            userId,
            reasons: errorResponse.reasons,
        });
        return {
            success: false,
            reasons: errorResponse.reasons ||
                ["Content does not appear to be a valid recipe"],
        };
    }

    // Parse successful response
    const successResponse = llmResponse as {
        is_valid_recipe: true;
        draft: AiRecipeDraftDto;
        meta: { confidence: number; warnings: string[] };
    };

    if (!successResponse.draft) {
        logger.error("LLM response missing draft field", { llmResponse });
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "AI service returned incomplete response",
        );
    }

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
 * Builds the image generation prompt for with_reference mode.
 * Uses elegant kitchen/dining aesthetic BUT uses visual description from reference for the food itself.
 *
 * @param recipe - Recipe data
 * @param _language - Output language
 * @param visualDescription - Visual description of the dish from reference image
 * @returns Prompt string for image generation
 */
function buildImagePromptWithReference(
    recipe: GenerateRecipeImageParams["recipe"],
    _language: string,
    visualDescription: string | null,
): string {
    const recipeContext = buildRecipeContext(recipe);

    // If we have a visual description from Vision API, we inject it as a strict instruction for the dish appearance
    const visualInstruction = visualDescription
        ? `\n\nVISUAL DESCRIPTION OF THE DISH (STRICTLY FOLLOW THIS FOR THE FOOD APPEARANCE):\n${visualDescription}\n\nIMPORTANT: Use the visual description above for the LOOK of the food, but place it in the new environment described below.`
        : "";

    const prompt = `You will be generating an image of a dish based on a recipe provided below.

Here is the recipe for the dish you need to photograph:
${recipeContext}${visualInstruction}

Requirements for the image you generate:

WHAT TO INCLUDE:
- The finished dish (matching the visual description above) as the main subject
- An elegant, sophisticated kitchen or dining room setting
- Professional food photography composition with artistic styling
- Refined lighting that makes the food look premium and appetizing
- Elegant props like fine dishware, polished cutlery, marble surfaces, or contemporary table settings

WHAT NOT TO INCLUDE:
- Do not include any text, words, or writing of any kind
- Do not include any logos or brand names
- Do not include any people or parts of people (hands, faces, etc.)

STYLE GUIDELINES (Use OUR style, NOT the reference photo's style):
- Create a completely fresh, original composition
- Use an elegant, upscale aesthetic (modern kitchen or refined dining room)
- Ensure the dish is the clear focal point with sophisticated styling
- Make the image look professional, premium, and restaurant-quality
- Consider interesting angles, perfect depth of field, and artistic plating

CRITICAL INGREDIENT RULES:
- Jeśli w przepisie nie ma nic o posypaniu potrawy pietruszką czy inną zielenią - NIE dodawaj tego do zdjęcia!
- Only include ingredients that are explicitly mentioned in the recipe

Generate the image now based on these instructions.`;

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

    // Step 2: Build the prompt based on mode
    let prompt: string;
    if (resolvedMode === 'recipe_only') {
        prompt = buildImagePromptRecipeOnly(recipe, language);
        logger.debug("Built recipe_only prompt", {
            userId,
            recipeId: recipe.id,
            promptLength: prompt.length,
        });
    } else {
        // with_reference mode
        // 1. Analyze image to get visual description of the food (Vision API)
        let visualDescription: string | null = null;

        if (referenceImage) {
            try {
                logger.info("Analyzing reference image with Vision API", {
                    userId,
                    recipeId: recipe.id,
                });

                visualDescription = await describeDishFromImage(referenceImage);

                logger.info("Visual description extracted", {
                    userId,
                    descriptionLength: visualDescription.length,
                });
            } catch (error) {
                logger.warn("Failed to analyze reference image, falling back to recipe context only", {
                    userId,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
                // Continue without visual description (fallback)
            }
        }

        // 2. Build prompt using the extracted description
        prompt = buildImagePromptWithReference(recipe, language, visualDescription);

        logger.debug("Built with_reference prompt", {
            userId,
            recipeId: recipe.id,
            promptLength: prompt.length,
            hasVisualDescription: !!visualDescription,
        });
    }

    // Step 3: Call OpenAI Images API
    const imageBase64 = await callImageAPI(prompt);

    logger.info("Recipe image generated successfully", {
        userId,
        recipeId: recipe.id,
        mode: resolvedMode,
        imageSize: imageBase64.length,
    });

    // Step 4: Get style contract for the mode
    const styleContract = getStyleContract(resolvedMode);

    // Step 5: Return successful result (webp format from gpt-image-1)
    return {
        success: true,
        data: {
            image: {
                mime_type: "image/webp",
                data_base64: imageBase64,
            },
            meta: {
                mode: resolvedMode,
                style_contract: styleContract,
                warnings: [],
            },
        },
    };
}

// #endregion
