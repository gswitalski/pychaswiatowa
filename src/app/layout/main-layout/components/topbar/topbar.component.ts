import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { LayoutService } from '../../../../core/services/layout.service';
import { AuthService } from '../../../../core/services/auth.service';
import { OmniboxComponent } from '../../../../shared/components/omnibox/omnibox.component';
import { MainNavigationComponent } from '../../../../shared/components/main-navigation/main-navigation.component';
import { MainNavigationItem, MAIN_NAVIGATION_ITEMS } from '../../../../shared/models/ui.models';
import { CurrentUserStateService } from '../../../../core/services/current-user-state.service';

/**
 * Top bar component containing breadcrumbs, global search, and user menu.
 */
@Component({
    selector: 'pych-topbar',
    standalone: true,
    imports: [
        RouterLink,
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        MatDividerModule,
        OmniboxComponent,
        MainNavigationComponent,
    ],
    templateUrl: './topbar.component.html',
    styleUrl: './topbar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopbarComponent {
    private readonly layoutService = inject(LayoutService);
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly currentUserState = inject(CurrentUserStateService);

    private readonly currentUrl = toSignal(
        this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd),
            map((event) => event.urlAfterRedirects),
            startWith(this.router.url),
        ),
        { initialValue: this.router.url },
    );

    /** Determines if sidebar should be visible (passed from MainLayout) */
    readonly shouldShowSidebar = input.required<boolean>();

    /** Check if mobile viewport */
    readonly isMobile = this.layoutService.isMobile;

    /** Check if mobile or tablet viewport */
    readonly isMobileOrTablet = this.layoutService.isMobileOrTablet;

    /** Whether the current user has admin role */
    readonly isAdmin = computed(() => this.authService.appRole() === 'admin');

    /** Pricing is relevant only for authenticated users on the Free plan. */
    readonly shouldShowPricingLink = computed(() => this.authService.appRole() === 'user');

    readonly displayName = this.currentUserState.displayName;
    readonly userGreeting = computed(() => {
        const name = this.displayName();
        return name ? `Zalogowano jako ${name}` : null;
    });

    /** Quick add recipe for authenticated users, hidden during recipe creation wizard */
    readonly showAddRecipeAction = computed(() => {
        if (!this.authService.isAuthenticated()) {
            return false;
        }
        const url = this.currentUrl() ?? '';
        return !url.startsWith('/recipes/new');
    });

    readonly addRecipeAriaLabel = computed(() =>
        this.isMobileOrTablet() ? 'Dodaj przepis ze zdjęcia AI' : 'Dodaj przepis',
    );

    /** Topbar navigation items with conditional Admin entry */
    readonly mainNavItems = computed<MainNavigationItem[]>(() => {
        if (!this.isAdmin()) {
            return MAIN_NAVIGATION_ITEMS;
        }

        return [
            ...MAIN_NAVIGATION_ITEMS,
            {
                label: 'Admin',
                route: '/admin/dashboard',
                exact: false,
                ariaLabel: 'Przejdź do panelu administracyjnego',
                matchingRoutes: ['/admin'],
            },
        ];
    });

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar(): void {
        this.layoutService.toggleSidebar();
    }

    /** Navigate to recipe creation (mobile/tablet: AI image assist; desktop: mode chooser) */
    onAddRecipe(): void {
        if (this.isMobileOrTablet()) {
            void this.router.navigate(['/recipes/new/assist'], {
                queryParams: { source: 'image' },
            });
            return;
        }
        void this.router.navigate(['/recipes/new/start']);
    }

    /**
     * Logout user and redirect to login page
     */
    async logout(): Promise<void> {
        try {
            await this.authService.signOut();
            this.router.navigate(['/login']);
        } catch (error) {
            console.error('Logout failed:', error);
            // Still redirect even if logout fails
            this.router.navigate(['/login']);
        }
    }
}
