import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layout/public-layout/public-layout.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    {
        path: '',
        component: PublicLayoutComponent,
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
                loadComponent: () =>
                    import(
                        './pages/explore/public-recipe-detail/public-recipe-detail-page.component'
                    ).then((m) => m.PublicRecipeDetailPageComponent),
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
    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        children: [
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
];
