import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LoginFormComponent } from './components/login-form/login-form.component';
import { AuthService, RESEND_COOLDOWN_SECONDS } from '../../core/services/auth.service';
import { SignInRequestDto } from '../../../../shared/contracts/types';
import { PostAuthRedirectService } from '../../core/services/post-auth-redirect.service';
import { sanitizeNextUrl } from '../../core/utils/post-auth-redirect.util';

interface LoginState {
    isLoading: boolean;
    error: string | null;
    requiresEmailConfirmation: boolean;
    isResending: boolean;
    cooldownRemainingSeconds: number;
    lastEmailUsed: string | null;
    isGoogleLoading: boolean;
    oauthErrorMessage: string | null;
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
    private readonly postAuthRedirect = inject(PostAuthRedirectService);

    private cooldownIntervalId: ReturnType<typeof setInterval> | null = null;

    readonly nextUrl = sanitizeNextUrl(this.route.snapshot.queryParamMap.get('next'));

    state = signal<LoginState>({
        isLoading: false,
        error: null,
        requiresEmailConfirmation: false,
        isResending: false,
        cooldownRemainingSeconds: 0,
        lastEmailUsed: null,
        isGoogleLoading: false,
        oauthErrorMessage: null,
    });

    constructor() {
        const oauthErrorMessage = this.getOauthErrorMessage(
            this.route.snapshot.queryParamMap.get('error'),
        );
        this.state.update((s) => ({ ...s, oauthErrorMessage }));

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

            const returnUrl =
                this.route.snapshot.queryParamMap.get('returnUrl') ??
                this.route.snapshot.queryParamMap.get('redirectTo');
            const safeRedirectUrl =
                this.nextUrl ??
                this.validateRedirectUrl(returnUrl) ??
                this.postAuthRedirect.consume() ??
                '/dashboard';

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
            const result = await this.authService.resendVerificationEmail(email, callbackUrl);

            if (result.success) {
                this.snackBar.open('Wysłaliśmy nowy link aktywacyjny na Twój adres e-mail.', 'OK', {
                    duration: 5000,
                });
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

    async handleGoogleLogin(): Promise<void> {
        this.state.update((s) => ({
            ...s,
            isGoogleLoading: true,
            oauthErrorMessage: null,
        }));

        try {
            this.postAuthRedirect.save(this.nextUrl);
            await this.authService.signInWithGoogle();
        } catch (error) {
            console.error('[LoginPageComponent] Google OAuth initialization failed:', error);
            this.state.update((s) => ({
                ...s,
                oauthErrorMessage: 'Logowanie przez Google jest chwilowo niedostępne.',
            }));
        } finally {
            this.state.update((s) => ({ ...s, isGoogleLoading: false }));
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
            'Email not confirmed': 'Potwierdź adres e-mail, aby się zalogować.',
            'Invalid email or password': 'Nieprawidłowy e-mail lub hasło.',
        };

        return errorMessages[message] ?? message;
    }

    private getOauthErrorMessage(errorCode: string | null): string | null {
        const errorMessages: Record<string, string> = {
            access_denied: 'Anulowano logowanie przez Google.',
            oauth_error:
                'Wystąpił błąd podczas logowania przez Google. Spróbuj ponownie. ' + errorCode,
            timeout: 'Przekroczono czas oczekiwania. Spróbuj ponownie.',
            profile_error: 'Wystąpił błąd podczas ładowania profilu. Zaloguj się ponownie.',
        };

        if (!errorCode || !(errorCode in errorMessages)) {
            return null;
        }

        return errorMessages[errorCode];
    }

    private validateRedirectUrl(url: string | null): string | null {
        if (!url) {
            return null;
        }

        const isValidRelativePath =
            url.startsWith('/') &&
            !url.startsWith('//') &&
            !url.includes('://') &&
            !url.includes('\\');

        if (!isValidRelativePath) {
            console.warn('Invalid redirect URL detected:', url);
            return null;
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
