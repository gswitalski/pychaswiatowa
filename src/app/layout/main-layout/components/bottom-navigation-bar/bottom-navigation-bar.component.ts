import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../../core/services/auth.service';

type MainNavItemId = 'explore' | 'dashboard' | 'shopping';

interface MainNavItemVm {
    id: MainNavItemId;
    label: string;
    icon: string;
    path: string;
    isPrivate: boolean;
}

const MAIN_NAV_ITEMS: readonly MainNavItemVm[] = [
    {
        id: 'explore',
        label: 'Odkrywaj',
        icon: 'explore',
        path: '/explore',
        isPrivate: false,
    },
    {
        id: 'dashboard',
        label: 'Moja Pycha',
        icon: 'dashboard',
        path: '/dashboard',
        isPrivate: true,
    },
    {
        id: 'shopping',
        label: 'Zakupy',
        icon: 'shopping_cart',
        path: '/shopping',
        isPrivate: true,
    },
];

@Component({
    selector: 'pych-bottom-navigation-bar',
    standalone: true,
    imports: [MatIconModule, MatButtonModule],
    templateUrl: './bottom-navigation-bar.component.html',
    styleUrl: './bottom-navigation-bar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNavigationBarComponent {
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);

    readonly items = MAIN_NAV_ITEMS;

    private readonly currentUrl = toSignal(
        this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd),
            map((event) => event.urlAfterRedirects),
            startWith(this.router.url)
        ),
        { initialValue: this.router.url }
    );

    readonly activeItemId = computed(() => this.mapActiveItemId(this.currentUrl()));

    async onItemClick(item: MainNavItemVm): Promise<void> {
        if (item.isPrivate && !this.authService.isAuthenticated()) {
            await this.navigateToLogin(item.path);
            return;
        }

        await this.navigateTo(item.path);
    }

    private mapActiveItemId(url: string | null): MainNavItemId | null {
        if (!url) {
            return null;
        }

        if (url.startsWith('/explore')) {
            return 'explore';
        }

        if (url.startsWith('/dashboard')) {
            return 'dashboard';
        }

        if (url.startsWith('/shopping')) {
            return 'shopping';
        }

        return null;
    }

    private async navigateTo(path: string): Promise<void> {
        try {
            await this.router.navigate([path]);
        } catch (error) {
            console.error('[BottomNavigationBar] Navigation failed:', error);
            this.router.navigate(['/explore']);
        }
    }

    private async navigateToLogin(returnUrl: string): Promise<void> {
        const safeReturnUrl = returnUrl.startsWith('/') ? returnUrl : '/explore';

        try {
            await this.router.navigate(['/login'], {
                queryParams: { returnUrl: safeReturnUrl },
            });
        } catch (error) {
            console.error('[BottomNavigationBar] Navigation to login failed:', error);
            this.router.navigate(['/explore']);
        }
    }
}
