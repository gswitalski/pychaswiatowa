import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProfileCompletionService } from '../services/profile-completion.service';
import { SupabaseService } from '../services/supabase.service';

export const oauthCompleteProfileGuard: CanActivateFn = async () => {
    const supabase = inject(SupabaseService);
    const router = inject(Router);
    const profileCompletion = inject(ProfileCompletionService);

    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
        router.navigate(['/login']);
        return false;
    }

    const isComplete = await profileCompletion.ensureChecked();
    if (isComplete) {
        router.navigate(['/dashboard']);
        return false;
    }

    return true;
};
