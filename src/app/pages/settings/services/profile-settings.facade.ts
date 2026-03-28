import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, Observable, take, throwError } from 'rxjs';
import {
    ApiError,
    ChangePasswordCommand,
    ChangePasswordResponseDto,
    ProfileSettingsDto,
    UpdateProfileSettingsCommand,
} from '../../../../../shared/contracts/types';
import { ProfileSettingsApiService } from '../../../core/services/profile-settings-api.service';

export interface ProfileSettingsFormValue {
    email: string;
    username: string;
    marketingConsent: boolean;
}

@Injectable()
export class ProfileSettingsFacade {
    private readonly profileSettingsApi = inject(ProfileSettingsApiService);

    readonly profile = signal<ProfileSettingsDto | null>(null);
    readonly isInitialLoading = signal<boolean>(true);
    readonly isSavingProfile = signal<boolean>(false);
    readonly loadError = signal<string | null>(null);
    readonly saveError = signal<ApiError | null>(null);
    readonly lastSuccessMessage = signal<string | null>(null);

    readonly canRenderForm = computed<boolean>(
        () => this.profile() !== null && !this.isInitialLoading()
    );

    readonly accountFormInitialValue = computed<ProfileSettingsFormValue | null>(() => {
        const profile = this.profile();
        if (!profile) {
            return null;
        }

        return {
            email: profile.email,
            username: profile.username,
            marketingConsent: profile.marketing_consent,
        };
    });

    loadProfile(): void {
        this.isInitialLoading.set(true);
        this.loadError.set(null);

        this.profileSettingsApi
            .getProfileSettings()
            .pipe(
                take(1),
                finalize(() => this.isInitialLoading.set(false))
            )
            .subscribe({
                next: (profile) => {
                    this.profile.set(this.normalizeProfile(profile));
                },
                error: (error) => {
                    this.loadError.set(this.mapLoadError(error));
                },
            });
    }

    saveProfile(command: UpdateProfileSettingsCommand): void {
        if (this.isSavingProfile()) {
            return;
        }

        this.isSavingProfile.set(true);
        this.saveError.set(null);
        this.lastSuccessMessage.set(null);

        this.profileSettingsApi
            .updateProfileSettings(command)
            .pipe(
                take(1),
                finalize(() => this.isSavingProfile.set(false))
            )
            .subscribe({
                next: (profile) => {
                    this.profile.set(this.normalizeProfile(profile));
                    this.lastSuccessMessage.set('Zmiany profilu zostały zapisane.');
                },
                error: (error) => {
                    this.saveError.set(this.mapSaveError(error));
                },
            });
    }

    changePassword(command: ChangePasswordCommand): Observable<ChangePasswordResponseDto> {
        return this.profileSettingsApi.changePassword(command).pipe(
            take(1),
            catchError((error: unknown) =>
                throwError(() => this.mapChangePasswordError(error))
            )
        );
    }

    private normalizeProfile(profile: ProfileSettingsDto): ProfileSettingsDto {
        return {
            ...profile,
            marketing_consent: profile.marketing_consent ?? false,
            marketing_consent_text_version:
                profile.marketing_consent_text_version ?? null,
            marketing_consent_updated_at: profile.marketing_consent_updated_at ?? null,
        };
    }

    private mapLoadError(error: unknown): string {
        const status = this.getErrorStatus(error);
        if (status === 401) {
            return 'Sesja wygasła. Zaloguj się ponownie.';
        }

        return 'Nie udało się wczytać ustawień profilu.';
    }

    private mapSaveError(error: unknown): ApiError {
        const status = this.getErrorStatus(error);
        if (status === 409) {
            return {
                message: 'Ta nazwa użytkownika jest już zajęta.',
                status,
            };
        }

        if (status === 422) {
            return {
                message: 'Nie udało się zapisać zgody marketingowej. Spróbuj ponownie.',
                status,
            };
        }

        return {
            message:
                this.getErrorMessage(error) ?? 'Nie udało się zapisać zmian profilu.',
            status: status ?? 500,
        };
    }

    private mapChangePasswordError(error: unknown): ApiError {
        const status = this.getErrorStatus(error) ?? 500;
        if (status === 422) {
            return {
                message: 'Podane stare hasło jest niepoprawne.',
                status,
            };
        }

        if (status === 400) {
            return {
                message: 'Nowe hasło nie spełnia wymagań bezpieczeństwa.',
                status,
            };
        }

        if (status === 401) {
            return {
                message: 'Sesja wygasła. Zaloguj się ponownie.',
                status,
            };
        }

        return {
            message:
                this.getErrorMessage(error) ??
                'Nie udało się zmienić hasła. Spróbuj ponownie.',
            status,
        };
    }

    private getErrorStatus(error: unknown): number | null {
        if (typeof error !== 'object' || error === null || !('status' in error)) {
            return null;
        }

        const status = (error as { status?: unknown }).status;
        return typeof status === 'number' ? status : null;
    }

    private getErrorMessage(error: unknown): string | null {
        if (typeof error !== 'object' || error === null || !('message' in error)) {
            return null;
        }

        const message = (error as { message?: unknown }).message;
        return typeof message === 'string' && message.trim().length > 0
            ? message
            : null;
    }
}
