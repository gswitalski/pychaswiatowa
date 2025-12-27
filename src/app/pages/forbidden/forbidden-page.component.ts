import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { AuthService } from '../../core/services/auth.service';

/**
 * Forbidden (403) error page component.
 * Displays a neutral access denied message without revealing resource details.
 * Provides contextual navigation actions based on authentication state.
 */
@Component({
    selector: 'pych-forbidden-page',
    standalone: true,
    imports: [
        MatButtonModule,
        PageHeaderComponent,
        EmptyStateComponent,
    ],
    templateUrl: './forbidden-page.component.html',
    styleUrl: './forbidden-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPageComponent {
    private readonly router = inject(Router);
    private readonly location = inject(Location);
    private readonly authService = inject(AuthService);

    /** Computed signal for authentication state */
    protected readonly isAuthenticated = this.authService.isAuthenticated;

    /**
     * Navigate back in history or fallback to home page
     */
    onBackClick(): void {
        // Check if there's history to go back to
        const state = this.location.getState() as { navigationId: number };

        if (state?.navigationId > 1) {
            this.location.back();
        } else {
            // No history, navigate to home/explore
            this.router.navigate(['/']);
        }
    }

    /**
     * Navigate to Explore page
     */
    onExploreClick(): void {
        this.router.navigate(['/explore']);
    }

    /**
     * Navigate to Dashboard (for authenticated users)
     */
    onDashboardClick(): void {
        this.router.navigate(['/dashboard']);
    }

    /**
     * Navigate to Login page (for guests)
     */
    onLoginClick(): void {
        this.router.navigate(['/login'], {
            queryParams: { redirectTo: '/dashboard' }
        });
    }
}

