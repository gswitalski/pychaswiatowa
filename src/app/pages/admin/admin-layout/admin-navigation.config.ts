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
    {
        label: 'Przepisy publiczne',
        route: '/admin/recipes',
        icon: 'menu_book',
        matchMode: 'exact',
        matchingRoutes: ['/admin/recipes'],
        ariaLabel: 'Przejdź do sekcji przepisów publicznych',
    },
];
