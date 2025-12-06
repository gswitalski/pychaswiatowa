import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './layout/public-layout/public-layout.component';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout.component';
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
        component: DashboardLayoutComponent,
        canActivate: [authGuard],
        children: [
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./pages/dashboard/dashboard-page.component').then(
                        (m) => m.DashboardPageComponent
                    ),
            },
        ],
    },
];
