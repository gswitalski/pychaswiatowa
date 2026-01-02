import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layout/public-layout/public-layout.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authenticatedMatchGuard } from './core/guards/authenticated-match.guard';
import { guestOnlyMatchGuard } from './core/guards/guest-only-match.guard';
import {
    exploreRecipeIdSlugMatcher,
    exploreRecipeIdOnlyMatcher,
} from './core/routing/recipe-url.matchers';

export const routes: Routes = [
    // Grupa tras dla zalogowanych użytkowników - publiczne widoki w MainLayout (App Shell)
    {
        path: '',
        component: MainLayoutComponent,
        canMatch: [authenticatedMatchGuard],
        children: [
            {
                path: '',
                loadComponent: () =>
                    import('./pages/landing/landing-page.component').then(
                        (m) => m.LandingPageComponent
                    ),
            },
            {
                path: 'explore',
                loadComponent: () =>
                    import('./pages/explore/explore-page.component').then(
                        (m) => m.ExplorePageComponent
                    ),
            },
            // Kanoniczny URL z slugiem - explore/recipes/:id-:slug
            {
                matcher: exploreRecipeIdSlugMatcher,
                loadComponent: () =>
                    import('./pages/explore/explore-recipe-detail/explore-recipe-detail-page.component').then(
                        (m) => m.ExploreRecipeDetailPageComponent
                    ),
                data: { urlPrefix: 'explore/recipes' },
            },
            // Legacy URL - explore/recipes/:id (normalizacja do formatu kanonicznego)
            {
                matcher: exploreRecipeIdOnlyMatcher,
                loadComponent: () =>
                    import('./pages/recipes/recipe-url-normalization/recipe-url-normalization-page.component').then(
                        (m) => m.RecipeUrlNormalizationPageComponent
                    ),
                data: { context: 'public', urlPrefix: 'explore/recipes' },
            },
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./pages/dashboard/dashboard-page.component').then(
                        (m) => m.DashboardPageComponent
                    ),
                data: { breadcrumb: 'Dashboard' },
            },
            {
                path: 'my-recipies',
                loadComponent: () =>
                    import('./pages/recipes/recipes-list/recipes-list-page.component').then(
                        (m) => m.RecipesListPageComponent
                    ),
                data: { breadcrumb: 'Moje przepisy' },
            },
            {
                path: 'my-recipes',
                pathMatch: 'full',
                redirectTo: 'my-recipies',
            },
            {
                path: 'recipes',
                pathMatch: 'full',
                redirectTo: 'my-recipies',
            },
            {
                path: 'recipes',
                loadChildren: () =>
                    import('./pages/recipes/recipes.routes').then(
                        (m) => m.recipesRoutes
                    ),
                data: { breadcrumb: 'Przepisy' },
            },
            {
                path: 'collections',
                loadChildren: () =>
                    import('./pages/collections/collections.routes').then(
                        (m) => m.collectionsRoutes
                    ),
                data: { breadcrumb: 'Kolekcje' },
            },
            {
                path: 'settings',
                loadComponent: () =>
                    import('./pages/dashboard/dashboard-page.component').then(
                        (m) => m.DashboardPageComponent
                    ),
                data: { breadcrumb: 'Ustawienia' },
            },
            // Auth routes - dostępne również dla zalogowanych (sesja może istnieć przy niezweryfikowanym e-mailu)
            {
                path: 'register',
                loadComponent: () =>
                    import('./pages/register/register-page.component').then(
                        (m) => m.RegisterPageComponent
                    ),
            },
            {
                path: 'register/verify-sent',
                loadComponent: () =>
                    import('./pages/auth/register-verify-sent/register-verify-sent-page.component').then(
                        (m) => m.RegisterVerifySentPageComponent
                    ),
            },
            {
                path: 'login',
                loadComponent: () =>
                    import('./pages/login/login-page.component').then(
                        (m) => m.LoginPageComponent
                    ),
            },
            {
                path: 'auth/callback',
                loadComponent: () =>
                    import('./pages/auth/auth-callback/auth-callback-page.component').then(
                        (m) => m.AuthCallbackPageComponent
                    ),
            },
            {
                path: 'email-confirmed',
                loadComponent: () =>
                    import('./pages/auth/email-confirmed/email-confirmed-page.component').then(
                        (m) => m.EmailConfirmedPageComponent
                    ),
            },
            {
                path: 'email-confirmation-invalid',
                loadComponent: () =>
                    import('./pages/auth/email-confirmation-invalid/email-confirmation-invalid-page.component').then(
                        (m) => m.EmailConfirmationInvalidPageComponent
                    ),
            },
            // Technical error page - no guard required
            {
                path: 'forbidden',
                loadComponent: () =>
                    import('./pages/forbidden/forbidden-page.component').then(
                        (m) => m.ForbiddenPageComponent
                    ),
            },
        ],
    },
    // Grupa tras dla gości - publiczne widoki w PublicLayout
    {
        path: '',
        component: PublicLayoutComponent,
        canMatch: [guestOnlyMatchGuard],
        children: [
            {
                path: '',
                loadComponent: () =>
                    import('./pages/landing/landing-page.component').then(
                        (m) => m.LandingPageComponent
                    ),
            },
            {
                path: 'explore',
                loadComponent: () =>
                    import('./pages/explore/explore-page.component').then(
                        (m) => m.ExplorePageComponent
                    ),
            },
            // Kanoniczny URL z slugiem - explore/recipes/:id-:slug
            {
                matcher: exploreRecipeIdSlugMatcher,
                loadComponent: () =>
                    import('./pages/explore/explore-recipe-detail/explore-recipe-detail-page.component').then(
                        (m) => m.ExploreRecipeDetailPageComponent
                    ),
                data: { urlPrefix: 'explore/recipes' },
            },
            // Legacy URL - explore/recipes/:id (normalizacja do formatu kanonicznego)
            {
                matcher: exploreRecipeIdOnlyMatcher,
                loadComponent: () =>
                    import('./pages/recipes/recipe-url-normalization/recipe-url-normalization-page.component').then(
                        (m) => m.RecipeUrlNormalizationPageComponent
                    ),
                data: { context: 'public', urlPrefix: 'explore/recipes' },
            },
            {
                path: 'dashboard',
                redirectTo: () => {
                    // Redirect guests to login with return URL
                    return '/login?redirectTo=%2Fdashboard';
                },
                pathMatch: 'full',
            },
            {
                path: 'recipes/:id',
                redirectTo: (route) => {
                    // Przekierowanie ze starej ścieżki /recipes/:id na /explore/recipes/:id dla gości
                    const id = route.params['id'] as string;
                    return `/explore/recipes/${id}`;
                },
                pathMatch: 'full',
            },
            {
                path: 'register',
                loadComponent: () =>
                    import('./pages/register/register-page.component').then(
                        (m) => m.RegisterPageComponent
                    ),
            },
            {
                path: 'register/verify-sent',
                loadComponent: () =>
                    import('./pages/auth/register-verify-sent/register-verify-sent-page.component').then(
                        (m) => m.RegisterVerifySentPageComponent
                    ),
            },
            {
                path: 'login',
                loadComponent: () =>
                    import('./pages/login/login-page.component').then(
                        (m) => m.LoginPageComponent
                    ),
            },
            // Email verification routes - dostępne również dla gości
            {
                path: 'auth/callback',
                loadComponent: () =>
                    import('./pages/auth/auth-callback/auth-callback-page.component').then(
                        (m) => m.AuthCallbackPageComponent
                    ),
            },
            {
                path: 'email-confirmed',
                loadComponent: () =>
                    import('./pages/auth/email-confirmed/email-confirmed-page.component').then(
                        (m) => m.EmailConfirmedPageComponent
                    ),
            },
            {
                path: 'email-confirmation-invalid',
                loadComponent: () =>
                    import('./pages/auth/email-confirmation-invalid/email-confirmation-invalid-page.component').then(
                        (m) => m.EmailConfirmationInvalidPageComponent
                    ),
            },
            // Technical error page - no guard required
            {
                path: 'forbidden',
                loadComponent: () =>
                    import('./pages/forbidden/forbidden-page.component').then(
                        (m) => m.ForbiddenPageComponent
                    ),
            },
        ],
    },
];
