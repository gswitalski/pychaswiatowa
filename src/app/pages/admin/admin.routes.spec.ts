import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { adminRoutes } from './admin.routes';
import { AdminRecipesPageComponent } from './admin-recipes/admin-recipes-page.component';

describe('adminRoutes', () => {
    it('rejestruje lazy trasę recipes obok dashboardu i użytkowników', async () => {
        const parent = adminRoutes.find((route) => route.children)?.children ?? [];
        const recipes = parent.find((route) => route.path === 'recipes');
        expect(recipes?.loadComponent).toBeTypeOf('function');
        const loaded = await recipes?.loadComponent?.();
        expect(loaded).toBe(AdminRecipesPageComponent);
        expect(parent.some((route) => route.path === 'dashboard')).toBe(true);
        expect(parent.some((route) => route.path === 'users')).toBe(true);
    });
});
