/**
 * Typy dla publicznego wyszukiwania przepisów.
 * Używane zarówno na Landing Page jak i Explore.
 */

import {
    PublicRecipeListItemDto,
    CursorPageInfoDto,
} from '../../../../../shared/contracts/types';

/**
 * Kontekst wyszukiwania - determinuje zachowanie pustej frazy i copy w UI.
 * - 'landing': pusta fraza = sekcje kuratorowane (feed), brak "brak wyników"
 * - 'explore': pusta fraza = feed (najnowsze)
 */
export type PublicRecipesSearchContext = 'landing' | 'explore';

/**
 * Tryb wyszukiwania.
 * - 'feed': brak wyszukiwania, domyślne sortowanie created_at.desc
 * - 'search': wyszukiwanie z relevance, etykiety dopasowania na kartach
 */
export type PublicRecipesSearchMode = 'feed' | 'search';

/**
 * ViewModel dla stanu wyszukiwania publicznych przepisów.
 */
export interface PublicRecipesSearchVm {
    /** Wartość z inputa (przed debounce) */
    queryDraft: string;
    /** Ostatnia "zatwierdzona" fraza (po debounce/enter) */
    queryCommitted: string;
    /** Aktualny tryb wyszukiwania */
    mode: PublicRecipesSearchMode;
    /** Lista przepisów */
    items: PublicRecipeListItemDto[];
    /** Informacje o paginacji cursor-based */
    pageInfo: CursorPageInfoDto;
    /** Czy trwa ładowanie początkowe danych */
    loadingInitial: boolean;
    /** Czy trwa doładowywanie kolejnych danych */
    loadingMore: boolean;
    /** Komunikat błędu (jeśli wystąpił) */
    errorMessage: string | null;
    /** Czy widoczna wskazówka "wpisz min. 3 znaki" */
    shortQueryHintVisible: boolean;
    /** Klucz ostatniego żądania do ignorowania spóźnionych odpowiedzi */
    lastRequestKey: string | null;
}

/**
 * Parametry pomocnicze do pobierania przepisów.
 */
export interface PublicRecipesFetchParams {
    /** Cursor do pobrania kolejnej strony */
    cursor: string | null;
    /** Liczba elementów na stronie */
    limit: number;
    /** Fraza wyszukiwania (tylko gdy qTrim.length >= 3) */
    q: string | null;
    /** Sortowanie (dla feed: created_at.desc, dla search: pominięte - backend domyślnie relevance) */
    sort: string | null;
}

/**
 * Domyślny stan ViewModel
 */
export const DEFAULT_PUBLIC_RECIPES_SEARCH_VM: PublicRecipesSearchVm = {
    queryDraft: '',
    queryCommitted: '',
    mode: 'feed',
    items: [],
    pageInfo: {
        hasMore: false,
        nextCursor: null,
    },
    loadingInitial: false,
    loadingMore: false,
    errorMessage: null,
    shortQueryHintVisible: false,
    lastRequestKey: null,
};

/**
 * Mapowanie źródła dopasowania na etykietę UI.
 */
export const MATCH_SOURCE_LABELS: Record<'name' | 'ingredients' | 'tags', string> = {
    name: 'nazwa',
    ingredients: 'składniki',
    tags: 'tagi',
};

