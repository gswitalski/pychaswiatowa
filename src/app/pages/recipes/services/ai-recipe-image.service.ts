import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { environment } from '../../../../environments/environment';
import {
    AiRecipeImageRequestDto,
    AiRecipeImageResponseDto,
    AiRecipeImageUnprocessableEntityDto,
} from '../../../../../shared/contracts/types';

/**
 * Custom error for AI image validation failures (422 response)
 */
export class AiImageValidationError extends Error {
    readonly status = 422;
    readonly reasons: string[];

    constructor(message: string, reasons: string[] = []) {
        super(message);
        this.name = 'AiImageValidationError';
        this.reasons = reasons;
    }
}

/**
 * Custom error for rate limiting (429 response)
 */
export class AiImageRateLimitError extends Error {
    readonly status = 429;

    constructor() {
        super('Osiągnięto limit zapytań. Spróbuj ponownie za chwilę.');
        this.name = 'AiImageRateLimitError';
    }
}

/**
 * Custom error for premium feature access (403 response)
 */
export class AiImagePremiumRequiredError extends Error {
    readonly status = 403;

    constructor() {
        super('Generowanie zdjęć AI jest dostępne tylko dla użytkowników Premium.');
        this.name = 'AiImagePremiumRequiredError';
    }
}

/** Timeout for image generation in milliseconds (60 seconds) */
const GENERATION_TIMEOUT_MS = 60 * 1000;

/**
 * Service for generating AI-assisted recipe images.
 * Calls Edge Function POST /ai/recipes/image via fetch.
 */
@Injectable({
    providedIn: 'root',
})
export class AiRecipeImageService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Generate a recipe image using AI.
     *
     * @param request The image generation request with recipe data
     * @returns Promise with the generated image and metadata
     * @throws AiImageValidationError for 422 responses (cannot generate sensible image)
     * @throws AiImageRateLimitError for 429 responses (rate limit exceeded)
     * @throws AiImagePremiumRequiredError for 403 responses (premium required)
     * @throws Error for other failures
     */
    async generateImage(
        request: AiRecipeImageRequestDto
    ): Promise<AiRecipeImageResponseDto> {
        const {
            data: { session },
        } = await this.supabase.auth.getSession();

        if (!session) {
            throw new Error('Brak sesji użytkownika. Zaloguj się ponownie.');
        }

        const functionUrl = `${environment.supabase.url}/functions/v1/ai/recipes/image`;

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

        try {
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(request),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Handle specific error status codes
            if (!response.ok) {
                await this.handleErrorResponse(response);
            }

            const data: AiRecipeImageResponseDto = await response.json();
            return data;
        } catch (error) {
            clearTimeout(timeoutId);

            // Handle abort (timeout)
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw new Error('Generowanie zdjęcia trwało zbyt długo. Spróbuj ponownie.');
            }

            // Re-throw known error types
            if (
                error instanceof AiImageValidationError ||
                error instanceof AiImageRateLimitError ||
                error instanceof AiImagePremiumRequiredError
            ) {
                throw error;
            }

            // Wrap unknown errors
            console.error('AI Image generation failed:', error);
            throw new Error(
                error instanceof Error
                    ? error.message
                    : 'Wystąpił błąd podczas generowania zdjęcia. Spróbuj ponownie.'
            );
        }
    }

    /**
     * Handle error response from API
     */
    private async handleErrorResponse(response: Response): Promise<never> {
        const status = response.status;

        switch (status) {
            case 401:
                throw new Error('Brak autoryzacji. Zaloguj się ponownie.');

            case 403:
                throw new AiImagePremiumRequiredError();

            case 422:
                const unprocessableData: AiRecipeImageUnprocessableEntityDto =
                    await response.json().catch(() => ({
                        message: 'Nie udało się wygenerować sensownego zdjęcia dla tego przepisu.',
                        reasons: [],
                    }));
                throw new AiImageValidationError(
                    unprocessableData.message ||
                        'Nie udało się wygenerować sensownego zdjęcia dla tego przepisu.',
                    unprocessableData.reasons || []
                );

            case 429:
                throw new AiImageRateLimitError();

            default:
                const errorData = await response.json().catch(() => ({
                    message: 'Wystąpił błąd podczas generowania zdjęcia.',
                }));
                throw new Error(
                    errorData.message || 'Wystąpił błąd podczas generowania zdjęcia.'
                );
        }
    }
}

