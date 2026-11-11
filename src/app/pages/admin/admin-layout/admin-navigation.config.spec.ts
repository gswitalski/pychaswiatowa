import { describe, expect, it } from 'vitest';
import { ADMIN_NAV_ITEMS } from './admin-navigation.config';

describe('ADMIN_NAV_ITEMS', () => {
    it('zawiera pozycję przepisów publicznych', () => {
        const item = ADMIN_NAV_ITEMS.find((navItem) => navItem.route === '/admin/recipes');
        expect(item).toMatchObject({
            label: 'Przepisy publiczne',
            icon: 'menu_book',
            matchMode: 'exact',
            matchingRoutes: ['/admin/recipes'],
            ariaLabel: 'Przejdź do sekcji przepisów publicznych',
        });
        expect(ADMIN_NAV_ITEMS.map((navItem) => navItem.route)).toEqual([
            '/admin/dashboard',
            '/admin/users',
            '/admin/recipes',
        ]);
        expect(new Set(ADMIN_NAV_ITEMS.map((navItem) => navItem.route)).size).toBe(
            ADMIN_NAV_ITEMS.length
        );
        expect(ADMIN_NAV_ITEMS[0]).toMatchObject({
            label: 'Dashboard',
            route: '/admin/dashboard',
            icon: 'dashboard',
        });
        expect(ADMIN_NAV_ITEMS[1]).toMatchObject({
            label: 'Użytkownicy',
            route: '/admin/users',
            icon: 'group',
        });
    });
});
