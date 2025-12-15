import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RegisterFormComponent } from './components/register-form/register-form.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../../../shared/contracts/types';

interface RegisterState {
    isLoading: boolean;
    error: ApiError | null;
}

@Component({
    selector: 'pych-register-page',
    standalone: true,
    imports: [RegisterFormComponent],
    templateUrl: './register-page.component.html',
    styleUrl: './register-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    state = signal<RegisterState>({
        isLoading: false,
        error: null,
    });

    async onRegisterSubmit(formData: {
        email: string;
        displayName: string;
        password: string;
    }): Promise<void> {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        try {
            await this.authService.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        username: formData.displayName,
                    },
                },
            });

            // Get redirect URL from query params and validate it
            const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
            const safeRedirectUrl = this.validateRedirectUrl(redirectTo);
            
            this.router.navigateByUrl(safeRedirectUrl);
        } catch (error) {
            const apiError = this.parseError(error);
            this.state.update((s) => ({ ...s, error: apiError }));
        } finally {
            this.state.update((s) => ({ ...s, isLoading: false }));
        }
    }

    private parseError(error: unknown): ApiError {
        if (error && typeof error === 'object' && 'message' in error) {
            const err = error as { message: string; status?: number };
            return {
                message: this.translateErrorMessage(err.message),
                status: err.status ?? 500,
            };
        }

        return {
            message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
            status: 500,
        };
    }

    private translateErrorMessage(message: string): string {
        const errorMessages: Record<string, string> = {
            'User already registered':
                'Użytkownik o tym adresie e-mail już istnieje.',
            'Invalid email': 'Niepoprawny adres e-mail.',
            'Password should be at least 6 characters':
                'Hasło musi mieć co najmniej 6 znaków.',
        };

        return errorMessages[message] ?? message;
    }

    /**
     * Validates redirect URL to prevent open redirect vulnerabilities.
     * Only allows relative paths within the application.
     * 
     * @param url - The URL to validate
     * @returns Safe redirect URL or default '/dashboard'
     */
    private validateRedirectUrl(url: string | null): string {
        // Default fallback
        const defaultUrl = '/dashboard';

        if (!url) {
            return defaultUrl;
        }

        // Security checks: only allow relative paths
        // Must start with '/' but not '//' (protocol-relative URL)
        // Must not contain protocol (http:, https:, etc.)
        const isValidRelativePath = 
            url.startsWith('/') && 
            !url.startsWith('//') && 
            !url.includes('://');

        if (!isValidRelativePath) {
            console.warn('Invalid redirect URL detected, using default:', url);
            return defaultUrl;
        }

        return url;
    }
}
