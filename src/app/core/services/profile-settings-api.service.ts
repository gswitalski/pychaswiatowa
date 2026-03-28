import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
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
                    throw new Error(response.error.message);
                }
                if (!response.data) {
                    throw new Error('Profile settings not found');
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
                    throw new Error(response.error.message);
                }
                if (!response.data) {
                    throw new Error('Failed to update profile settings');
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
                    throw new Error(response.error.message);
                }
                if (!response.data) {
                    throw new Error('Failed to change password');
                }
                return response.data;
            })
        );
    }
}
