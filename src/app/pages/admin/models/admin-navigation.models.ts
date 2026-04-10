export interface AdminNavItemVm {
    readonly label: string;
    readonly route: string;
    readonly icon?: string;
    readonly matchMode: 'exact' | 'prefix';
    readonly matchingRoutes?: readonly string[];
    readonly ariaLabel?: string;
}
