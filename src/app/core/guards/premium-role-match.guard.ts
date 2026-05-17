import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard dopasowania tras dla funkcji premium.
 * Pozwala na dostęp użytkownikom z rolą `premium` lub `admin`.
 */
export const premiumRoleMatchGuard: CanMatchFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const role = authService.appRole();
    if (role === 'premium' || role === 'admin') {
        return true;
    }

    router.navigate(['/forbidden']);
    return false;
};
