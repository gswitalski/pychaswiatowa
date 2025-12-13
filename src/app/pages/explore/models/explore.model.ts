import { RecipeCardData } from '../../../shared/components/recipe-card/recipe-card';
import { PaginationDetails } from '../../../../../shared/contracts/types';

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
 */
export interface ExplorePageState {
    /** Lista przepisów do wyświetlenia */
    recipes: RecipeCardData[];
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
    recipes: [],
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
