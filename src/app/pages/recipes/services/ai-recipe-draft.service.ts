import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../../core/services/supabase.service';
import { environment } from '../../../../environments/environment';
import {
    AiCreditsExhaustedErrorDto,
    AiRecipeDraftRequestDto,
    AiRecipeDraftResponseDto,
    AiRecipeDraftUnprocessableEntityDto,
} from '../../../../../shared/contracts/types';
import { AiCreditsExhaustedApiError } from '../../../core/models/ai-credits.model';

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

export type UrlDraftErrorCode =
    | 'INVALID_URL'
    | 'URL_INVALID_HOST'
    | 'URL_FETCH_FAILED'
    | 'URL_TIMEOUT'
    | 'URL_CONTENT_TOO_LARGE';

export class AiDraftUrlError extends Error {
    readonly status: number;
    readonly code: UrlDraftErrorCode;

    constructor(code: UrlDraftErrorCode, message: string, status: number) {
        super(message);
        this.name = 'AiDraftUrlError';
        this.code = code;
        this.status = status;
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
     * @throws AiCreditsExhaustedApiError for 402 responses (credit pool exhausted)
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
                error instanceof AiDraftPayloadTooLargeError ||
                error instanceof AiDraftUrlError ||
                error instanceof AiCreditsExhaustedApiError
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

            case 402: {
                const exhaustedData: AiCreditsExhaustedErrorDto =
                    await response.json().catch(() => ({
                        error: 'AI_CREDITS_EXHAUSTED',
                        message: 'Wyczerpano pulę kredytów AI.',
                        details: {
                            credit_type: 'draft',
                            credits_used: 0,
                            credits_total: 0,
                            limit_type: 'lifetime',
                            next_reset_at: null,
                            upgrade_url: '/pricing',
                        },
                    }));
                throw new AiCreditsExhaustedApiError(exhaustedData);
            }

            case 413:
                throw new AiDraftPayloadTooLargeError();

            case 400:
            case 422: {
                const errorData = await response.json().catch(() => ({}));
                const urlCode = this.urlErrorCode(errorData.error);

                if (urlCode) {
                    throw new AiDraftUrlError(
                        urlCode,
                        this.urlErrorMessage(urlCode),
                        status,
                    );
                }

                const unprocessableData = errorData as AiRecipeDraftUnprocessableEntityDto;
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

    private urlErrorCode(value: unknown): UrlDraftErrorCode | null {
        const codes: UrlDraftErrorCode[] = [
            'INVALID_URL',
            'URL_INVALID_HOST',
            'URL_FETCH_FAILED',
            'URL_TIMEOUT',
            'URL_CONTENT_TOO_LARGE',
        ];

        return typeof value === 'string' && codes.includes(value as UrlDraftErrorCode)
            ? (value as UrlDraftErrorCode)
            : null;
    }

    private urlErrorMessage(code: UrlDraftErrorCode): string {
        const messages: Record<UrlDraftErrorCode, string> = {
            INVALID_URL:
                'Podany adres jest nieprawidłowy. Sprawdź, czy link zaczyna się od https://.',
            URL_INVALID_HOST:
                'Adres wskazuje na niedozwolony zasób. Spróbuj z innym linkiem.',
            URL_FETCH_FAILED:
                'Nie udało się pobrać strony. Sprawdź, czy adres jest dostępny publicznie, lub skopiuj treść przepisu ręcznie i użyj trybu Tekst.',
            URL_TIMEOUT:
                'Czas oczekiwania na stronę minął. Spróbuj ponownie lub użyj trybu Tekst.',
            URL_CONTENT_TOO_LARGE:
                'Strona jest zbyt duża, aby ją przetworzyć. Skopiuj treść przepisu i użyj trybu Tekst.',
        };

        return messages[code];
    }
}
