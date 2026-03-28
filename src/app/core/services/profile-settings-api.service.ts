import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    ApiError,
    ChangePasswordCommand,
    ChangePasswordResponseDto,
    ProfileSettingsDto,
    UpdateProfileSettingsCommand,
} from '../../../../shared/contracts/types';

@Injectable({
    providedIn: 'root',
})
export class ProfileSettingsApiService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Pobiera komplet ustawień profilu dla widoku /settings.
     */
    getProfileSettings(): Observable<ProfileSettingsDto> {
        return from(
            this.supabase.functions.invoke<ProfileSettingsDto>('profile', {
                method: 'GET',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error);
                }
                if (!response.data) {
                    throw this.mapError({ message: 'Profile settings not found' }, 404);
                }
                return response.data;
            })
        );
    }

    /**
     * Aktualizuje ustawienia profilu (username + zgoda marketingowa).
     */
    updateProfileSettings(
        command: UpdateProfileSettingsCommand
    ): Observable<ProfileSettingsDto> {
        return from(
            this.supabase.functions.invoke<ProfileSettingsDto>('profile', {
                method: 'PUT',
                body: command,
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error);
                }
                if (!response.data) {
                    throw this.mapError(
                        { message: 'Failed to update profile settings' },
                        500
                    );
                }
                return response.data;
            })
        );
    }

    /**
     * Zmienia hasło zalogowanego użytkownika.
     */
    changePassword(
        command: ChangePasswordCommand
    ): Observable<ChangePasswordResponseDto> {
        return from(
            this.supabase.functions.invoke<ChangePasswordResponseDto>(
                'profile/change-password',
                {
                    method: 'POST',
                    body: command,
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error);
                }
                if (!response.data) {
                    throw this.mapError({ message: 'Failed to change password' }, 500);
                }
                return response.data;
            })
        );
    }

    private mapError(error: unknown, fallbackStatus = 500): ApiError {
        if (!error || typeof error !== 'object') {
            return {
                message: 'Wystąpił nieoczekiwany błąd.',
                status: fallbackStatus,
            };
        }

        const errorRecord = error as Record<string, unknown>;
        const message =
            typeof errorRecord['message'] === 'string' &&
            errorRecord['message'].trim().length > 0
                ? errorRecord['message']
                : 'Wystąpił nieoczekiwany błąd.';

        const status =
            typeof errorRecord['status'] === 'number'
                ? errorRecord['status']
                : fallbackStatus;

        return { message, status };
    }
}
