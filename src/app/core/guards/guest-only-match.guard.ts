import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Guard do dopasowania tras dla niezalogowanych użytkowników (gości).
 * Sprawdza czy NIE istnieje aktywna sesja Supabase.
 * Używany z canMatch, aby wybrać odpowiedni layout dla gości.
 */
export const guestOnlyMatchGuard: CanMatchFn = async () => {
    const supabase = inject(SupabaseService);

    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        // Zwróć true jeśli użytkownik NIE jest zalogowany
        return session === null;
    } catch (error) {
        // W przypadku błędu traktuj użytkownika jako niezalogowanego (pozwól na dostęp do publicznych tras)
        console.error('Error checking session in guestOnlyMatchGuard:', error);
        return true;
    }
};
