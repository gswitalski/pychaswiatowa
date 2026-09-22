import { Injectable, Signal, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, from, map, tap } from 'rxjs';

import {
    AiCreditBalanceDto,
    AiCreditsResponseDto,
    MeAiCreditsDto,
} from '../../../../shared/contracts/types';
import {
    AiCreditBalance,
    AiCreditsState,
    AiCreditType,
} from '../models/ai-credits.model';
import { SupabaseService } from './supabase.service';

@Injectable({
    providedIn: 'root',
})
export class AiCreditsService {
    private readonly supabase = inject(SupabaseService);
    private readonly creditsState = signal<AiCreditsState | null>(null);

    readonly credits: Signal<AiCreditsState | null> = this.creditsState.asReadonly();

    loadCredits(): Observable<AiCreditsState> {
        this.creditsState.update((state) =>
            state ? { ...state, loading: true, error: false } : state
        );

        return from(
            this.supabase.functions.invoke<AiCreditsResponseDto>('ai/credits', {
                method: 'GET',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw response.error;
                }

                if (!response.data) {
                    throw new Error('Nie otrzymano stanu kredytów AI.');
                }

                return this.mapResponseToState(response.data);
            }),
            tap((state) => this.creditsState.set(state)),
            catchError((error: unknown) => {
                console.error('[AiCreditsService] Nie udało się pobrać kredytów AI:', error);
                this.creditsState.update((state) =>
                    state ? { ...state, loading: false, error: true } : state
                );
                return EMPTY;
            })
        );
    }

    bootstrapFromMeResponse(meCredits: MeAiCreditsDto | null): void {
        if (!meCredits) {
            this.creditsState.set(null);
            return;
        }

        this.creditsState.set({
            limitType: meCredits.limit_type,
            draft: this.createBootstrapBalance(meCredits.draft_remaining),
            image: this.createBootstrapBalance(meCredits.image_remaining),
            nextResetAt: this.parseDate(meCredits.next_reset_at),
            loading: true,
            error: false,
        });
    }

    refreshCredits(): void {
        this.loadCredits().subscribe();
    }

    isExhausted(type: AiCreditType): boolean {
        const state = this.creditsState();

        if (!state || state.loading || state.error || state.limitType === 'unlimited') {
            return false;
        }

        return state[type].remaining === 0;
    }

    private mapResponseToState(response: AiCreditsResponseDto): AiCreditsState {
        return {
            limitType: response.limit_type,
            draft: this.mapBalance(response.draft),
            image: this.mapBalance(response.image),
            nextResetAt: this.parseDate(response.next_reset_at),
            loading: false,
            error: false,
        };
    }

    private mapBalance(balance: AiCreditBalanceDto): AiCreditBalance {
        return {
            total: balance.total,
            used: balance.used,
            remaining: balance.remaining,
        };
    }

    private createBootstrapBalance(remaining: number | null): AiCreditBalance {
        return {
            total: null,
            used: null,
            remaining,
        };
    }

    private parseDate(value: string | null): Date | null {
        if (!value) {
            return null;
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
}
