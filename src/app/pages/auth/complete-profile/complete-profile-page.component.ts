import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { MARKETING_CONSENT_TEXT_VERSION } from '../../../../../shared/contracts/marketing-consent';
import type { ApiError } from '../../../../../shared/contracts/types';
import { Router } from '@angular/router';
import { ProfileCompletionService } from '../../../core/services/profile-completion.service';
import { ProfileSettingsApiService } from '../../../core/services/profile-settings-api.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CompleteProfileFormComponent } from './components/complete-profile-form/complete-profile-form.component';

interface CompleteProfileState {
    isLoadingSession: boolean;
    googleEmail: string | null;
    isSaving: boolean;
    serverError: string | null;
}

@Component({
    selector: 'pych-complete-profile-page',
    standalone: true,
    imports: [
        MatCardModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        CompleteProfileFormComponent,
    ],
    templateUrl: './complete-profile-page.component.html',
    styleUrl: './complete-profile-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompleteProfilePageComponent implements OnInit {
    private readonly supabase = inject(SupabaseService);
    private readonly profileSettingsApi = inject(ProfileSettingsApiService);
    private readonly profileCompletion = inject(ProfileCompletionService);
    private readonly router = inject(Router);
    private readonly snackBar = inject(MatSnackBar);

    public readonly state = signal<CompleteProfileState>({
        isLoadingSession: true,
        googleEmail: null,
        isSaving: false,
        serverError: null,
    });

    public ngOnInit(): void {
        void this.initialize();
    }

    public async handleSave(username: string): Promise<void> {
        const normalizedUsername = username.trim();
        if (!normalizedUsername) {
            return;
        }

        this.state.update((state) => ({
            ...state,
            isSaving: true,
            serverError: null,
        }));

        try {
            await firstValueFrom(
                this.profileSettingsApi.updateProfileSettings({
                    username: normalizedUsername,
                    marketing_consent: false,
                    marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION,
                })
            );
            this.profileCompletion.markComplete();
            await this.router.navigate(['/dashboard']);
        } catch (error) {
            const apiError = error as Partial<ApiError>;
            if (apiError.status === 401) {
                this.snackBar.open('Sesja wygasła. Zaloguj się ponownie.', 'OK', {
                    duration: 5000,
                });
                await this.router.navigate(['/login']);
                return;
            }

            this.state.update((state) => ({
                ...state,
                serverError:
                    apiError.status === 409
                        ? 'Ta nazwa użytkownika jest już zajęta.'
                        : apiError.message ?? 'Wystąpił błąd. Spróbuj ponownie.',
            }));
        } finally {
            this.state.update((state) => ({ ...state, isSaving: false }));
        }
    }

    private async initialize(): Promise<void> {
        try {
            const [{ data, error }, isProfileComplete] = await Promise.all([
                this.supabase.auth.getUser(),
                this.profileCompletion.ensureChecked(),
            ]);

            if (error || !data.user) {
                await this.router.navigate(['/login']);
                return;
            }

            if (isProfileComplete) {
                await this.router.navigate(['/dashboard']);
                return;
            }

            this.state.update((state) => ({
                ...state,
                googleEmail: data.user.email ?? null,
            }));
        } catch {
            this.state.update((state) => ({
                ...state,
                serverError: 'Nie udało się załadować danych profilu. Spróbuj ponownie.',
            }));
        } finally {
            this.state.update((state) => ({ ...state, isLoadingSession: false }));
        }
    }
}
