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
   - ZACHOWAJ notacje Thermomix bez zmian: "5 s/obr. 5", "6 min/120°C/obr. 1", "32 min/100°C/obr. 5"
   - wykrywaj nagłówki w sekcji kroków i przed nimi umieszczaj znak #
   - Lista NIE MOŻE być pusta

5. KATEGORIA (category_name):
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
    "category_name": "Obiad",
    "tags": ["tag1", "tag2", "tag3"]
  },
  "meta": {
    "confidence": 0.95,
    "warnings": ["Opcjonalne ostrzeżenia o jakości danych"]
  }
}


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
 * Style contract constants - these define the visual style guidelines
 * that the generated image must adhere to.
 */
const IMAGE_STYLE_CONTRACT = {
    photorealistic: true,
    rustic_table: true,
    natural_light: true,
    no_people: true,
    no_text: true,
    no_watermark: true,
} as const;

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
 * Builds the image generation prompt for OpenAI Images API.
 * Follows the style contract guidelines.
 *
 * @param recipe - Recipe data
 * @param language - Output language
 * @returns Prompt string for image generation
 */
function buildImagePrompt(
    recipe: GenerateRecipeImageParams["recipe"],
    _language: string,
): string {
    const ingredientsSummary = buildIngredientsSummary(recipe.ingredients);

    // Build dish description
    let dishDescription = recipe.name;
    if (recipe.description) {
        dishDescription += `. ${recipe.description}`;
    }
    if (recipe.category_name) {
        dishDescription += ` (${recipe.category_name})`;
    }

    // Add termorobot context if applicable
    const cookingMethod = recipe.is_termorobot
        ? "prepared using a kitchen robot (Thermomix-style)"
        : "";

    // Build the prompt with style contract requirements
    const prompt = `Professional food photography of ${dishDescription}.

Main ingredients visible: ${ingredientsSummary}.
${cookingMethod}

STYLE REQUIREMENTS (MUST FOLLOW):
- Photorealistic, high-quality food photography
- Served on a rustic wooden table with natural textures
- Soft, natural daylight illumination from the side
- Shallow depth of field, dish in sharp focus
- NO people, NO hands, NO human body parts visible
- NO text, NO labels, NO watermarks, NO logos
- NO artificial overlays or graphic elements
- Clean, appetizing presentation
- Shot from a 45-degree angle, slightly above

The image should look like it belongs in a premium cookbook or food magazine.`;

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
 * @param params - Generation parameters including recipe data
 * @returns ImageGenerationResult with either success data or failure reasons
 * @throws ApplicationError for infrastructure/configuration errors
 */
export async function generateRecipeImage(
    params: GenerateRecipeImageParams,
): Promise<ImageGenerationResult> {
    const { userId, recipe, language } = params;

    logger.info("Starting recipe image generation", {
        userId,
        recipeId: recipe.id,
        recipeName: recipe.name,
        language,
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

    // Step 2: Build the prompt
    const prompt = buildImagePrompt(recipe, language);

    logger.debug("Built image generation prompt", {
        userId,
        recipeId: recipe.id,
        promptLength: prompt.length,
    });

    // Step 3: Call OpenAI Images API (gpt-image-1 with webp output)
    const imageBase64 = await callImageAPI(prompt);

    logger.info("Recipe image generated successfully", {
        userId,
        recipeId: recipe.id,
        imageSize: imageBase64.length,
    });

    // Step 4: Return successful result (webp format from gpt-image-1)
    return {
        success: true,
        data: {
            image: {
                mime_type: "image/webp",
                data_base64: imageBase64,
            },
            meta: {
                style_contract: IMAGE_STYLE_CONTRACT,
                warnings: [],
            },
        },
    };
}

// #endregion
