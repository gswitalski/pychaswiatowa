import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    OnInit,
    DestroyRef,
} from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Breadcrumb } from '../../models/ui.models';

/**
 * Breadcrumbs component that displays navigation path based on router state.
 * Reads breadcrumb labels from route data configuration.
 */
@Component({
    selector: 'pych-breadcrumbs',
    standalone: true,
    imports: [MatIconModule, RouterLink],
    templateUrl: './breadcrumbs.component.html',
    styleUrl: './breadcrumbs.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BreadcrumbsComponent implements OnInit {
    private readonly router = inject(Router);
    private readonly activatedRoute = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);

    public readonly breadcrumbs = signal<Breadcrumb[]>([]);

    ngOnInit(): void {
        // Build breadcrumbs on initial load
        this.buildBreadcrumbs();

        // Rebuild on navigation
        this.router.events
            .pipe(
                filter((event) => event instanceof NavigationEnd),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
                this.buildBreadcrumbs();
            });
    }

    /**
     * Build breadcrumb list from activated route snapshot.
     */
    private buildBreadcrumbs(): void {
        const breadcrumbs: Breadcrumb[] = [];
        let currentRoute: ActivatedRoute | null = this.activatedRoute.root;
        let url = '';

        while (currentRoute !== null) {
            const children: ActivatedRoute[] = currentRoute.children;

            if (children.length === 0) {
                break;
            }

            const nextRoute: ActivatedRoute = children[0];
            const routeConfig = nextRoute.snapshot.routeConfig;
            const data = nextRoute.snapshot.data;

            if (routeConfig?.path) {
                // Build URL segment
                const pathSegments = routeConfig.path.split('/');
                for (const segment of pathSegments) {
                    if (segment.startsWith(':')) {
                        // Dynamic parameter - get value from params
                        const paramName = segment.substring(1);
                        const paramValue = nextRoute.snapshot.params[paramName];
                        url += `/${paramValue}`;
                    } else if (segment) {
                        url += `/${segment}`;
                    }
                }

                // Get breadcrumb label from route data
                if (data['breadcrumb']) {
                    let label = data['breadcrumb'] as string;

                    // Handle dynamic labels (if breadcrumb is a function or uses params)
                    if (typeof label === 'function') {
                        label = (label as (data: unknown) => string)(
                            nextRoute.snapshot.data
                        );
                    }

                    breadcrumbs.push({
                        label,
                        url,
                    });
                }
            }

            currentRoute = nextRoute;
        }

        this.breadcrumbs.set(breadcrumbs);
    }
}
