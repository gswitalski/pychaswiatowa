import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { guestOnlyMatchGuard } from './core/guards/guest-only-match.guard';

describe('gość na /settings', () => {
    it('otrzymuje przekierowanie do logowania z next', () => {
        const guestGroup = routes.find(
            (route) =>
                route.canMatch?.includes(guestOnlyMatchGuard) &&
                route.children?.some((child) => child.path === 'settings'),
        );
        expect(guestGroup?.canMatch).toContain(guestOnlyMatchGuard);
        const settingsRoute = guestGroup?.children?.find((child) => child.path === 'settings');
        expect(settingsRoute?.pathMatch).toBe('full');
        expect(settingsRoute?.redirectTo).toBeTypeOf('function');
        expect((settingsRoute?.redirectTo as () => string)()).toBe('/login?next=%2Fsettings');
    });
});

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

describe('gość na szczegółach przepisu', () => {
    it('zachowuje variant i pozostałe query params', () => {
        const recipeRoute = routes
            .flatMap((route) => route.children ?? [])
            .find((route) => route.path === 'recipes/:id');
        const redirect = recipeRoute?.redirectTo as (route: {
            params: Record<string, string>;
            queryParams: Record<string, string>;
        }) => string;

        expect(
            redirect({
                params: { id: '12' },
                queryParams: { variant: '34', q: 'zupa' },
            }),
        ).toBe('/explore/recipes/12?variant=34&q=zupa');
    });
});
