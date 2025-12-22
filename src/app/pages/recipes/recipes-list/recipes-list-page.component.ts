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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, catchError, of } from 'rxjs';

import { RecipesFiltersComponent } from './components/recipes-filters/recipes-filters.component';
import {
    RecipeListComponent,
    RecipeListItemViewModel,
} from '../../../shared/components/recipe-list/recipe-list.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RecipesService, GetRecipesFeedParams } from '../services/recipes.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { TagsService } from '../../../core/services/tags.service';
import {
    CategoryDto,
    RecipeListItemDto,
    TagDto,
    CursorPageInfoDto,
} from '../../../../../shared/contracts/types';
import {
    DEFAULT_FILTERS,
    RecipesFiltersViewModel,
} from './models/recipes-filters.model';

/**
 * Stan strony z przepisami używający cursor-based pagination
 */
interface RecipesPageState {
    recipes: RecipeListItemDto[];
    pageInfo: CursorPageInfoDto;
    categories: CategoryDto[];
    tags: TagDto[];
    isInitialLoading: boolean;
    isLoadingMore: boolean;
    error: string | null;
}

@Component({
    selector: 'pych-recipes-list-page',
    standalone: true,
    imports: [
        RouterLink,
        MatButtonModule,
        MatIconModule,
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

    /** Stały rozmiar porcji dla feedu */
    private readonly FEED_LIMIT = 12;

    /** Stan strony */
    private readonly state = signal<RecipesPageState>({
        recipes: [],
        pageInfo: { hasMore: false, nextCursor: null },
        categories: [],
        tags: [],
        isInitialLoading: true,
        isLoadingMore: false,
        error: null,
    });

    /** Stan filtrów */
    readonly filters = signal<RecipesFiltersViewModel>(DEFAULT_FILTERS);

    /** Computed signals */
    readonly recipes = computed(() => this.state().recipes);
    readonly pageInfo = computed(() => this.state().pageInfo);
    readonly categories = computed(() => this.state().categories);
    readonly tags = computed(() => this.state().tags);
    readonly isInitialLoading = computed(() => this.state().isInitialLoading);
    readonly isLoadingMore = computed(() => this.state().isLoadingMore);
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

    constructor() {
        // Effect reagujący na zmiany filtrów - resetuje listę i ładuje pierwszą porcję
        effect(() => {
            const currentFilters = this.filters();

            // Nie wykonuj zapytania przy inicjalnym ładowaniu (obsługiwane przez ngOnInit)
            const isInitial = untracked(() => this.state().isInitialLoading);
            if (isInitial) {
                return;
            }

            untracked(() => this.loadInitialRecipes(currentFilters));
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

                // Teraz załaduj pierwszą porcję przepisów
                this.loadInitialRecipes(this.filters());
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
     * Ładuje pierwszą porcję przepisów z API (cursor-based).
     * Wywoływana automatycznie przez effect przy zmianie filtrów.
     */
    private loadInitialRecipes(filters: RecipesFiltersViewModel): void {
        // Reset listy i ustaw stan początkowy
        this.state.update((s) => ({
            ...s,
            recipes: [],
            pageInfo: { hasMore: false, nextCursor: null },
            error: null,
        }));

        const params: GetRecipesFeedParams = {
            cursor: undefined, // Pierwsza porcja - brak cursora
            limit: this.FEED_LIMIT,
            sort: `${filters.sortBy}.${filters.sortDirection}`,
            search: filters.searchQuery ?? undefined,
            categoryId: filters.categoryId,
            tags: filters.tags.length > 0 ? filters.tags : undefined,
            view: 'my_recipes',
            termorobot: filters.termorobot,
        };

        this.recipesService.getRecipesFeed(params)
            .pipe(
                catchError(error => {
                    console.error('Błąd pobierania przepisów:', error);
                    this.state.update((s) => ({
                        ...s,
                        error: 'Nie udało się pobrać przepisów.',
                    }));
                    this.showError('Nie udało się pobrać przepisów. Spróbuj ponownie.');
                    return of(null);
                })
            )
            .subscribe({
                next: (response) => {
                    if (response) {
                        this.state.update((s) => ({
                            ...s,
                            recipes: response.data,
                            pageInfo: response.pageInfo,
                        }));
                    }
                },
            });
    }

    /**
     * Doładowuje kolejną porcję przepisów (kliknięcie "Więcej").
     */
    onLoadMore(): void {
        const currentState = this.state();
        const currentFilters = this.filters();

        // Guard: jeśli już ładuje lub brak kolejnych danych, nie rób nic
        if (currentState.isLoadingMore || !currentState.pageInfo.hasMore) {
            return;
        }

        // Ustaw stan ładowania kolejnych danych
        this.state.update((s) => ({
            ...s,
            isLoadingMore: true,
        }));

        const params: GetRecipesFeedParams = {
            cursor: currentState.pageInfo.nextCursor ?? undefined,
            limit: this.FEED_LIMIT,
            sort: `${currentFilters.sortBy}.${currentFilters.sortDirection}`,
            search: currentFilters.searchQuery ?? undefined,
            categoryId: currentFilters.categoryId,
            tags: currentFilters.tags.length > 0 ? currentFilters.tags : undefined,
            view: 'my_recipes',
            termorobot: currentFilters.termorobot,
        };

        this.recipesService.getRecipesFeed(params)
            .pipe(
                catchError(error => {
                    console.error('Błąd doładowania przepisów:', error);
                    this.state.update((s) => ({
                        ...s,
                        isLoadingMore: false,
                    }));
                    // Pokaż snackbar z możliwością ponowienia
                    this.snackBar.open(
                        'Nie udało się doładować przepisów.',
                        'Ponów',
                        { duration: 5000 }
                    ).onAction().subscribe(() => {
                        this.onLoadMore();
                    });
                    return of(null);
                })
            )
            .subscribe({
                next: (response) => {
                    if (response) {
                        // Dopnij nowe wyniki do istniejącej listy
                        this.state.update((s) => ({
                            ...s,
                            recipes: [...s.recipes, ...response.data],
                            pageInfo: response.pageInfo,
                            isLoadingMore: false,
                        }));
                    }
                },
            });
    }

    /**
     * Obsługuje zmianę filtrów.
     * Automatycznie wywoła effect i reset listy do pierwszej porcji.
     */
    onFiltersChange(newFilters: RecipesFiltersViewModel): void {
        this.filters.set(newFilters);
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
