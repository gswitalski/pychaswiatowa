import {
    Component,
    ChangeDetectionStrategy,
    inject,
    signal,
    computed,
    OnInit,
    DestroyRef,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, of, Subject } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AuthService } from '../../core/services/auth.service';
import {
    CursorPageInfoDto,
    PublicRecipeListItemDto,
} from '../../../../shared/contracts/types';
import {
    GetPublicRecipesFeedParams,
    PublicRecipesService,
} from '../../core/services/public-recipes.service';
import { PublicRecipeResultsComponent } from '../landing/components/public-recipe-results/public-recipe-results';
import { ExploreRecipeFiltersComponent } from './components/explore-recipe-filters/explore-recipe-filters.component';
import {
    ExploreFilterStateService,
} from './services/explore-filter-state.service';
import {
    EXPLORE_FILTERS_DEFAULT,
    ExploreFilters,
} from './models/explore-filters.model';
import { PublicRecipesSearchMode } from './models/public-recipes-search.model';

@Component({
    selector: 'pych-explore-page',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        ExploreRecipeFiltersComponent,
        PublicRecipeResultsComponent,
    ],
    templateUrl: './explore-page.component.html',
    styleUrl: './explore-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorePageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly publicRecipesService = inject(PublicRecipesService);
    readonly filterState = inject(ExploreFilterStateService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly queryChanges$ = new Subject<string>();

    readonly filters = signal<ExploreFilters>({ ...EXPLORE_FILTERS_DEFAULT });
    readonly queryDraft = signal('');
    readonly queryCommitted = signal('');
    readonly items = signal<PublicRecipeListItemDto[]>([]);
    readonly pageInfo = signal<CursorPageInfoDto>({ hasMore: false, nextCursor: null });
    readonly loadingInitial = signal(false);
    readonly loadingMore = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly isAuthenticated = signal(false);
    private readonly lastRequestKey = signal<string | null>(null);

    readonly queryControl = new FormControl('', { nonNullable: true });
    readonly mode = computed<PublicRecipesSearchMode>(() =>
        this.queryCommitted().trim().length >= 3 ? 'search' : 'feed'
    );
    readonly shortQueryHintVisible = computed(() => {
        const length = this.queryDraft().trim().length;
        return length >= 1 && length < 3;
    });
    readonly showEmptyState = computed(() =>
        this.items().length === 0 && !this.loadingInitial() && !this.errorMessage()
    );

    constructor() {
        this.queryControl.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((query) => {
                this.queryDraft.set(query);
                this.queryChanges$.next(query);
            });

        this.queryChanges$
            .pipe(
                debounceTime(350),
                distinctUntilChanged(),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((query) => this.onQueryCommit(query));
    }

    ngOnInit(): void {
        this.route.queryParams
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((params) => {
                const query = typeof params['q'] === 'string' ? params['q'].trim() : '';
                this.filters.set(this.filterState.fromQueryParams(params));
                this.queryDraft.set(query);
                this.queryCommitted.set(query);
                this.queryControl.setValue(query, { emitEvent: false });

                if (query.length >= 1 && query.length < 3) {
                    return;
                }

                this.resetAndLoad();
            });

        void this.initializeCurrentUser();
    }

    onFiltersChange(filters: ExploreFilters): void {
        const nextFilters = this.isAuthenticated()
            ? filters
            : { ...filters, favorite: false, wantToTry: false };

        void this.router.navigate([], {
            queryParams: {
                ...this.filterState.toQueryParams(nextFilters),
                q: this.queryCommitted().trim() || undefined,
            },
        });
    }

    onSearchSubmit(): void {
        const query = this.queryControl.value.trim();

        if (query.length >= 1 && query.length < 3) {
            this.queryDraft.set(query);
            return;
        }

        this.onQueryCommit(query);
    }

    clearFilters(): void {
        void this.router.navigate([], {
            queryParams: {
                ...this.filterState.toQueryParams(this.filterState.reset()),
                q: this.queryCommitted().trim() || undefined,
            },
        });
    }

    loadMore(): void {
        const page = this.pageInfo();

        if (this.loadingMore() || this.loadingInitial() || !page.hasMore || !page.nextCursor) {
            return;
        }

        this.loadingMore.set(true);
        const requestKey = this.generateRequestKey();
        this.lastRequestKey.set(requestKey);

        this.publicRecipesService
            .getPublicRecipesFeed(this.buildFetchParams(page.nextCursor))
            .pipe(
                catchError((error) => {
                    console.error('Błąd doładowania przepisów:', error);
                    this.loadingMore.set(false);
                    return of(null);
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((response) => {
                if (this.lastRequestKey() !== requestKey) return;

                this.loadingMore.set(false);
                if (!response) return;

                const existingIds = new Set(this.items().map((item) => item.id));
                this.items.update((items) => [
                    ...items,
                    ...response.data.filter((item) => !existingIds.has(item.id)),
                ]);
                this.pageInfo.set(response.pageInfo);
            });
    }

    retry(): void {
        this.resetAndLoad();
    }

    private onQueryCommit(query: string): void {
        const normalizedQuery = query.trim();
        this.queryDraft.set(query);

        if (normalizedQuery.length >= 1 && normalizedQuery.length < 3) return;

        void this.router.navigate([], {
            queryParams: {
                ...this.filterState.toQueryParams(this.filters()),
                q: normalizedQuery || undefined,
            },
        });
    }

    private resetAndLoad(): void {
        this.pageInfo.set({ hasMore: false, nextCursor: null });
        this.loadInitial();
    }

    private loadInitial(): void {
        this.loadingInitial.set(true);
        this.errorMessage.set(null);
        const requestKey = this.generateRequestKey();
        this.lastRequestKey.set(requestKey);

        this.publicRecipesService
            .getPublicRecipesFeed(this.buildFetchParams(null))
            .pipe(
                catchError((error) => {
                    console.error('Błąd pobierania przepisów:', error);
                    if (this.lastRequestKey() === requestKey) {
                        this.errorMessage.set(
                            'Wystąpił błąd podczas pobierania przepisów. Spróbuj ponownie.'
                        );
                        this.loadingInitial.set(false);
                    }
                    return of(null);
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((response) => {
                if (this.lastRequestKey() !== requestKey) return;

                this.loadingInitial.set(false);
                if (!response) return;

                this.items.set(response.data);
                this.pageInfo.set(response.pageInfo);
            });
    }

    private buildFetchParams(cursor: string | null): GetPublicRecipesFeedParams {
        const query = this.queryCommitted().trim();
        const params: GetPublicRecipesFeedParams = {
            limit: 12,
            cursor: cursor ?? undefined,
            q: query.length >= 3 ? query : undefined,
            sort: query.length >= 3 ? undefined : 'created_at.desc',
        };

        const filterParams = this.filterState.toApiParams(this.filters());
        if (this.isAuthenticated()) {
            Object.assign(params, filterParams);
        } else {
            const { favorite: _favorite, want_to_try: _wantToTry, ...publicFilters } =
                filterParams;
            Object.assign(params, publicFilters);
        }

        return params;
    }

    private async initializeCurrentUser(): Promise<void> {
        try {
            const { data } = await this.authService.getSession();
            const authenticated = Boolean(data?.session?.user);
            this.isAuthenticated.set(authenticated);

            if (authenticated && (this.filters().favorite || this.filters().wantToTry)) {
                this.resetAndLoad();
            }
        } catch (error) {
            console.error('Błąd pobierania sesji użytkownika:', error);
            this.isAuthenticated.set(false);
        }
    }

    private generateRequestKey(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
}
