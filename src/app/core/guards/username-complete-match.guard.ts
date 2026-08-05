import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { ProfileCompletionService } from '../services/profile-completion.service';

export const usernameCompleteMatchGuard: CanMatchFn = async () => {
    const router = inject(Router);
    const profileCompletion = inject(ProfileCompletionService);

    const isComplete = await profileCompletion.ensureChecked();
    if (!isComplete) {
        router.navigate(['/auth/complete-profile']);
        return false;
    }

    return true;
};
