import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { NavigationItem } from '../../../../shared/models/ui.models';
import { LayoutService } from '../../../../core/services/layout.service';
import { SidebarCollectionsTreeComponent } from './sidebar-collections-tree.component';

/**
 * Sidebar navigation component with static list of navigation items.
 */
@Component({
    selector: 'pych-sidebar',
    standalone: true,
    imports: [
        RouterLink,
        RouterLinkActive,
        MatListModule,
        MatIconModule,
        SidebarCollectionsTreeComponent,
    ],
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
            label: 'Moja Pycha',
            route: '/dashboard',
            icon: 'dashboard',
        },
        {
            label: 'Moje przepisy',
            route: '/my-recipies',
            icon: 'menu_book',
        },
        // {
        //     label: 'Zakupy',
        //     route: '/shopping',
        //     icon: 'shopping_cart',
        // },
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
