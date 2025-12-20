import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    OnInit,
    signal,
    untracked,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';

import { RecipesFiltersComponent } from './components/recipes-filters/recipes-filters.component';
import {
    RecipeListComponent,
    RecipeListItemViewModel,
} from '../../../shared/components/recipe-list/recipe-list.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RecipesService, GetRecipesParams } from '../services/recipes.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { TagsService } from '../../../core/services/tags.service';
import {
    CategoryDto,
    RecipeListItemDto,
    TagDto,
} from '../../../../../shared/contracts/types';
import {
    DEFAULT_FILTERS,
    RecipesFiltersViewModel,
} from './models/recipes-filters.model';

interface RecipesPageState {
    recipes: RecipeListItemDto[];
    pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
    };
    categories: CategoryDto[];
    tags: TagDto[];
    isLoading: boolean;
    isInitialLoading: boolean;
    error: string | null;
}

@Component({
    selector: 'pych-recipes-list-page',
    standalone: true,
    imports: [
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatPaginatorModule,
        MatSnackBarModule,
        RecipesFiltersComponent,
        RecipeListComponent,
        PageHeaderComponent,
        EmptyStateComponent,
    ],
    templateUrl: './recipes-list-page.component.html',
    styleUrl: './recipes-list-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipesListPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly recipesService = inject(RecipesService);
    private readonly categoriesService = inject(CategoriesService);
    private readonly tagsService = inject(TagsService);
    private readonly snackBar = inject(MatSnackBar);

    /** Stan strony */
    private readonly state = signal<RecipesPageState>({
        recipes: [],
        pagination: { currentPage: 1, totalPages: 0, totalItems: 0 },
        categories: [],
        tags: [],
        isLoading: false,
        isInitialLoading: true,
        error: null,
    });

    /** Stan filtrów */
    readonly filters = signal<RecipesFiltersViewModel>(DEFAULT_FILTERS);

    /** Stan paginacji */
    readonly paginationState = signal<{ page: number; limit: number }>({
        page: 1,
        limit: 12,
    });

    /** Computed signals */
    readonly recipes = computed(() => this.state().recipes);
    readonly pagination = computed(() => this.state().pagination);
    readonly categories = computed(() => this.state().categories);
    readonly tags = computed(() => this.state().tags);
    readonly isLoading = computed(() => this.state().isLoading);
    readonly isInitialLoading = computed(() => this.state().isInitialLoading);
    readonly error = computed(() => this.state().error);
    readonly recipeListItems = computed<RecipeListItemViewModel[]>(() =>
        this.recipes().map((recipe) => ({
            card: {
                id: recipe.id,
                name: recipe.name,
                imageUrl: recipe.image_path,
                categoryName: recipe.category_name ?? null,
                isTermorobot: recipe.is_termorobot ?? false,
            },
            isOwnRecipe: recipe.is_owner,
            inMyCollections: recipe.in_my_collections,
        }))
    );

    /** Opcje paginatora */
    readonly pageSizeOptions = [6, 12, 24, 48];

    constructor() {
        // Effect reagujący na zmiany filtrów i paginacji
        effect(() => {
            const currentFilters = this.filters();
            const currentPagination = this.paginationState();

            // Nie wykonuj zapytania przy inicjalnym ładowaniu (obsługiwane przez ngOnInit)
            // Użyj untracked żeby nie śledzić zmian w state
            const isInitial = untracked(() => this.state().isInitialLoading);
            if (isInitial) {
                return;
            }

            untracked(() => this.loadRecipes(currentFilters, currentPagination));
        });
    }

    ngOnInit(): void {
        // Odczytaj query parameters z URL i ustaw początkowe filtry
        const categoryParam = this.route.snapshot.queryParamMap.get('category');
        const tagParam = this.route.snapshot.queryParamMap.get('tag');

        const initialFilters: RecipesFiltersViewModel = { ...DEFAULT_FILTERS };

        // Ustaw filtr kategorii jeśli jest w URL
        if (categoryParam) {
            const categoryId = parseInt(categoryParam, 10);
            if (!isNaN(categoryId)) {
                initialFilters.categoryId = categoryId;
            }
        }

        // Ustaw filtr tagu jeśli jest w URL
        if (tagParam) {
            initialFilters.tags = [tagParam];
        }

        // Zaktualizuj stan filtrów przed załadowaniem danych
        this.filters.set(initialFilters);

        this.loadInitialData();
    }

    /**
     * Ładuje początkowe dane: kategorie, tagi i przepisy
     */
    private loadInitialData(): void {
        this.state.update((s) => ({ ...s, isInitialLoading: true, error: null }));

        forkJoin({
            categories: this.categoriesService.loadCategories(),
            tags: this.tagsService.loadTags(),
        }).subscribe({
            next: ({ categories, tags }) => {
                this.state.update((s) => ({
                    ...s,
                    categories,
                    tags,
                    isInitialLoading: false,
                }));

                // Teraz załaduj przepisy
                this.loadRecipes(this.filters(), this.paginationState());
            },
            error: () => {
                this.state.update((s) => ({
                    ...s,
                    isInitialLoading: false,
                    error: 'Nie udało się załadować danych. Spróbuj ponownie.',
                }));
                this.showError('Wystąpił błąd podczas ładowania danych.');
            },
        });
    }

    /**
     * Ładuje przepisy z API
     */
    private loadRecipes(
        filters: RecipesFiltersViewModel,
        pagination: { page: number; limit: number }
    ): void {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        const params: GetRecipesParams = {
            page: pagination.page,
            limit: pagination.limit,
            sort: `${filters.sortBy}.${filters.sortDirection}`,
            search: filters.searchQuery ?? undefined,
            categoryId: filters.categoryId,
            tags: filters.tags.length > 0 ? filters.tags : undefined,
            view: 'my_recipes',
            termorobot: filters.termorobot,
        };

        this.recipesService.getRecipes(params).subscribe({
            next: (response) => {
                this.state.update((s) => ({
                    ...s,
                    recipes: response.data,
                    pagination: response.pagination,
                    isLoading: false,
                }));
            },
            error: () => {
                this.state.update((s) => ({
                    ...s,
                    isLoading: false,
                    error: 'Nie udało się pobrać przepisów.',
                }));
                this.showError('Nie udało się pobrać przepisów. Spróbuj ponownie.');
            },
        });
    }

    /**
     * Obsługuje zmianę filtrów
     */
    onFiltersChange(newFilters: RecipesFiltersViewModel): void {
        // Resetuj stronę na pierwszą przy zmianie filtrów
        this.paginationState.update((p) => ({ ...p, page: 1 }));
        this.filters.set(newFilters);
    }

    /**
     * Obsługuje zmianę strony
     */
    onPageChange(event: PageEvent): void {
        this.paginationState.set({
            page: event.pageIndex + 1,
            limit: event.pageSize,
        });
    }

    /**
     * Wyświetla komunikat o błędzie
     */
    private showError(message: string): void {
        this.snackBar.open(message, 'Zamknij', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
        });
    }
}
