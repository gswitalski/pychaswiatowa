import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard dopasowania tras dla sekcji admin.
 * Pozwala na dostęp wyłącznie użytkownikom z rolą `admin`.
 */
export const adminRoleMatchGuard: CanMatchFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.appRole() === 'admin') {
        return true;
    }

    router.navigate(['/forbidden']);
    return false;
};
