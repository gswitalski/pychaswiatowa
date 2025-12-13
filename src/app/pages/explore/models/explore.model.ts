import { RecipeCardData } from '../../../shared/components/recipe-card/recipe-card';
import { PaginationDetails, PublicRecipeListItemDto } from '../../../../../shared/contracts/types';

/**
 * Stan zapytania do API dla widoku Explore.
 * Reprezentuje parametry wyszukiwania i paginacji.
 */
export interface ExploreQueryState {
    /** Fraza wyszukiwania (może być pustym stringiem) */
    q: string;
    /** Numer strony (>= 1) */
    page: number;
    /** Rozmiar strony */
    limit: number;
    /** Sortowanie w formacie 'column.direction' */
    sort: string;
}

/**
 * Stan strony Explore zawierający dane i stany UI.
 * Przechowuje surowe DTO aby móc wyliczać isOwnRecipe dynamicznie.
 */
export interface ExplorePageState {
    /** Surowe dane przepisów z API (zawierają informacje o autorze) */
    items: PublicRecipeListItemDto[];
    /** Informacje o paginacji */
    pagination: PaginationDetails;
    /** Czy trwa ładowanie danych */
    isLoading: boolean;
    /** Czy to pierwsze ładowanie (do wyświetlenia skeleton) */
    isInitialLoading: boolean;
    /** Komunikat błędu (jeśli wystąpił) */
    errorMessage: string | null;
    /** Komunikat walidacji (np. za krótkie q) */
    validationMessage: string | null;
}

/**
 * Model widoku dla karty przepisu w widoku Explore (z informacją o własności)
 */
export interface ExploreRecipeCardVm {
    card: RecipeCardData;
    isOwnRecipe: boolean;
}

/**
 * Domyślny stan zapytania
 */
export const DEFAULT_QUERY_STATE: ExploreQueryState = {
    q: '',
    page: 1,
    limit: 12,
    sort: 'created_at.desc',
};

/**
 * Domyślny stan strony
 */
export const DEFAULT_PAGE_STATE: ExplorePageState = {
    items: [],
    pagination: {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
    },
    isLoading: false,
    isInitialLoading: true,
    errorMessage: null,
    validationMessage: null,
};
