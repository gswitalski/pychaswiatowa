import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { NavigationItem } from '../../../../shared/models/ui.models';
import { LayoutService } from '../../../../core/services/layout.service';

/**
 * Sidebar navigation component with static list of navigation items.
 */
@Component({
    selector: 'pych-sidebar',
    standalone: true,
    imports: [RouterLink, RouterLinkActive, MatListModule, MatIconModule],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
    private readonly router = inject(Router);
    private readonly layoutService = inject(LayoutService);

    /** Emits when navigation occurs (for closing sidebar on mobile) */
    navigationClick = output<void>();

    /** Static list of navigation items */
    readonly navigationItems: NavigationItem[] = [
        {
            label: 'Dashboard',
            route: '/dashboard',
            icon: 'dashboard',
        },
        {
            label: 'Przepisy',
            route: '/recipes',
            icon: 'menu_book',
        },
        {
            label: 'Kolekcje',
            route: '/collections',
            icon: 'collections_bookmark',
        },
        {
            label: 'Ustawienia',
            route: '/settings',
            icon: 'settings',
        },
    ];

    /**
     * Handle navigation item click
     */
    onNavigate(): void {
        // Close sidebar on mobile after navigation
        if (this.layoutService.isMobile()) {
            this.layoutService.closeSidebar();
        }
        this.navigationClick.emit();
    }
}

