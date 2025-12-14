import {
    ChangeDetectionStrategy,
    Component,
    inject,
    DestroyRef,
    OnInit,
} from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { MatSidenavModule } from '@angular/material/sidenav';
import { LayoutService } from '../../core/services/layout.service';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';

/**
 * Main application layout component (App Shell).
 * Provides the Holy Grail layout with sidebar navigation, topbar, and content area.
 */
@Component({
    selector: 'pych-main-layout',
    standalone: true,
    imports: [
        RouterOutlet,
        MatSidenavModule,
        SidebarComponent,
        TopbarComponent,
    ],
    templateUrl: './main-layout.component.html',
    styleUrl: './main-layout.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnInit {
    private readonly layoutService = inject(LayoutService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    /** Private paths that require sidebar visibility */
    private readonly PRIVATE_PATHS = ['/dashboard', '/recipes', '/my-recipes', '/collections', '/settings'];

    /** Sidebar open state */
    readonly isSidebarOpen = this.layoutService.isSidebarOpen;

    /** Mobile viewport state */
    readonly isMobile = this.layoutService.isMobile;

    /** Sidebar visibility state (conditional rendering based on route) */
    readonly shouldShowSidebar = this.layoutService.shouldShowSidebar;

    ngOnInit(): void {
        // Set initial sidebar visibility based on current URL
        const initialShouldShow = this.checkSidebarVisibility(this.router.url);
        this.layoutService.setShouldShowSidebar(initialShouldShow);

        // Update sidebar visibility on navigation
        this.router.events
            .pipe(
                filter((event) => event instanceof NavigationEnd),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((event: NavigationEnd) => {
                const shouldShow = this.checkSidebarVisibility(event.urlAfterRedirects);
                this.layoutService.setShouldShowSidebar(shouldShow);

                // Close sidebar on navigation (mobile only)
                if (this.isMobile()) {
                    this.layoutService.closeSidebar();
                }
            });
    }

    /**
     * Determine if sidebar should be visible based on URL
     */
    private checkSidebarVisibility(url: string): boolean {
        return this.PRIVATE_PATHS.some(path => url.startsWith(path));
    }

    /**
     * Handle sidebar closed event (backdrop click on mobile)
     */
    onSidebarClosed(): void {
        this.layoutService.closeSidebar();
    }
}

