import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { environment } from '../../../../environments/environment';
import {
    AiRecipeDraftRequestDto,
    AiRecipeDraftResponseDto,
    AiRecipeDraftUnprocessableEntityDto,
} from '../../../../../shared/contracts/types';

/**
 * Custom error for AI draft validation failures (422 response)
 */
export class AiDraftValidationError extends Error {
    readonly status = 422;
    readonly reasons: string[];

    constructor(message: string, reasons: string[] = []) {
        super(message);
        this.name = 'AiDraftValidationError';
        this.reasons = reasons;
    }
}

/**
 * Custom error for rate limiting (429 response)
 */
export class AiDraftRateLimitError extends Error {
    readonly status = 429;

    constructor() {
        super('Osiągnięto limit zapytań. Spróbuj ponownie za chwilę.');
        this.name = 'AiDraftRateLimitError';
    }
}

/**
 * Custom error for payload too large (413 response)
 */
export class AiDraftPayloadTooLargeError extends Error {
    readonly status = 413;

    constructor() {
        super('Przesłany obraz jest zbyt duży. Maksymalny rozmiar to 10 MB.');
        this.name = 'AiDraftPayloadTooLargeError';
    }
}

/**
 * Service for generating AI-assisted recipe drafts.
 * Calls Edge Function POST /ai/recipes/draft via supabase.functions.invoke.
 */
@Injectable({
    providedIn: 'root',
})
export class AiRecipeDraftService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Generate a recipe draft from text or image using AI.
     *
     * @param request The draft request with source (text or image)
     * @returns Promise with the generated draft and metadata
     * @throws AiDraftValidationError for 422 responses (not a valid single recipe)
     * @throws AiDraftRateLimitError for 429 responses (rate limit exceeded)
     * @throws AiDraftPayloadTooLargeError for 413 responses (image too large)
     * @throws Error for other failures
     */
    async generateDraft(
        request: AiRecipeDraftRequestDto
    ): Promise<AiRecipeDraftResponseDto> {
        const {
            data: { session },
        } = await this.supabase.auth.getSession();

        if (!session) {
            throw new Error('Brak sesji użytkownika. Zaloguj się ponownie.');
        }

        const functionUrl = `${environment.supabase.url}/functions/v1/ai/recipes/draft`;

        try {
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                    apikey: environment.supabase.anonKey,
                },
                body: JSON.stringify(request),
            });

            // Handle specific error status codes
            if (!response.ok) {
                await this.handleErrorResponse(response);
            }

            const data: AiRecipeDraftResponseDto = await response.json();
            return data;
        } catch (error) {
            // Re-throw known error types
            if (
                error instanceof AiDraftValidationError ||
                error instanceof AiDraftRateLimitError ||
                error instanceof AiDraftPayloadTooLargeError
            ) {
                throw error;
            }

            // Wrap unknown errors
            console.error('AI Draft generation failed:', error);
            throw new Error(
                error instanceof Error
                    ? error.message
                    : 'Wystąpił błąd podczas generowania przepisu. Spróbuj ponownie.'
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
            case 403:
                throw new Error('Brak autoryzacji. Zaloguj się ponownie.');

            case 413:
                throw new AiDraftPayloadTooLargeError();

            case 422: {
                const unprocessableData: AiRecipeDraftUnprocessableEntityDto =
                    await response.json().catch(() => ({
                        message: 'Wklejony materiał nie opisuje pojedynczego przepisu.',
                        reasons: [],
                    }));
                throw new AiDraftValidationError(
                    unprocessableData.message ||
                        'Wklejony materiał nie opisuje pojedynczego przepisu.',
                    unprocessableData.reasons || []
                );
            }

            case 429:
                throw new AiDraftRateLimitError();

            default: {
                const errorData = await response.json().catch(() => ({
                    message: 'Wystąpił błąd podczas przetwarzania przepisu.',
                }));
                throw new Error(
                    errorData.message || 'Wystąpił błąd podczas przetwarzania przepisu.'
                );
            }
        }
    }
}
