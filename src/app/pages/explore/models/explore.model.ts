import { RecipeCardData } from '../../../shared/components/recipe-card/recipe-card';
import { PublicRecipeListItemDto, CursorPageInfoDto } from '../../../../../shared/contracts/types';

/**
 * Stan zapytania do API dla widoku Explore.
 * Reprezentuje parametry wyszukiwania i sortowania (bez paginacji - używamy cursor).
 */
export interface ExploreQueryState {
    /** Fraza wyszukiwania (może być pustym stringiem) */
    q: string;
    /** Rozmiar strony */
    limit: number;
    /** Sortowanie w formacie 'column.direction' */
    sort: string;
}

/**
 * Stan strony Explore zawierający dane i stany UI.
 * Przechowuje surowe DTO aby móc wyliczać isOwnRecipe dynamicznie.
 * Używa cursor-based pagination.
 */
export interface ExplorePageState {
    /** Surowe dane przepisów z API (zawierają informacje o autorze) */
    items: PublicRecipeListItemDto[];
    /** Informacje o cursor pagination */
    pageInfo: CursorPageInfoDto;
    /** Czy trwa ładowanie początkowe danych */
    isInitialLoading: boolean;
    /** Czy trwa doładowywanie kolejnych danych */
    isLoadingMore: boolean;
    /** Komunikat błędu (jeśli wystąpił) */
    errorMessage: string | null;
    /** Komunikat walidacji (np. za krótkie q) */
    validationMessage: string | null;
}

/**
 * Model widoku dla karty przepisu w widoku Explore (z informacją o własności i kolekcjach)
 */
export interface ExploreRecipeCardVm {
    card: RecipeCardData;
    isOwnRecipe: boolean;
    inMyCollections: boolean;
}

/**
 * Domyślny stan zapytania
 */
export const DEFAULT_QUERY_STATE: ExploreQueryState = {
    q: '',
    limit: 12,
    sort: 'created_at.desc',
};

/**
 * Domyślny stan strony
 */
export const DEFAULT_PAGE_STATE: ExplorePageState = {
    items: [],
    pageInfo: {
        hasMore: false,
        nextCursor: null,
    },
    isInitialLoading: true,
    isLoadingMore: false,
    errorMessage: null,
    validationMessage: null,
};
