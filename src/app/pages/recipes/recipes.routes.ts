import { Routes } from '@angular/router';
import { recipeIdSlugMatcher, recipeIdOnlyMatcher } from '../../core/routing/recipe-url.matchers';

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
        children: [
            {
                path: '',
                loadComponent: () =>
                    import('./recipe-form/recipe-form-page.component').then(
                        (m) => m.RecipeFormPageComponent
                    ),
                data: { breadcrumb: 'Nowy przepis' },
            },
            {
                path: 'start',
                loadComponent: () =>
                    import('./recipe-new-start/recipe-new-start-page.component').then(
                        (m) => m.RecipeNewStartPageComponent
                    ),
                data: { breadcrumb: 'Dodaj przepis' },
            },
            {
                path: 'assist',
                loadComponent: () =>
                    import('./recipe-new-assist/recipe-new-assist-page.component').then(
                        (m) => m.RecipeNewAssistPageComponent
                    ),
                data: { breadcrumb: 'Dodaj przepis (AI)' },
            },
        ],
    },
    {
        path: 'import',
        loadComponent: () =>
            import('./recipe-import/recipe-import-page.component').then(
                (m) => m.RecipeImportPageComponent
            ),
        data: { breadcrumb: 'Import przepisu' },
    },
    // Kanoniczny URL z slugiem - :id-:slug
    {
        matcher: recipeIdSlugMatcher,
        loadComponent: () =>
            import('./recipe-detail/recipe-detail-page.component').then(
                (m) => m.RecipeDetailPageComponent
            ),
        data: { breadcrumb: 'Szczegóły', urlPrefix: 'recipes' },
    },
    // Legacy URL - tylko :id (normalizacja do formatu kanonicznego)
    {
        matcher: recipeIdOnlyMatcher,
        loadComponent: () =>
            import('./recipe-url-normalization/recipe-url-normalization-page.component').then(
                (m) => m.RecipeUrlNormalizationPageComponent
            ),
        data: { context: 'private', urlPrefix: 'recipes' },
    },
    {
        path: ':id/edit',
        loadComponent: () =>
            import('./recipe-form/recipe-form-page.component').then(
                (m) => m.RecipeFormPageComponent
            ),
        data: { breadcrumb: 'Edycja' },
    },
];
