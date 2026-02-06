import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoginFormComponent } from './components/login-form/login-form.component';
import {
    AuthService,
    RESEND_COOLDOWN_SECONDS,
} from '../../core/services/auth.service';
import { SignInRequestDto } from '../../../../shared/contracts/types';

interface LoginState {
    isLoading: boolean;
    error: string | null;
    requiresEmailConfirmation: boolean;
    isResending: boolean;
    cooldownRemainingSeconds: number;
    lastEmailUsed: string | null;
}

@Component({
    selector: 'pych-login-page',
    standalone: true,
    imports: [LoginFormComponent, MatSnackBarModule],
    templateUrl: './login-page.component.html',
    styleUrl: './login-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    private cooldownIntervalId: ReturnType<typeof setInterval> | null = null;

    state = signal<LoginState>({
        isLoading: false,
        error: null,
        requiresEmailConfirmation: false,
        isResending: false,
        cooldownRemainingSeconds: 0,
        lastEmailUsed: null,
    });

    constructor() {
        this.destroyRef.onDestroy(() => {
            this.clearCooldownInterval();
        });
    }

    async handleLogin(credentials: SignInRequestDto): Promise<void> {
        this.state.update((s) => ({
            ...s,
            isLoading: true,
            error: null,
            requiresEmailConfirmation: false,
            lastEmailUsed: credentials.email,
        }));

        try {
            await this.authService.signIn(credentials.email, credentials.password);

            // Get redirect URL from query params and validate it
            const returnUrl =
                this.route.snapshot.queryParamMap.get('returnUrl') ??
                this.route.snapshot.queryParamMap.get('redirectTo');
            const safeRedirectUrl = this.validateRedirectUrl(returnUrl);

            this.router.navigateByUrl(safeRedirectUrl);
        } catch (error) {
            const { message, requiresEmailConfirmation } = this.parseError(error);
            this.state.update((s) => ({
                ...s,
                error: message,
                requiresEmailConfirmation,
            }));
        } finally {
            this.state.update((s) => ({ ...s, isLoading: false }));
        }
    }

    async handleResendVerification(email: string): Promise<void> {
        this.state.update((s) => ({ ...s, isResending: true, error: null }));

        try {
            const callbackUrl = `${window.location.origin}/auth/callback`;
            const result = await this.authService.resendVerificationEmail(
                email,
                callbackUrl
            );

            if (result.success) {
                this.snackBar.open(
                    'Wysłaliśmy nowy link aktywacyjny na Twój adres e-mail.',
                    'OK',
                    { duration: 5000 }
                );
                this.startCooldown();
            } else {
                this.state.update((s) => ({
                    ...s,
                    error: result.error ?? 'Nie udało się wysłać e-maila.',
                }));
            }
        } catch {
            this.state.update((s) => ({
                ...s,
                error: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
            }));
        } finally {
            this.state.update((s) => ({ ...s, isResending: false }));
        }
    }

    private parseError(error: unknown): {
        message: string;
        requiresEmailConfirmation: boolean;
    } {
        if (error && typeof error === 'object' && 'message' in error) {
            const err = error as { message: string };
            const isEmailNotConfirmed =
                err.message === 'Email not confirmed' ||
                err.message.toLowerCase().includes('email not confirmed');

            return {
                message: this.translateErrorMessage(err.message),
                requiresEmailConfirmation: isEmailNotConfirmed,
            };
        }

        return {
            message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.',
            requiresEmailConfirmation: false,
        };
    }

    private translateErrorMessage(message: string): string {
        const errorMessages: Record<string, string> = {
            'Invalid login credentials': 'Nieprawidłowy e-mail lub hasło.',
            'Email not confirmed':
                'Potwierdź adres e-mail, aby się zalogować.',
            'Invalid email or password': 'Nieprawidłowy e-mail lub hasło.',
        };

        return errorMessages[message] ?? message;
    }

    private validateRedirectUrl(url: string | null): string {
        const defaultUrl = '/dashboard';

        if (!url) {
            return defaultUrl;
        }

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

    private startCooldown(): void {
        this.clearCooldownInterval();

        this.state.update((s) => ({
            ...s,
            cooldownRemainingSeconds: RESEND_COOLDOWN_SECONDS,
        }));

        this.cooldownIntervalId = setInterval(() => {
            this.state.update((s) => {
                const remaining = s.cooldownRemainingSeconds - 1;
                if (remaining <= 0) {
                    this.clearCooldownInterval();
                    return { ...s, cooldownRemainingSeconds: 0 };
                }
                return { ...s, cooldownRemainingSeconds: remaining };
            });
        }, 1000);
    }

    private clearCooldownInterval(): void {
        if (this.cooldownIntervalId !== null) {
            clearInterval(this.cooldownIntervalId);
            this.cooldownIntervalId = null;
        }
    }
}

