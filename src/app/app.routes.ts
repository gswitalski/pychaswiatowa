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
                path: 'explore/recipes/:idslug',
                redirectTo: (route) => {
                    // Przekierowanie ze starej ścieżki /explore/recipes/:idslug na /recipes/:id
                    const idslug = route.params['idslug'] as string;
                    const id = idslug.split('-')[0];
                    return `/recipes/${id}`;
                },
                pathMatch: 'full',
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
                path: 'explore/recipes/:idslug',
                redirectTo: (route) => {
                    // Przekierowanie ze starej ścieżki /explore/recipes/:idslug na /recipes/:id
                    const idslug = route.params['idslug'] as string;
                    const id = idslug.split('-')[0];
                    return `/recipes/${id}`;
                },
                pathMatch: 'full',
            },
            {
                path: 'recipes/:id',
                loadComponent: () =>
                    import(
                        './pages/recipes/recipe-detail/recipe-detail-page.component'
                    ).then((m) => m.RecipeDetailPageComponent),
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
