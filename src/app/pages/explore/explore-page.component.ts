import {
    Component,
    ChangeDetectionStrategy,
    inject,
    signal,
    effect,
    computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of } from 'rxjs';

import { PublicRecipesService, GetPublicRecipesFeedParams } from '../../core/services/public-recipes.service';
import { AuthService } from '../../core/services/auth.service';
import { PublicRecipesSearchComponent } from '../landing/components/public-recipes-search/public-recipes-search';
import { RecipeCardData } from '../../shared/components/recipe-card/recipe-card';
import {
    RecipeListComponent,
    RecipeListItemViewModel,
} from '../../shared/components/recipe-list/recipe-list.component';
import {
    ExplorePageState,
    ExploreQueryState,
    DEFAULT_PAGE_STATE,
    DEFAULT_QUERY_STATE,
} from './models/explore.model';
import { PublicRecipeListItemDto } from '../../../../shared/contracts/types';

/**
 * Komponent strony Explore - publiczny katalog przepisów.
 * Umożliwia przeglądanie i wyszukiwanie publicznych przepisów przez gości (niezalogowanych użytkowników).
 */
@Component({
    selector: 'pych-explore-page',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        PublicRecipesSearchComponent,
        RecipeListComponent,
    ],
    templateUrl: './explore-page.component.html',
    styleUrl: './explore-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplorePageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly publicRecipesService = inject(PublicRecipesService);
    private readonly authService = inject(AuthService);
    private readonly snackBar = inject(MatSnackBar);

    /** Stan zapytania (synchronizowany z URL) */
    readonly queryState = signal<ExploreQueryState>({ ...DEFAULT_QUERY_STATE });

    /** Stan strony */
    readonly pageState = signal<ExplorePageState>({ ...DEFAULT_PAGE_STATE });

    /** ID aktualnie zalogowanego użytkownika (null jeśli gość) */
    readonly currentUserId = signal<string | null>(null);

    /** Computed: aktualny query string dla wyszukiwarki */
    readonly currentQuery = computed(() => this.queryState().q);

    /** Computed: lista kart przepisów z informacją o własności i kolekcjach */
    readonly recipeListItems = computed<RecipeListItemViewModel[]>(() => {
        const items = this.pageState().items;
        const userId = this.currentUserId();

        return items.map((dto) => ({
            card: this.mapToRecipeCard(dto),
            isOwnRecipe: userId !== null && dto.author.id === userId,
            inMyCollections: dto.in_my_collections,
        }));
    });

    /** Computed: opis dla stanu pustego zależny od wyszukiwanej frazy */
    readonly emptyStateDescription = computed(() =>
        this.queryState().q
            ? 'Spróbuj zmienić frazę wyszukiwania lub wyszukaj czegoś innego'
            : 'Brak publicznych przepisów do wyświetlenia'
    );

    constructor() {
        // Pobierz ID zalogowanego użytkownika (jeśli jest)
        this.initializeCurrentUser();

        // Inicjalizacja stanu z URL query params
        this.initializeFromUrl();

        // Effect reagujący na zmiany query state i pobierający pierwszą porcję danych
        effect(() => {
            const query = this.queryState();
            this.loadInitialRecipes(query);
        });
    }

    /**
     * Pobiera ID aktualnie zalogowanego użytkownika z sesji.
     */
    private async initializeCurrentUser(): Promise<void> {
        try {
            const { data } = await this.authService.getSession();
            const userId = data?.session?.user?.id ?? null;
            this.currentUserId.set(userId);
        } catch (error) {
            console.error('Błąd pobierania sesji użytkownika:', error);
            this.currentUserId.set(null);
        }
    }

    /**
     * Inicjalizuje stan komponentu na podstawie parametrów URL.
     */
    private initializeFromUrl(): void {
        const params = this.route.snapshot.queryParamMap;

        const q = params.get('q') || '';
        const limit = this.parsePositiveInt(params.get('limit'), DEFAULT_QUERY_STATE.limit);
        const sort = params.get('sort') || DEFAULT_QUERY_STATE.sort;

        // Walidacja limitu - stała wartość 12 dla feed (nie eksponujemy zmiany w UI)
        const validatedLimit = 12;

        this.queryState.set({
            q: q.trim(),
            limit: validatedLimit,
            sort: this.validateSort(sort),
        });
    }

    /**
     * Parsuje string na liczbę całkowitą dodatnią.
     */
    private parsePositiveInt(value: string | null, fallback: number): number {
        if (!value) return fallback;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) || parsed < 1 ? fallback : parsed;
    }

    /**
     * Waliduje wartość sortowania (whitelist).
     */
    private validateSort(sort: string): string {
        const allowedSorts = ['created_at.desc', 'created_at.asc', 'name.asc', 'name.desc'];
        return allowedSorts.includes(sort) ? sort : DEFAULT_QUERY_STATE.sort;
    }

    /**
     * Pobiera pierwszą porcję przepisów z API (cursor-based).
     * Wywoływana automatycznie przez effect przy zmianie queryState.
     */
    private loadInitialRecipes(query: ExploreQueryState): void {
        // Walidacja: q musi mieć min. 2 znaki jeśli nie jest puste
        if (query.q.length === 1) {
            this.pageState.update(state => ({
                ...state,
                validationMessage: 'Wpisz co najmniej 2 znaki',
                isInitialLoading: false,
            }));
            return;
        }

        // Reset listy i ustaw stan ładowania początkowego
        this.pageState.update(state => ({
            ...state,
            items: [],
            pageInfo: { hasMore: false, nextCursor: null },
            isInitialLoading: true,
            errorMessage: null,
            validationMessage: null,
        }));

        // Przygotuj parametry API (cursor undefined = pierwsza porcja)
        const params: GetPublicRecipesFeedParams = {
            cursor: undefined,
            limit: query.limit,
            sort: query.sort,
        };

        // Tylko wysyłaj q jeśli ma min. 2 znaki
        if (query.q.length >= 2) {
            params.q = query.q;
        }

        // Wywołaj API
        this.publicRecipesService
            .getPublicRecipesFeed(params)
            .pipe(
                catchError(error => {
                    console.error('Błąd pobierania przepisów:', error);
                    this.pageState.update(state => ({
                        ...state,
                        errorMessage: 'Wystąpił błąd podczas pobierania przepisów. Spróbuj ponownie.',
                        isInitialLoading: false,
                    }));
                    return of(null);
                })
            )
            .subscribe({
                next: response => {
                    if (response) {
                        this.pageState.update(state => ({
                            ...state,
                            items: response.data,
                            pageInfo: response.pageInfo,
                            isInitialLoading: false,
                            errorMessage: null,
                        }));
                    }
                },
            });
    }

    /**
     * Doładowuje kolejną porcję przepisów (kliknięcie "Więcej").
     */
    onLoadMore(): void {
        const state = this.pageState();
        const query = this.queryState();

        // Guard: jeśli już ładuje lub brak kolejnych danych, nie rób nic
        if (state.isLoadingMore || !state.pageInfo.hasMore) {
            return;
        }

        // Ustaw stan ładowania kolejnych danych (bez czyszczenia items)
        this.pageState.update(s => ({
            ...s,
            isLoadingMore: true,
        }));

        // Przygotuj parametry API z cursorem
        const params: GetPublicRecipesFeedParams = {
            cursor: state.pageInfo.nextCursor ?? undefined,
            limit: query.limit,
            sort: query.sort,
        };

        if (query.q.length >= 2) {
            params.q = query.q;
        }

        // Wywołaj API
        this.publicRecipesService
            .getPublicRecipesFeed(params)
            .pipe(
                catchError(error => {
                    console.error('Błąd doładowania przepisów:', error);
                    this.pageState.update(s => ({
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
                next: response => {
                    if (response) {
                        // Dopnij nowe wyniki do istniejącej listy
                        this.pageState.update(s => ({
                            ...s,
                            items: [...s.items, ...response.data],
                            pageInfo: response.pageInfo,
                            isLoadingMore: false,
                        }));
                    }
                },
            });
    }

    /**
     * Mapuje DTO na dane karty przepisu.
     */
    private mapToRecipeCard(dto: PublicRecipeListItemDto): RecipeCardData {
        return {
            id: dto.id,
            name: dto.name,
            imageUrl: dto.image_path,
            categoryName: dto.category?.name ?? null,
            slug: this.slugify(dto.name),
            isTermorobot: dto.is_termorobot ?? false,
        };
    }

    /**
     * Generuje slug z nazwy przepisu.
     */
    private slugify(text: string): string {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Obsługuje submit wyszukiwania.
     * Resetuje listę do pierwszej porcji 12 elementów.
     */
    onSearchSubmit(query: string): void {
        const trimmedQuery = query.trim();

        // Aktualizuj query state (automatycznie wywołuje effect i reset listy)
        this.queryState.update(state => ({
            ...state,
            q: trimmedQuery,
        }));

        // Aktualizuj URL
        this.updateUrl();
    }

    /**
     * Ponawia ostatnie zapytanie (po błędzie początkowego ładowania).
     */
    onRetry(): void {
        const query = this.queryState();
        this.loadInitialRecipes(query);
    }

    /**
     * Aktualizuje URL query params na podstawie query state.
     * Nie przechowujemy cursorów w URL (tylko q, sort, limit jeśli wspierane).
     */
    private updateUrl(): void {
        const query = this.queryState();
        const queryParams: Record<string, string | number | null> = {};

        // Dodaj q tylko jeśli nie jest puste
        if (query.q) {
            queryParams['q'] = query.q;
        }

        // Dodaj sort tylko jeśli różny od domyślnego
        if (query.sort !== DEFAULT_QUERY_STATE.sort) {
            queryParams['sort'] = query.sort;
        }

        // Limit zawsze 12 w MVP feedu, więc nie dodajemy do URL

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams,
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }
}
