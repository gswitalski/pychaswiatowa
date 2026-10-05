import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';

import type { ApiError, MeDto } from '../../../../shared/contracts/types';
import { SupabaseService } from './supabase.service';

@Injectable({
    providedIn: 'root',
})
export class MeApiService {
    private readonly supabase = inject(SupabaseService);

    getMe(): Observable<MeDto> {
        return from(
            this.supabase.functions.invoke<MeDto>('me', {
                method: 'GET',
            }),
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error);
                }

                if (!response.data) {
                    throw this.mapError({ message: 'Nie otrzymano danych użytkownika.' }, 500);
                }

                return response.data;
            }),
        );
    }

    private mapError(error: unknown, fallbackStatus = 500): ApiError {
        if (!error || typeof error !== 'object') {
            return {
                message: 'Nie udało się pobrać danych użytkownika.',
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
                : 'Nie udało się pobrać danych użytkownika.';
        const status =
            typeof contextStatus === 'number'
                ? contextStatus
                : typeof errorRecord['status'] === 'number'
                  ? errorRecord['status']
                  : fallbackStatus;

        return { message, status };
    }
}
