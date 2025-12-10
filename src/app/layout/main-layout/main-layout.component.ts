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

    /** Sidebar open state */
    readonly isSidebarOpen = this.layoutService.isSidebarOpen;

    /** Mobile viewport state */
    readonly isMobile = this.layoutService.isMobile;

    ngOnInit(): void {
        // Close sidebar on navigation (mobile only)
        this.router.events
            .pipe(
                filter((event) => event instanceof NavigationEnd),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
                if (this.isMobile()) {
                    this.layoutService.closeSidebar();
                }
            });
    }

    /**
     * Handle sidebar closed event (backdrop click on mobile)
     */
    onSidebarClosed(): void {
        this.layoutService.closeSidebar();
    }
}

