/**
 * UI models for the application layout and navigation.
 */

/**
 * Represents a navigation item in the sidebar.
 */
export interface NavigationItem {
    label: string;
    route: string;
    icon: string; // Material icon name
}

/**
 * Represents a breadcrumb item for navigation hierarchy.
 */
export interface Breadcrumb {
    label: string;
    url: string;
}

/**
 * Represents a main navigation item in the top navigation bar.
 */
export interface MainNavigationItem {
    /** Display label for the navigation item */
    label: string;
    /** Route path for navigation */
    route: string;
    /** Whether the active state requires exact route matching */
    exact: boolean;
    /** Optional aria-label for accessibility */
    ariaLabel?: string;
    /** Optional array of additional routes that should also activate this item */
    matchingRoutes?: string[];
}

/**
 * Static configuration for main navigation items.
 * Used in both public and authenticated layouts.
 */
export const MAIN_NAVIGATION_ITEMS: MainNavigationItem[] = [
    {
        label: 'Odkrywaj przepisy',
        route: '/explore',
        exact: false,
        ariaLabel: 'Przejdź do Odkrywaj przepisy',
    },
    {
        label: 'Moja Pycha',
        route: '/dashboard',
        exact: false,
        ariaLabel: 'Przejdź do Moja Pycha',
        matchingRoutes: ['/dashboard', '/my-recipies', '/recipes', '/collections', '/shopping', '/settings'],
    },
    {
        label: 'Zakupy',
        route: '/shopping',
        exact: false,
        ariaLabel: 'Przejdź do Zakupów',
        matchingRoutes: ['/shopping'],
    }
];

