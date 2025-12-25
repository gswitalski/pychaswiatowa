import { Injectable, inject } from '@angular/core';
import { AuthResponse, AuthError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { SignUpRequestDto } from '../../../../shared/contracts/types';

/** Cooldown w sekundach dla ponownego wysłania linku weryfikacyjnego */
export const RESEND_COOLDOWN_SECONDS = 60;

export interface ResendVerificationResult {
    success: boolean;
    error?: string;
}

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly supabase = inject(SupabaseService);

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
