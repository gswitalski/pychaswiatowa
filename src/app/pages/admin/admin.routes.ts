import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./admin-layout/admin-layout.component').then(
                (m) => m.AdminLayoutComponent
            ),
        children: [
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'dashboard',
            },
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./admin-dashboard/admin-dashboard-page.component').then(
                        (m) => m.AdminDashboardPageComponent
                    ),
            },
            {
                path: 'users',
                loadComponent: () =>
                    import('./admin-users-placeholder/admin-users-placeholder-page.component').then(
                        (m) => m.AdminUsersPlaceholderPageComponent
                    ),
            },
        ],
    },
];
