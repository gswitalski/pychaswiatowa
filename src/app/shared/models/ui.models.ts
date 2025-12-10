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

