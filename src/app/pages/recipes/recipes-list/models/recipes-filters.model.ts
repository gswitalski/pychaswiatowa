/**
 * ViewModel dla stanu filtrów na liście przepisów
 */
export interface RecipesFiltersViewModel {
    /** Fraza wpisana w polu wyszukiwania */
    searchQuery: string | null;
    /** ID wybranej kategorii */
    categoryId: number | null;
    /** Tablica nazw wybranych tagów */
    tags: string[];
    /** Pole, po którym odbywa się sortowanie */
    sortBy: 'name' | 'created_at';
    /** Kierunek sortowania */
    sortDirection: 'asc' | 'desc';
}

/**
 * Opcja sortowania jako jeden string (dla selecta)
 */
export type SortOption =
    | 'created_at_desc'
    | 'created_at_asc'
    | 'name_asc'
    | 'name_desc';

/**
 * Domyślne wartości filtrów
 */
export const DEFAULT_FILTERS: RecipesFiltersViewModel = {
    searchQuery: null,
    categoryId: null,
    tags: [],
    sortBy: 'created_at',
    sortDirection: 'desc',
};

