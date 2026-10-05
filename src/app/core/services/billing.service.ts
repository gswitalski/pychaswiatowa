import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';

import type { ApiError, GetBillingPaymentsResponseDto } from '../../../../shared/contracts/types';
import { SupabaseService } from './supabase.service';

@Injectable({
    providedIn: 'root',
})
export class BillingService {
    private readonly supabase = inject(SupabaseService);

    getPayments(limit = 20): Observable<GetBillingPaymentsResponseDto> {
        return from(
            this.supabase.functions.invoke<GetBillingPaymentsResponseDto>(
                `billing/payments?limit=${encodeURIComponent(limit.toString())}`,
                {
                    method: 'GET',
                },
            ),
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error);
                }

                if (!response.data) {
                    throw this.mapError({ message: 'Nie otrzymano historii płatności.' }, 500);
                }

                return response.data;
            }),
        );
    }

    private mapError(error: unknown, fallbackStatus = 500): ApiError {
        if (!error || typeof error !== 'object') {
            return {
                message: 'Nie udało się pobrać historii płatności.',
                status: fallbackStatus,
            };
        }

        const errorRecord = error as Record<string, unknown>;
        const context = errorRecord['context'];
        const contextStatus =
            context && typeof context === 'object'
                ? (context as Record<string, unknown>)['status']
                : undefined;
        const message =
            typeof errorRecord['message'] === 'string' && errorRecord['message'].trim().length > 0
                ? errorRecord['message']
                : 'Nie udało się pobrać historii płatności.';
        const status =
            typeof contextStatus === 'number'
                ? contextStatus
                : typeof errorRecord['status'] === 'number'
                  ? errorRecord['status']
                  : fallbackStatus;

        return { message, status };
    }
}
