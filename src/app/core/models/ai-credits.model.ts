import {
    AiCreditLimitType,
    AiCreditsExhaustedErrorDto,
} from '../../../../shared/contracts/types';

export type AiCreditType = 'draft' | 'image';
export type AiCreditsIndicatorVariant =
    | 'loading'
    | 'hidden'
    | 'normal'
    | 'warning'
    | 'exhausted';

export interface AiCreditBalance {
    total: number | null;
    used: number | null;
    remaining: number | null;
}

export interface AiCreditsState {
    limitType: AiCreditLimitType;
    draft: AiCreditBalance;
    image: AiCreditBalance;
    nextResetAt: Date | null;
    loading: boolean;
    error: boolean;
}

export interface AiCreditsSettingsViewModel {
    draftProgressValue: number;
    imageProgressValue: number;
    draftLabel: string;
    imageLabel: string;
    draftColor: 'primary' | 'warn';
    imageColor: 'primary' | 'warn';
    draftExhausted: boolean;
    imageExhausted: boolean;
    showUpgradeCta: boolean;
    nextResetFormatted: string | null;
    isLoading: boolean;
    hasError: boolean;
}

export class AiCreditsExhaustedApiError extends Error {
    readonly status = 402;

    constructor(readonly response: AiCreditsExhaustedErrorDto) {
        super(response.message);
        this.name = 'AiCreditsExhaustedApiError';
    }
}
