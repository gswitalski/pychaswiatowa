import { Injectable, inject, signal } from '@angular/core';
import { AuthResponse, AuthError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { AiCreditsService } from './ai-credits.service';
import {
    SignUpRequestDto,
    AppRole,
    MeDto,
} from '../../../../shared/contracts/types';
import { extractAppRoleFromJwt } from '../utils/jwt.utils';

/** Cooldown w sekundach dla ponownego wysłania linku weryfikacyjnego */
export const RESEND_COOLDOWN_SECONDS = 60;

export interface ResendVerificationResult {
    success: boolean;
    error?: string;
}

/**
 * ViewModel for auth session state
 */
export interface AuthSessionViewModel {
    isAuthenticated: boolean;
    userId: string | null;
    appRole: AppRole;
}

interface SupabaseSignUpMetadata {
    username: string;
    marketing_consent_accepted: boolean;
    marketing_consent_text_version: string | null;
}

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly supabase = inject(SupabaseService);
    private readonly aiCreditsService = inject(AiCreditsService);

    /** Signal indicating if user is authenticated */
    readonly isAuthenticated = signal<boolean>(false);

    /** Signal with current user's ID (null if not authenticated) */
    readonly userId = signal<string | null>(null);

    /** Signal with current user's app role */
    readonly appRole = signal<AppRole>('user');

    /** Flag to prevent multiple initializations */
    private initialized = false;

    async signUp(
        credentials: SignUpRequestDto,
        redirectTo?: string
    ): Promise<AuthResponse> {
        const metadata = this.mapSignUpRequestToSupabaseMetadata(credentials);

        const { data, error } = await this.supabase.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: {
                data: metadata,
                emailRedirectTo: redirectTo,
            },
        });

        if (error) {
            throw error;
        }

        return { data, error: null };
    }

    private mapSignUpRequestToSupabaseMetadata(
        credentials: SignUpRequestDto
    ): SupabaseSignUpMetadata {
        return {
            username: credentials.username,
            marketing_consent_accepted: credentials.marketing_consent.accepted,
            marketing_consent_text_version:
                credentials.marketing_consent.text_version,
        };
    }

    async signIn(email: string, password: string): Promise<AuthResponse> {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            throw error;
        }

        return { data, error: null };
    }

    async signInWithGoogle(): Promise<void> {
        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'select_account',
                },
            },
        });

        if (error) {
            console.error('[AuthService] signInWithGoogle error:', error);
            throw error;
        }
    }

    async signOut(): Promise<void> {
        const { error } = await this.supabase.auth.signOut();

        if (error) {
            throw error;
        }
    }

    async getSession() {
        return this.supabase.auth.getSession();
    }

    /**
     * Ponownie wysyła e-mail weryfikacyjny do podanego adresu.
     * Używa type: 'signup' dla flow rejestracji.
     */
    async resendVerificationEmail(
        email: string,
        redirectTo: string
    ): Promise<ResendVerificationResult> {
        try {
            const { error } = await this.supabase.auth.resend({
                type: 'signup',
                email,
                options: {
                    emailRedirectTo: redirectTo,
                },
            });

            if (error) {
                return {
                    success: false,
                    error: this.mapResendError(error),
                };
            }

            return { success: true };
        } catch {
            return {
                success: false,
                error: 'Nie udało się wysłać e-maila. Spróbuj ponownie później.',
            };
        }
    }

    /**
     * Próbuje pobrać sesję z URL po kliknięciu w link weryfikacyjny.
     * Supabase automatycznie przetwarza parametry z URL.
     */
    async exchangeCodeForSession(
        code: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await this.supabase.auth.exchangeCodeForSession(code);

            if (error) {
                return {
                    success: false,
                    error: error.message,
                };
            }

            return { success: true };
        } catch {
            return {
                success: false,
                error: 'Nie udało się zweryfikować linku.',
            };
        }
    }

    /**
     * Initialize auth state by reading current session and subscribing to auth changes.
     * Should be called once at app startup (via APP_INITIALIZER).
     */
    async initAuthState(): Promise<void> {
        if (this.initialized) {
            console.warn('[AuthService] initAuthState called multiple times, ignoring');
            return;
        }

        this.initialized = true;

        // Read initial session
        const { data: { session } } = await this.supabase.auth.getSession();
        await this.updateAuthState(
            session?.access_token ?? null,
            session?.user?.id ?? null
        );

        // Subscribe to auth state changes (login, logout, token refresh)
        this.supabase.auth.onAuthStateChange((_event, session) => {
            void this.updateAuthState(
                session?.access_token ?? null,
                session?.user?.id ?? null
            );
        });
    }

    /**
     * Update auth signals based on session state.
     * Extracts app_role from JWT access token.
     */
    private async updateAuthState(
        accessToken: string | null,
        userId: string | null
    ): Promise<void> {
        if (!accessToken || !userId) {
            // User is not authenticated
            this.isAuthenticated.set(false);
            this.userId.set(null);
            this.appRole.set('user'); // Safe fallback
            this.aiCreditsService.bootstrapFromMeResponse(null);
            return;
        }

        const userChanged = this.userId() !== userId;

        // User is authenticated - extract role from JWT
        const roleResult = extractAppRoleFromJwt(accessToken);

        this.isAuthenticated.set(true);
        this.userId.set(userId);
        this.appRole.set(roleResult.appRole);

        if (userChanged) {
            this.aiCreditsService.bootstrapFromMeResponse(null);
        }

        // Log diagnostics if fallback was used
        if (roleResult.isFallback) {
            console.warn(
                `[AuthService] app_role fallback applied: ${roleResult.reason}`,
                { rawAppRole: roleResult.rawAppRole, fallbackRole: roleResult.appRole }
            );
        }

        await this.bootstrapAiCredits(userId);
    }

    private async bootstrapAiCredits(expectedUserId: string): Promise<void> {
        try {
            const response = await this.supabase.functions.invoke<MeDto>('me', {
                method: 'GET',
            });

            if (this.userId() !== expectedUserId) {
                return;
            }

            if (response.error) {
                throw response.error;
            }

            if (!response.data) {
                throw new Error('Nie otrzymano danych użytkownika.');
            }

            this.aiCreditsService.bootstrapFromMeResponse(response.data.ai_credits);
            this.aiCreditsService.refreshCredits();
        } catch (error) {
            console.error(
                '[AuthService] Nie udało się zainicjalizować kredytów AI:',
                error
            );
        }
    }

    private mapResendError(error: AuthError): string {
        // Mapowanie błędów rate-limit i innych
        if (error.status === 429) {
            return 'Zbyt wiele prób. Spróbuj ponownie później.';
        }

        const errorMessages: Record<string, string> = {
            'For security purposes, you can only request this once every 60 seconds':
                'Możesz wysłać kolejny e-mail za 60 sekund.',
            'Email rate limit exceeded':
                'Zbyt wiele prób. Spróbuj ponownie później.',
        };

        return errorMessages[error.message] ?? error.message;
    }
}
