import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of, Subject, switchMap, debounceTime, distinctUntilChanged, tap } from 'rxjs';

import { PublicRecipesService, GetPublicRecipesFeedParams } from '../../../core/services/public-recipes.service';
import {
    PublicRecipesSearchVm,
    PublicRecipesSearchMode,
    PublicRecipesSearchContext,
    DEFAULT_PUBLIC_RECIPES_SEARCH_VM,
} from '../models/public-recipes-search.model';
import { PublicRecipeListItemDto, CursorPageInfoDto } from '../../../../../shared/contracts/types';

/**
 * Minimalna długość frazy do uruchomienia wyszukiwania
 */
const MIN_QUERY_LENGTH = 3;

/**
 * Domyślny czas debounce w ms
 */
const DEFAULT_DEBOUNCE_MS = 350;

/**
 * Domyślny rozmiar strony
 */
const DEFAULT_PAGE_SIZE = 12;

/**
 * Facade do zarządzania stanem publicznego wyszukiwania przepisów.
 * Wykorzystuje signals i RxJS do debounce'owania zapytań.
 */
@Injectable()
export class PublicRecipesFacade {
    private readonly publicRecipesService = inject(PublicRecipesService);

    // ==================== Signals ====================

    /** Wersja robocza zapytania (wartość z inputa) */
    readonly queryDraft = signal<string>('');

    /** Zatwierdzone zapytanie (po debounce) */
    readonly queryCommitted = signal<string>('');

    /** Lista przepisów */
    readonly items = signal<PublicRecipeListItemDto[]>([]);

    /** Informacje o paginacji */
    readonly pageInfo = signal<CursorPageInfoDto>({ hasMore: false, nextCursor: null });

    /** Czy trwa ładowanie początkowe */
    readonly loadingInitial = signal<boolean>(false);

    /** Czy trwa doładowywanie */
    readonly loadingMore = signal<boolean>(false);

    /** Komunikat błędu */
    readonly errorMessage = signal<string | null>(null);

    /** Klucz ostatniego żądania (do ignorowania spóźnionych odpowiedzi) */
    private readonly lastRequestKey = signal<string | null>(null);

    // ==================== Computed ====================

    /** Wersja query po trim */
    readonly queryTrimmed = computed(() => this.queryDraft().trim());

    /** Aktualny tryb wyszukiwania */
    readonly mode = computed<PublicRecipesSearchMode>(() =>
        this.queryTrimmed().length >= MIN_QUERY_LENGTH ? 'search' : 'feed'
    );

    /** Czy widoczna wskazówka "wpisz min. 3 znaki" */
    readonly shortQueryHintVisible = computed(() => {
        const len = this.queryTrimmed().length;
        return len >= 1 && len < MIN_QUERY_LENGTH;
    });

    /** Agregowany ViewModel */
    readonly vm = computed<PublicRecipesSearchVm>(() => ({
        queryDraft: this.queryDraft(),
        queryCommitted: this.queryCommitted(),
        mode: this.mode(),
        items: this.items(),
        pageInfo: this.pageInfo(),
        loadingInitial: this.loadingInitial(),
        loadingMore: this.loadingMore(),
        errorMessage: this.errorMessage(),
        shortQueryHintVisible: this.shortQueryHintVisible(),
        lastRequestKey: this.lastRequestKey(),
    }));

    // ==================== Internal State ====================

    private context: PublicRecipesSearchContext = 'explore';
    private debounceMs = DEFAULT_DEBOUNCE_MS;
    private pageSize = DEFAULT_PAGE_SIZE;

    /** Subject do debounce'owania zmian query */
    private readonly queryChange$ = new Subject<string>();

    constructor() {
        // Setup debounced query processing
        this.queryChange$
            .pipe(
                debounceTime(this.debounceMs),
                distinctUntilChanged(),
                tap((query) => this.processQuery(query)),
                takeUntilDestroyed()
            )
            .subscribe();
    }

    // ==================== Public API ====================

    /**
     * Inicjalizuje facade z konfiguracją.
     * @param context Kontekst wyszukiwania (landing/explore)
     * @param debounceMs Czas debounce w ms (domyślnie 350)
     * @param pageSize Rozmiar strony (domyślnie 12)
     * @param initialQuery Początkowe zapytanie (opcjonalne)
     */
    initialize(
        context: PublicRecipesSearchContext,
        debounceMs = DEFAULT_DEBOUNCE_MS,
        pageSize = DEFAULT_PAGE_SIZE,
        initialQuery = ''
    ): void {
        this.context = context;
        this.debounceMs = debounceMs;
        this.pageSize = pageSize;

        // Ustaw początkowe zapytanie bez debounce
        if (initialQuery) {
            this.queryDraft.set(initialQuery);
            this.processQuery(initialQuery);
        } else {
            // Dla explore: załaduj feed od razu
            // Dla landing: nie ładujemy (sekcje kuratorowane są ładowane osobno)
            if (context === 'explore') {
                this.loadInitial();
            }
        }
    }

    /**
     * Aktualizuje wersję roboczą zapytania (z inputa).
     * Automatycznie uruchamia debounced processing.
     */
    updateQueryDraft(query: string): void {
        this.queryDraft.set(query);
        this.queryChange$.next(query);
    }

    /**
     * Wymusza natychmiastowe przetworzenie zapytania (np. na Enter).
     * Pomija debounce.
     */
    submitQueryImmediate(query?: string): void {
        const q = query ?? this.queryDraft();
        this.queryDraft.set(q);
        this.processQuery(q);
    }

    /**
     * Doładowuje kolejną porcję wyników.
     */
    loadMore(): void {
        const pageInfoVal = this.pageInfo();

        // Guard: jeśli już ładuje lub brak kolejnych danych
        if (this.loadingMore() || this.loadingInitial() || !pageInfoVal.hasMore) {
            return;
        }

        this.loadingMore.set(true);

        const params = this.buildFetchParams(pageInfoVal.nextCursor);
        const requestKey = this.generateRequestKey();
        this.lastRequestKey.set(requestKey);

        this.publicRecipesService
            .getPublicRecipesFeed(params)
            .pipe(
                catchError((error) => {
                    console.error('Błąd doładowania przepisów:', error);
                    this.loadingMore.set(false);
                    return of(null);
                })
            )
            .subscribe((response) => {
                // Ignoruj spóźnione odpowiedzi
                if (this.lastRequestKey() !== requestKey) {
                    return;
                }

                this.loadingMore.set(false);

                if (response) {
                    // Dopnij nowe wyniki (deduplikacja po id)
                    const existingIds = new Set(this.items().map((i) => i.id));
                    const newItems = response.data.filter((i) => !existingIds.has(i.id));

                    this.items.update((items) => [...items, ...newItems]);
                    this.pageInfo.set(response.pageInfo);
                }
            });
    }

    /**
     * Ponawia ostatnie zapytanie (po błędzie).
     */
    retry(): void {
        this.errorMessage.set(null);
        this.loadInitial();
    }

    /**
     * Resetuje stan do wartości domyślnych.
     */
    reset(): void {
        this.queryDraft.set('');
        this.queryCommitted.set('');
        this.items.set([]);
        this.pageInfo.set({ hasMore: false, nextCursor: null });
        this.loadingInitial.set(false);
        this.loadingMore.set(false);
        this.errorMessage.set(null);
        this.lastRequestKey.set(null);
    }

    // ==================== Private Methods ====================

    /**
     * Przetwarza zapytanie po debounce.
     */
    private processQuery(query: string): void {
        const qTrim = query.trim();
        this.queryCommitted.set(qTrim);

        // Walidacja długości
        if (qTrim.length >= 1 && qTrim.length < MIN_QUERY_LENGTH) {
            // Za krótkie - nie wysyłamy zapytania
            // Dla explore: utrzymujemy poprzednie dane (bez białego flasha)
            // Dla landing: nie robimy nic (sekcje kuratorowane)
            return;
        }

        // Pusta fraza lub >= 3 znaki - ładujemy
        this.loadInitial();
    }

    /**
     * Ładuje pierwszą porcję danych.
     */
    private loadInitial(): void {
        // Ustaw stan ładowania (bez czyszczenia items - zasada "keep previous data visible")
        this.loadingInitial.set(true);
        this.errorMessage.set(null);

        const params = this.buildFetchParams(null);
        const requestKey = this.generateRequestKey();
        this.lastRequestKey.set(requestKey);

        this.publicRecipesService
            .getPublicRecipesFeed(params)
            .pipe(
                catchError((error) => {
                    console.error('Błąd pobierania przepisów:', error);
                    // Ignoruj spóźnione odpowiedzi
                    if (this.lastRequestKey() === requestKey) {
                        this.errorMessage.set('Wystąpił błąd podczas pobierania przepisów. Spróbuj ponownie.');
                        this.loadingInitial.set(false);
                    }
                    return of(null);
                })
            )
            .subscribe((response) => {
                // Ignoruj spóźnione odpowiedzi
                if (this.lastRequestKey() !== requestKey) {
                    return;
                }

                this.loadingInitial.set(false);

                if (response) {
                    this.items.set(response.data);
                    this.pageInfo.set(response.pageInfo);
                }
            });
    }

    /**
     * Buduje parametry dla API.
     */
    private buildFetchParams(cursor: string | null): GetPublicRecipesFeedParams {
        const qTrim = this.queryCommitted().trim();
        const params: GetPublicRecipesFeedParams = {
            limit: this.pageSize,
        };

        if (cursor) {
            params.cursor = cursor;
        }

        // Tylko wysyłaj q jeśli ma min. 3 znaki
        if (qTrim.length >= MIN_QUERY_LENGTH) {
            params.q = qTrim;
            // Dla search nie wymuszamy sort - backend domyślnie sortuje po relevance
        } else {
            // Dla feed: sortuj po dacie
            params.sort = 'created_at.desc';
        }

        return params;
    }

    /**
     * Generuje unikalny klucz żądania.
     */
    private generateRequestKey(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

