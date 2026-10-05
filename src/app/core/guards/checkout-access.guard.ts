import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthService } from '../services/auth.service';
import { SubscriptionStateService } from '../services/subscription-state.service';

export const checkoutAccessGuard: CanActivateFn = async () => {
    const authService = inject(AuthService);
    const subscriptionState = inject(SubscriptionStateService);
    const router = inject(Router);
    const snackBar = inject(MatSnackBar);

    if (!authService.isAuthenticated()) {
        return router.createUrlTree(['/login'], {
            queryParams: { next: '/checkout' },
        });
    }

    const role = authService.appRole();
    if (role === 'admin') {
        return router.createUrlTree(['/pricing']);
    }

    if (role === 'user') {
        return true;
    }

    await subscriptionState.ensureLoaded();

    if (!subscriptionState.loaded()) {
        return true;
    }

    if (subscriptionState.isTrialing()) {
        return true;
    }

    snackBar.open('Masz już aktywne konto Premium.', 'OK', {
        duration: 5_000,
    });
    return router.createUrlTree(['/pricing']);
};
