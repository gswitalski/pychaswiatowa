import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Guard do dopasowania tras dla zalogowanych użytkowników.
 * Sprawdza czy istnieje aktywna sesja Supabase.
 * Używany z canMatch, aby wybrać odpowiedni layout dla zalogowanych użytkowników.
 */
export const authenticatedMatchGuard: CanMatchFn = async () => {
    const supabase = inject(SupabaseService);

    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        // Zwróć true jeśli użytkownik jest zalogowany
        return session !== null;
    } catch (error) {
        // W przypadku błędu traktuj użytkownika jako niezalogowanego
        console.error('Error checking session in authenticatedMatchGuard:', error);
        return false;
    }
};
