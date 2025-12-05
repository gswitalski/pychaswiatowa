import { Injectable, inject } from '@angular/core';
import { AuthResponse } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { SignUpRequestDto } from '../../../../shared/contracts/types';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private readonly supabase = inject(SupabaseService);

    async signUp(credentials: SignUpRequestDto): Promise<AuthResponse> {
        const { data, error } = await this.supabase.auth.signUp({
            email: credentials.email,
            password: credentials.password,
            options: credentials.options,
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
}
