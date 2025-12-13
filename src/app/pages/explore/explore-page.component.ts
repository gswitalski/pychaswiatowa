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
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { catchError, of } from 'rxjs';

import { PublicRecipesService } from '../../core/services/public-recipes.service';
import { AuthService } from '../../core/services/auth.service';
import { PublicRecipesSearchComponent } from '../landing/components/public-recipes-search/public-recipes-search';
import { RecipeCardComponent, RecipeCardData } from '../../shared/components/recipe-card/recipe-card';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import {
    ExplorePageState,
    ExploreQueryState,
    ExploreRecipeCardVm,
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
        MatPaginatorModule,
        MatProgressSpinnerModule,
        MatButtonModule,
        MatIconModule,
        PublicRecipesSearchComponent,
        RecipeCardComponent,
        EmptyStateComponent,
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

    /** Stan zapytania (synchronizowany z URL) */
    readonly queryState = signal<ExploreQueryState>({ ...DEFAULT_QUERY_STATE });

    /** Stan strony */
    readonly pageState = signal<ExplorePageState>({ ...DEFAULT_PAGE_STATE });

    /** ID aktualnie zalogowanego użytkownika (null jeśli gość) */
    readonly currentUserId = signal<string | null>(null);

    /** Computed: aktualny query string dla wyszukiwarki */
    readonly currentQuery = computed(() => this.queryState().q);

    /** Computed: lista kart przepisów z informacją o własności */
    readonly recipeCards = computed<ExploreRecipeCardVm[]>(() => {
        const items = this.pageState().items;
        const userId = this.currentUserId();

        return items.map(dto => ({
            card: this.mapToRecipeCard(dto),
            isOwnRecipe: userId !== null && dto.author.id === userId,
        }));
    });

    constructor() {
        // Pobierz ID zalogowanego użytkownika (jeśli jest)
        this.initializeCurrentUser();

        // Inicjalizacja stanu z URL query params
        this.initializeFromUrl();

        // Effect reagujący na zmiany query state i pobierający dane
        effect(() => {
            const query = this.queryState();
            this.loadRecipes(query);
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
        const page = this.parsePositiveInt(params.get('page'), DEFAULT_QUERY_STATE.page);
        const limit = this.parsePositiveInt(params.get('limit'), DEFAULT_QUERY_STATE.limit);
        const sort = params.get('sort') || DEFAULT_QUERY_STATE.sort;

        // Walidacja limitu - tylko dozwolone wartości
        const validatedLimit = [12, 24, 48].includes(limit) ? limit : DEFAULT_QUERY_STATE.limit;

        this.queryState.set({
            q: q.trim(),
            page: Math.max(1, page),
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
     * Pobiera przepisy z API na podstawie query state.
     */
    private loadRecipes(query: ExploreQueryState): void {
        // Walidacja: q musi mieć min. 2 znaki jeśli nie jest puste
        if (query.q.length === 1) {
            this.pageState.update(state => ({
                ...state,
                validationMessage: 'Wpisz co najmniej 2 znaki',
                isLoading: false,
                isInitialLoading: false,
            }));
            return;
        }

        // Ustaw stan ładowania (bez czyszczenia recipes - "keep previous data visible")
        this.pageState.update(state => ({
            ...state,
            isLoading: true,
            errorMessage: null,
            validationMessage: null,
        }));

        // Przygotuj parametry API (nie przekazuj q jeśli puste)
        const params: any = {
            page: query.page,
            limit: query.limit,
            sort: query.sort,
        };

        if (query.q.length >= 2) {
            params.q = query.q;
        }

        // Wywołaj API
        this.publicRecipesService
            .getPublicRecipes(params)
            .pipe(
                catchError(error => {
                    console.error('Błąd pobierania przepisów:', error);
                    return of({
                        data: [],
                        pagination: {
                            currentPage: query.page,
                            totalPages: 0,
                            totalItems: 0,
                        },
                    });
                })
            )
            .subscribe({
                next: response => {
                    // Zapisz surowe DTO (zawierają dane autora)
                    this.pageState.update(state => ({
                        ...state,
                        items: response.data,
                        pagination: response.pagination,
                        isLoading: false,
                        isInitialLoading: false,
                        errorMessage: null,
                    }));
                },
                error: error => {
                    this.pageState.update(state => ({
                        ...state,
                        errorMessage: 'Wystąpił błąd podczas pobierania przepisów. Spróbuj ponownie.',
                        isLoading: false,
                        isInitialLoading: false,
                    }));
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
     */
    onSearchSubmit(query: string): void {
        const trimmedQuery = query.trim();

        // Aktualizuj query state (reset strony do 1)
        this.queryState.update(state => ({
            ...state,
            q: trimmedQuery,
            page: 1,
        }));

        // Aktualizuj URL
        this.updateUrl();
    }

    /**
     * Obsługuje zmianę strony w paginatorze.
     */
    onPageChange(event: PageEvent): void {
        this.queryState.update(state => ({
            ...state,
            page: event.pageIndex + 1, // mat-paginator używa 0-based index
            limit: event.pageSize,
        }));

        // Aktualizuj URL
        this.updateUrl();

        // Scroll do góry strony
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Ponawia ostatnie zapytanie (po błędzie).
     */
    onRetry(): void {
        const query = this.queryState();
        this.loadRecipes(query);
    }

    /**
     * Aktualizuje URL query params na podstawie query state.
     */
    private updateUrl(): void {
        const query = this.queryState();
        const queryParams: any = {
            page: query.page > 1 ? query.page : null,
            limit: query.limit !== DEFAULT_QUERY_STATE.limit ? query.limit : null,
        };

        // Dodaj q tylko jeśli nie jest puste
        if (query.q) {
            queryParams.q = query.q;
        }

        // Dodaj sort tylko jeśli różny od domyślnego
        if (query.sort !== DEFAULT_QUERY_STATE.sort) {
            queryParams.sort = query.sort;
        }

        this.router.navigate([], {
            relativeTo: this.route,
            queryParams,
            queryParamsHandling: 'merge',
            replaceUrl: true,
        });
    }
}
