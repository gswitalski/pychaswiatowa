import {
    RecipeListItemDto,
    CollectionRecipesPageInfoDto,
} from '../../../../../../shared/contracts/types';

/**
 * Typy błędów dla widoku szczegółów kolekcji
 */
export type CollectionDetailsErrorKind = 
    | 'invalid_id'
    | 'not_found'
    | 'forbidden'
    | 'server'
    | 'unknown';

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
    /** Informacje o batch przepisów (bez paginacji UI) */
    recipesPageInfo: CollectionRecipesPageInfoDto | null;
    /** Flaga stanu ładowania */
    isLoading: boolean;
    /** Strukturyzowany błąd */
    error: {
        kind: CollectionDetailsErrorKind;
        message: string;
    } | null;
}

/**
 * Stan początkowy dla widoku szczegółów kolekcji
 */
export const initialCollectionDetailsState: CollectionDetailsViewModel = {
    id: 0,
    name: '',
    description: null,
    recipes: [],
    recipesPageInfo: null,
    isLoading: true,
    error: null,
};


