import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
    AdminRecipeListItemDto,
    GetAdminRecipesQueryDto,
} from '../../../../../shared/contracts/types';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { AdminUsersPageHeaderComponent } from '../admin-users/admin-users-page-header.component';
import { AdminRecipesTableComponent } from './admin-recipes-table.component';
import { AdminRecipesFiltersComponent } from './admin-recipes-filters.component';
import {
    AdminRecipesPageChangeEvent,
    AdminRecipesSortChangeEvent,
    AdminRecipesTableRowVm,
    AdminRecipesTableStateVm,
    buildAuthorDisplayId,
    AdminRecipesPaginationVm,
    AdminRecipesSortingVm,
    AdminRecipesFiltersVm,
    EMPTY_ADMIN_RECIPES_FILTERS,
    countActiveAdminRecipeFilters,
} from './admin-recipes.models';

const AVERAGE_RATING_FORMATTER = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

@Component({
    selector: 'pych-admin-recipes-page',
    standalone: true,
    imports: [AdminUsersPageHeaderComponent, AdminRecipesFiltersComponent, AdminRecipesTableComponent],
    templateUrl: './admin-recipes-page.component.html',
    styleUrl: './admin-recipes-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRecipesPageComponent implements OnInit {
    private readonly adminApi = inject(AdminApiService);
    private readonly categoriesService = inject(CategoriesService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    private latestRequestId = 0;

    readonly title = 'Przepisy publiczne';
    readonly description =
        'Przegląd przepisów publicznych w aplikacji. Przepisy prywatne i udostępnione linkiem nie są tutaj pokazywane.';
    readonly displayedColumns: readonly string[] = [
        'id',
        'name',
        'author',
        'category',
        'createdAt',
        'averageRating',
        'ratingsCount',
        'flags',
        'actions',
    ];
    readonly query = signal<GetAdminRecipesQueryDto>({
        page: 1,
        page_size: 25,
        sort_by: 'created_at',
        sort_dir: 'desc',
    });
    readonly rows = signal<AdminRecipesTableRowVm[]>([]);
    readonly pagination = signal<AdminRecipesPaginationVm>({
        currentPage: 1,
        pageSize: 25,
        totalPages: 0,
        totalItems: 0,
    });
    readonly sorting = signal<AdminRecipesSortingVm>({
        sort_by: 'created_at',
        sort_dir: 'desc',
    });
    readonly isInitialLoading = signal(true);
    readonly isRefreshing = signal(false);
    readonly errorMessage = signal<string | null>(null);
    readonly appliedFilters = signal<AdminRecipesFiltersVm>(EMPTY_ADMIN_RECIPES_FILTERS);
    readonly categories = this.categoriesService.categories;
    readonly categoriesLoading = this.categoriesService.loading;
    readonly categoriesError = this.categoriesService.error;
    readonly activeFilterCount = computed(() => countActiveAdminRecipeFilters(this.appliedFilters()));

    private readonly isIdle = computed(
        () => !this.isInitialLoading() && !this.isRefreshing() && !this.errorMessage()
    );
    readonly isEmpty = computed(
        () => this.isIdle() && this.rows().length === 0 && this.pagination().totalItems === 0
    );
    readonly hasNoRowsOnPage = computed(
        () => this.isIdle() && this.rows().length === 0 && this.pagination().totalItems > 0
    );
    readonly tableState = computed<AdminRecipesTableStateVm>(() => ({
        isInitialLoading: this.isInitialLoading(),
        isRefreshing: this.isRefreshing(),
        isEmpty: this.isEmpty(),
        hasNoRowsOnPage: this.hasNoRowsOnPage(),
        hasError: this.errorMessage() !== null,
        errorMessage: this.errorMessage(),
        hasActiveFilters: this.activeFilterCount() > 0,
    }));

    ngOnInit(): void {
        this.categoriesService.loadCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
        this.loadRecipes(this.query());
    }

    onFiltersApply(filters: AdminRecipesFiltersVm): void {
        this.appliedFilters.set(filters);
        const nextQuery = {
            ...this.query(),
            ...this.filtersToQuery(filters),
            page: 1,
        };
        this.query.set(nextQuery);
        this.loadRecipes(nextQuery);
    }

    onFiltersClear(): void {
        this.appliedFilters.set(EMPTY_ADMIN_RECIPES_FILTERS);
        const nextQuery = {
            page: 1,
            page_size: this.query().page_size,
            sort_by: this.query().sort_by,
            sort_dir: this.query().sort_dir,
        };
        this.query.set(nextQuery);
        this.loadRecipes(nextQuery);
    }

    onRetryCategories(): void {
        this.categoriesService.clearCache();
        this.categoriesService.loadCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }

    onRetry(): void {
        this.loadRecipes(this.query());
    }

    onSortChange(event: AdminRecipesSortChangeEvent): void {
        const currentQuery = this.query();
        const nextQuery = {
            ...currentQuery,
            page: 1,
            sort_by: event.sort_by,
            sort_dir: event.sort_dir,
        };
        if (
            currentQuery.page === 1 &&
            currentQuery.sort_by === nextQuery.sort_by &&
            currentQuery.sort_dir === nextQuery.sort_dir
        ) {
            return;
        }

        this.query.set(nextQuery);
        this.loadRecipes(nextQuery);
    }

    onPageChange(event: AdminRecipesPageChangeEvent): void {
        const currentQuery = this.query();
        const sizeChanged = event.page_size !== currentQuery.page_size;
        const nextQuery = {
            ...currentQuery,
            page: sizeChanged ? 1 : Math.max(1, event.page),
            page_size: event.page_size,
        };
        if (
            currentQuery.page === nextQuery.page &&
            currentQuery.page_size === nextQuery.page_size
        ) {
            return;
        }

        if (sizeChanged) {
            this.pagination.update((pagination) => ({
                ...pagination,
                currentPage: 1,
                pageSize: event.page_size,
            }));
        }
        this.query.set(nextQuery);
        this.loadRecipes(nextQuery);
    }

    private loadRecipes(
        query: GetAdminRecipesQueryDto,
        isCorrection = false
    ): void {
        const requestId = ++this.latestRequestId;
        const hasExistingContent = this.rows().length > 0 || this.pagination().totalItems > 0;

        this.errorMessage.set(null);
        this.isRefreshing.set(hasExistingContent);
        this.isInitialLoading.set(!hasExistingContent);

        this.adminApi
            .getRecipes(query)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (response) => {
                    if (requestId !== this.latestRequestId) {
                        return;
                    }

                    if (
                        !isCorrection &&
                        response.data.length === 0 &&
                        response.pagination.totalItems > 0 &&
                        response.pagination.currentPage > response.pagination.totalPages
                    ) {
                        this.loadRecipes(
                            { ...query, page: response.pagination.totalPages },
                            true
                        );
                        return;
                    }

                    this.rows.set(response.data.map((recipe) => this.mapRecipeToRow(recipe)));
                    this.pagination.set(response.pagination);
                    this.sorting.set(response.sorting);
                    this.query.set({
                        ...this.filtersToQuery(this.appliedFilters()),
                        page: response.pagination.currentPage,
                        page_size: response.pagination.pageSize,
                        sort_by: response.sorting.sort_by,
                        sort_dir: response.sorting.sort_dir,
                    });
                    this.errorMessage.set(null);
                    this.isInitialLoading.set(false);
                    this.isRefreshing.set(false);
                },
                error: (error: Error & { status?: number }) => {
                    if (requestId !== this.latestRequestId) {
                        return;
                    }

                    this.isInitialLoading.set(false);
                    this.isRefreshing.set(false);
                    if (error.status === 401) {
                        this.router.navigate(['/login'], {
                            queryParams: { returnUrl: '/admin/recipes' },
                        });
                        return;
                    }
                    if (error.status === 403) {
                        this.router.navigate(['/forbidden']);
                        return;
                    }

                    this.errorMessage.set(
                        'Nie udało się pobrać listy przepisów publicznych. Odśwież widok lub spróbuj ponownie.'
                    );
                },
            });
    }

    private filtersToQuery(filters: AdminRecipesFiltersVm): Partial<GetAdminRecipesQueryDto> {
        return {
            ...(filters.id !== null ? { id: filters.id } : {}),
            ...(filters.name ? { name: filters.name } : {}),
            ...(filters.author ? { author: filters.author } : {}),
            ...(filters.categoryIds.length ? { category_id: [...filters.categoryIds] } : {}),
            ...(filters.includeUncategorized ? { uncategorized: true } : {}),
            ...(filters.createdFrom ? { created_from: filters.createdFrom } : {}),
            ...(filters.createdTo ? { created_to: filters.createdTo } : {}),
            ...(filters.ratingMin !== null ? { rating_min: filters.ratingMin } : {}),
            ...(filters.ratingMax !== null ? { rating_max: filters.ratingMax } : {}),
            ...(filters.ratingsCountMin !== null ? { ratings_count_min: filters.ratingsCountMin } : {}),
            ...(filters.ratingsCountMax !== null ? { ratings_count_max: filters.ratingsCountMax } : {}),
            ...(filters.isGrill ? { is_grill: true } : {}),
            ...(filters.isTermorobot ? { is_termorobot: true } : {}),
        };
    }

    private mapRecipeToRow(recipe: AdminRecipeListItemDto): AdminRecipesTableRowVm {
        const authorUsername = recipe.author_username?.trim() || '';
        const authorEmail = recipe.author_email?.trim() || '';
        const authorPrimaryLabel =
            authorUsername ||
            (authorEmail ? 'Brak nazwy użytkownika' : buildAuthorDisplayId(recipe.author_id));
        const averageRating = recipe.average_rating;

        return {
            id: recipe.id,
            name: recipe.name,
            authorId: recipe.author_id,
            authorPrimaryLabel,
            authorSecondaryLabel: authorEmail || null,
            categoryLabel: recipe.category_name?.trim() || '—',
            createdAtLabel: this.formatDateLabel(recipe.created_at, 'Brak daty'),
            averageRatingLabel:
                typeof averageRating === 'number' && Number.isFinite(averageRating)
                    ? AVERAGE_RATING_FORMATTER.format(averageRating)
                    : '—',
            ratingsCount: Number.isFinite(recipe.ratings_count) ? recipe.ratings_count : 0,
            isGrill: recipe.is_grill === true,
            isTermorobot: recipe.is_termorobot === true,
            recipeUrl: `/explore/recipes/${recipe.id}`,
            openAriaLabel: `Otwórz przepis ${recipe.name} w nowej karcie`,
        };
    }

    private formatDateLabel(value: string, fallback: string): string {
        const parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
            return fallback;
        }

        return parsedDate.toLocaleString('pl-PL', {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    }
}
