import { Injectable, inject, signal } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

/**
 * Service for managing the application layout state.
 * Uses Angular Signals for reactive state management.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
    private readonly breakpointObserver = inject(BreakpointObserver);

    // Sidebar state
    private readonly _isSidebarOpen = signal(true);
    public readonly isSidebarOpen = this._isSidebarOpen.asReadonly();

    // Sidebar visibility state (conditional rendering based on route)
    private readonly _shouldShowSidebar = signal(true);
    public readonly shouldShowSidebar = this._shouldShowSidebar.asReadonly();

    // Mobile state - reactive to viewport changes
    private readonly isMobileObservable$ = this.breakpointObserver
        .observe([Breakpoints.XSmall, Breakpoints.Small])
        .pipe(map((result) => result.matches));

    public readonly isMobile = toSignal(this.isMobileObservable$, {
        initialValue: false,
    });

    // Mobile or tablet state (< 960px) - reactive to viewport changes
    private readonly isMobileOrTabletObservable$ = this.breakpointObserver
        .observe([Breakpoints.XSmall, Breakpoints.Small, Breakpoints.Medium])
        .pipe(map((result) => result.matches));

    public readonly isMobileOrTablet = toSignal(this.isMobileOrTabletObservable$, {
        initialValue: false,
    });

    constructor() {
        // Auto-close sidebar on mobile viewport
        this.breakpointObserver
            .observe([Breakpoints.XSmall, Breakpoints.Small])
            .subscribe((result) => {
                if (result.matches) {
                    this._isSidebarOpen.set(false);
                } else {
                    this._isSidebarOpen.set(true);
                }
            });
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar(): void {
        this._isSidebarOpen.update((isOpen) => !isOpen);
    }

    /**
     * Open the sidebar
     */
    openSidebar(): void {
        this._isSidebarOpen.set(true);
    }

    /**
     * Close the sidebar
     */
    closeSidebar(): void {
        this._isSidebarOpen.set(false);
    }

    /**
     * Set whether the sidebar should be visible based on current route
     */
    setShouldShowSidebar(shouldShow: boolean): void {
        this._shouldShowSidebar.set(shouldShow);
    }
}

