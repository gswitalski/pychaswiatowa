import { Routes } from '@angular/router';

export const recipesRoutes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./recipes-list/recipes-list-page.component').then(
                (m) => m.RecipesListPageComponent
            ),
    },
    {
        path: 'new',
        loadComponent: () =>
            import('./recipe-form/recipe-form-page.component').then(
                (m) => m.RecipeFormPageComponent
            ),
    },
    {
        path: 'import',
        loadComponent: () =>
            import('./recipe-import/recipe-import-page.component').then(
                (m) => m.RecipeImportPageComponent
            ),
    },
    {
        path: ':id',
        loadComponent: () =>
            import('./recipe-detail/recipe-detail-page.component').then(
                (m) => m.RecipeDetailPageComponent
            ),
    },
    {
        path: ':id/edit',
        loadComponent: () =>
            import('./recipe-form/recipe-form-page.component').then(
                (m) => m.RecipeFormPageComponent
            ),
    },
];

