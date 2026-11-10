import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
