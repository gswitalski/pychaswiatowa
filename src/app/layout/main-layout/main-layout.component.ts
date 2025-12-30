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
import { MyPlanService } from '../../core/services/my-plan.service';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { TopbarComponent } from './components/topbar/topbar.component';
import { MyPlanDrawerComponent } from '../../shared/components/my-plan-drawer/my-plan-drawer.component';
import { MyPlanFabComponent } from '../../shared/components/my-plan-fab/my-plan-fab.component';

/**
 * Main application layout component (App Shell).
 * Provides the Holy Grail layout with sidebar navigation, topbar, and content area.
 * Includes "Mój plan" drawer and FAB for authenticated users.
 */
@Component({
    selector: 'pych-main-layout',
    standalone: true,
    imports: [
        RouterOutlet,
        MatSidenavModule,
        SidebarComponent,
        TopbarComponent,
        MyPlanDrawerComponent,
        MyPlanFabComponent,
    ],
    templateUrl: './main-layout.component.html',
    styleUrl: './main-layout.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent implements OnInit {
    private readonly layoutService = inject(LayoutService);
    private readonly myPlanService = inject(MyPlanService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    /** Private paths that require sidebar visibility */
    private readonly PRIVATE_PATHS = ['/dashboard', '/recipes', '/my-recipies', '/collections', '/settings'];

    /** Sidebar open state */
    readonly isSidebarOpen = this.layoutService.isSidebarOpen;

    /** Mobile viewport state */
    readonly isMobile = this.layoutService.isMobile;

    /** Sidebar visibility state (conditional rendering based on route) */
    readonly shouldShowSidebar = this.layoutService.shouldShowSidebar;

    /** My Plan drawer open state */
    readonly isMyPlanDrawerOpen = this.myPlanService.isDrawerOpen;

    /** My Plan has items (for FAB visibility) */
    readonly myPlanHasItems = this.myPlanService.hasItems;

    ngOnInit(): void {
        // Prefetch plan data for FAB visibility
        this.myPlanService.prefetchPlan();

        // Set initial sidebar visibility based on current URL
        const initialShouldShow = this.checkSidebarVisibility(this.router.url);
        this.layoutService.setShouldShowSidebar(initialShouldShow);

        // Update sidebar visibility on navigation
        this.router.events
            .pipe(
                filter((event): event is NavigationEnd => event instanceof NavigationEnd),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((event) => {
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

    /**
     * Handle My Plan drawer closed event (backdrop click or escape)
     */
    onMyPlanDrawerClosed(): void {
        this.myPlanService.closeDrawer();
    }

    /**
     * Handle My Plan drawer opened event
     * Refresh plan data if needed
     */
    onMyPlanDrawerOpened(): void {
        this.myPlanService.loadPlanIfNeeded();
    }
}

