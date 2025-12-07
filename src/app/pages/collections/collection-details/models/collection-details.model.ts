import {
    RecipeListItemDto,
    PaginationDetails,
} from '../../../../../../shared/contracts/types';

/**
 * Model widoku dla strony szczegółów kolekcji
 */
export interface CollectionDetailsViewModel {
    /** ID kolekcji */
    id: number;
    /** Nazwa kolekcji */
    name: string;
    /** Opis kolekcji */
    description: string | null;
    /** Lista przepisów w kolekcji */
    recipes: RecipeListItemDto[];
    /** Informacje o paginacji */
    pagination: PaginationDetails;
    /** Flaga stanu ładowania */
    isLoading: boolean;
    /** Komunikat błędu */
    error: string | null;
}

/**
 * Stan początkowy dla widoku szczegółów kolekcji
 */
export const initialCollectionDetailsState: CollectionDetailsViewModel = {
    id: 0,
    name: '',
    description: null,
    recipes: [],
    pagination: {
        currentPage: 1,
        totalPages: 0,
        totalItems: 0,
    },
    isLoading: true,
    error: null,
};
