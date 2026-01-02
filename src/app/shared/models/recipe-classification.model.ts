import { RecipeDietType, RecipeCuisine, RecipeDifficulty } from '../../../../shared/contracts/types';

/**
 * Mapa etykiet dla typów diety.
 * Używana zarówno w formularzu jak i w widoku szczegółów.
 */
export const RECIPE_DIET_TYPE_LABELS: Record<RecipeDietType, string> = {
    MEAT: 'Mięso',
    VEGETARIAN: 'Wege',
    VEGAN: 'Vegan',
};

/**
 * Mapa etykiet dla kuchni.
 * Używana zarówno w formularzu jak i w widoku szczegółów.
 */
export const RECIPE_CUISINE_LABELS: Record<RecipeCuisine, string> = {
    POLISH: 'Polska',
    ASIAN: 'Azjatycka',
    MEXICAN: 'Meksykańska',
    MIDDLE_EASTERN: 'Bliskowschodnia',
};

/**
 * Mapa etykiet dla poziomu trudności.
 * Używana zarówno w formularzu jak i w widoku szczegółów.
 */
export const RECIPE_DIFFICULTY_LABELS: Record<RecipeDifficulty, string> = {
    EASY: 'Łatwe',
    MEDIUM: 'Średnie',
    HARD: 'Trudne',
};

/**
 * Opcje dostępne dla typu diety w formularzu.
 */
export const RECIPE_DIET_TYPE_OPTIONS: RecipeDietType[] = ['MEAT', 'VEGETARIAN', 'VEGAN'];

/**
 * Opcje dostępne dla kuchni w formularzu.
 */
export const RECIPE_CUISINE_OPTIONS: RecipeCuisine[] = ['POLISH', 'ASIAN', 'MEXICAN', 'MIDDLE_EASTERN'];

/**
 * Opcje dostępne dla poziomu trudności w formularzu.
 */
export const RECIPE_DIFFICULTY_OPTIONS: RecipeDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];


