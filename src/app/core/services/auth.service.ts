import { Injectable, inject, signal } from '@angular/core';
import { AuthResponse, AuthError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { SignUpRequestDto, AppRole } from '../../../../shared/contracts/types';
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

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly supabase = inject(SupabaseService);

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
        const { data, error } = await this.supabase.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: {
                ...credentials.options,
                emailRedirectTo: redirectTo,
            },
        });

        if (error) {
            throw error;
        }

        return { data, error: null };
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
        this.updateAuthState(session?.access_token ?? null, session?.user?.id ?? null);

        // Subscribe to auth state changes (login, logout, token refresh)
        this.supabase.auth.onAuthStateChange((_event, session) => {
            this.updateAuthState(session?.access_token ?? null, session?.user?.id ?? null);
        });
    }

    /**
     * Update auth signals based on session state.
     * Extracts app_role from JWT access token.
     */
    private updateAuthState(accessToken: string | null, userId: string | null): void {
        if (!accessToken || !userId) {
            // User is not authenticated
            this.isAuthenticated.set(false);
            this.userId.set(null);
            this.appRole.set('user'); // Safe fallback
            return;
        }

        // User is authenticated - extract role from JWT
        const roleResult = extractAppRoleFromJwt(accessToken);

        this.isAuthenticated.set(true);
        this.userId.set(userId);
        this.appRole.set(roleResult.appRole);

        // Log diagnostics if fallback was used
        if (roleResult.isFallback) {
            console.warn(
                `[AuthService] app_role fallback applied: ${roleResult.reason}`,
                { rawAppRole: roleResult.rawAppRole, fallbackRole: roleResult.appRole }
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
