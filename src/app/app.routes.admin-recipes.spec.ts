import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { guestOnlyMatchGuard } from './core/guards/guest-only-match.guard';

describe('gość na /admin/recipes', () => {
    it('otrzymuje przekierowanie do logowania z returnUrl', () => {
        const guestGroup = routes.find((route) =>
            route.children?.some((route) => route.path === 'admin/recipes')
        );
        expect(guestGroup?.canMatch).toContain(guestOnlyMatchGuard);
        const recipeRoute = guestGroup?.children?.find((route) => route.path === 'admin/recipes');
        expect(recipeRoute?.pathMatch).toBe('full');
        expect(recipeRoute?.redirectTo).toBeTypeOf('function');
        expect((recipeRoute?.redirectTo as () => string)()).toBe(
            '/login?returnUrl=%2Fadmin%2Frecipes'
        );
    });
});
