import { AdminNavItemVm } from '../models/admin-navigation.models';

export const ADMIN_NAV_ITEMS: readonly AdminNavItemVm[] = [
    {
        label: 'Dashboard',
        route: '/admin/dashboard',
        icon: 'dashboard',
        matchMode: 'exact',
        matchingRoutes: ['/admin', '/admin/dashboard'],
        ariaLabel: 'Przejdź do dashboardu administracyjnego',
    },
    {
        label: 'Użytkownicy',
        route: '/admin/users',
        icon: 'group',
        matchMode: 'exact',
        matchingRoutes: ['/admin/users'],
        ariaLabel: 'Przejdź do sekcji użytkowników',
    },
];
