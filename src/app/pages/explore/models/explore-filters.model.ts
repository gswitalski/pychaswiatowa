export type ExploreFilterDiet = 'vege_plus' | 'vegan' | null;

export interface ExploreFilters {
    termorobot: boolean;
    grill: boolean;
    diet: ExploreFilterDiet;
    favorite: boolean;
    wantToTry: boolean;
}

export const EXPLORE_FILTERS_DEFAULT: ExploreFilters = {
    termorobot: false,
    grill: false,
    diet: null,
    favorite: false,
    wantToTry: false,
};
