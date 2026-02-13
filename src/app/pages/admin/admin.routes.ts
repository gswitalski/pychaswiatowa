import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
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
];
