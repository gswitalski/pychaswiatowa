import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { LayoutService } from '../../../core/services/layout.service';
import {
    MainNavigationItem,
    MAIN_NAVIGATION_ITEMS,
} from '../../models/ui.models';

/**
 * Main navigation component displaying primary navigation items.
 * Adapts to desktop (tabs) and mobile (hamburger menu) layouts.
 */
@Component({
    selector: 'pych-main-navigation',
    standalone: true,
    imports: [
        RouterLink,
        RouterLinkActive,
        MatTabsModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
    ],
    templateUrl: './main-navigation.component.html',
    styleUrl: './main-navigation.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainNavigationComponent {
    private readonly layoutService = inject(LayoutService);

    /** Navigation items to display */
    readonly items = input<MainNavigationItem[]>(MAIN_NAVIGATION_ITEMS);

    /** Display variant: desktop, mobile, or auto-detect */
    readonly variant = input<'desktop' | 'mobile' | 'auto'>('auto');

    /** Check if mobile viewport */
    readonly isMobile = this.layoutService.isMobile;

    /** Computed effective variant based on viewport if 'auto' */
    readonly effectiveVariant = computed(() => {
        const variantValue = this.variant();
        if (variantValue === 'auto') {
            return this.isMobile() ? 'mobile' : 'desktop';
        }
        return variantValue;
    });
}

