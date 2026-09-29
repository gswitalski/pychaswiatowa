import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { recipesRoutes } from './recipes.routes';

describe('recipesRoutes', () => {
    it('udostępnia asystenta AI wszystkim zalogowanym użytkownikom', () => {
        const newRecipeRoute = recipesRoutes.find((route) => route.path === 'new');
        const assistRoute = newRecipeRoute?.children?.find(
            (route) => route.path === 'assist'
        );

        expect(assistRoute).toBeDefined();
        expect(assistRoute?.canMatch).toBeUndefined();
    });
});
