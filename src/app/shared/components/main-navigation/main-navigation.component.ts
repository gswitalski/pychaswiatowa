import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { LayoutService } from '../../../core/services/layout.service';
import {
    MainNavigationItem,
    MAIN_NAVIGATION_ITEMS,
} from '../../models/ui.models';
import { MatListModule } from '@angular/material/list';

/**
 * Main navigation component displaying primary navigation items.
 * Adapts to desktop (tabs) and mobile (hamburger menu) layouts.
 */
@Component({
    selector: 'pych-main-navigation',
    standalone: true,
    imports: [
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatListModule,
    ],
    templateUrl: './main-navigation.component.html',
    styleUrl: './main-navigation.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainNavigationComponent {
    private readonly layoutService = inject(LayoutService);
    private readonly router = inject(Router);

    /** Navigation items to display */
    readonly items = input<MainNavigationItem[]>(MAIN_NAVIGATION_ITEMS);

    /** Display variant: desktop, mobile, or auto-detect */
    readonly variant = input<'desktop' | 'mobile' | 'auto'>('auto');

    /** Check if mobile viewport */
    readonly isMobile = this.layoutService.isMobile;

    /** Current URL as signal */
    readonly currentUrl = toSignal(
        this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd),
            map((event) => event.urlAfterRedirects),
            startWith(this.router.url)
        ),
        { initialValue: this.router.url }
    );

    /** Computed effective variant based on viewport if 'auto' */
    readonly effectiveVariant = computed(() => {
        const variantValue = this.variant();
        if (variantValue === 'auto') {
            return this.isMobile() ? 'mobile' : 'desktop';
        }
        return variantValue;
    });

    /**
     * Check if navigation item should be active based on current URL
     */
    isItemActive(item: MainNavigationItem): boolean {
        const url = this.currentUrl();

        // If item has matchingRoutes, check if current URL starts with any of them
        if (item.matchingRoutes && item.matchingRoutes.length > 0) {
            return item.matchingRoutes.some(route => url.startsWith(route));
        }

        // Fallback to default behavior (not used with matchingRoutes)
        if (item.exact) {
            return url === item.route;
        }
        return url.startsWith(item.route);
    }
}

