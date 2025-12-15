import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoginFormComponent } from './components/login-form/login-form.component';
import { AuthService } from '../../core/services/auth.service';
import { SignInRequestDto } from '../../../../shared/contracts/types';

interface LoginState {
    isLoading: boolean;
    error: string | null;
}

@Component({
    selector: 'pych-login-page',
    standalone: true,
    imports: [LoginFormComponent],
    templateUrl: './login-page.component.html',
    styleUrl: './login-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    state = signal<LoginState>({
        isLoading: false,
        error: null,
    });

    async handleLogin(credentials: SignInRequestDto): Promise<void> {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        try {
            await this.authService.signIn(credentials.email, credentials.password);
            
            // Get redirect URL from query params and validate it
            const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
            const safeRedirectUrl = this.validateRedirectUrl(redirectTo);
            
            this.router.navigateByUrl(safeRedirectUrl);
        } catch (error) {
            const errorMessage = this.parseError(error);
            this.state.update((s) => ({ ...s, error: errorMessage }));
        } finally {
            this.state.update((s) => ({ ...s, isLoading: false }));
        }
    }

    private parseError(error: unknown): string {
        if (error && typeof error === 'object' && 'message' in error) {
            const err = error as { message: string };
            return this.translateErrorMessage(err.message);
        }

        return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.';
    }

    private translateErrorMessage(message: string): string {
        const errorMessages: Record<string, string> = {
            'Invalid login credentials': 'Nieprawidłowy e-mail lub hasło.',
            'Email not confirmed': 'Adres e-mail nie został potwierdzony.',
            'Invalid email or password': 'Nieprawidłowy e-mail lub hasło.',
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

