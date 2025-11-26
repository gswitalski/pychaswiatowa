import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const authGuard = async () => {
    const supabase = inject(SupabaseService);
    const router = inject(Router);

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        router.navigate(['/login']);
        return false;
    }

    return true;
};

