import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layout/public-layout/public-layout.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authenticatedMatchGuard } from './core/guards/authenticated-match.guard';
import { guestOnlyMatchGuard } from './core/guards/guest-only-match.guard';

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
            {
                path: 'explore/recipes/:id',
                loadComponent: () =>
                    import('./pages/explore/explore-recipe-detail/explore-recipe-detail-page.component').then(
                        (m) => m.ExploreRecipeDetailPageComponent
                    ),
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
            {
                path: 'explore/recipes/:id',
                loadComponent: () =>
                    import('./pages/explore/explore-recipe-detail/explore-recipe-detail-page.component').then(
                        (m) => m.ExploreRecipeDetailPageComponent
                    ),
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
                path: 'login',
                loadComponent: () =>
                    import('./pages/login/login-page.component').then(
                        (m) => m.LoginPageComponent
                    ),
            },
        ],
    },
];
