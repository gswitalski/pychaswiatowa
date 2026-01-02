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
    ITALIAN: 'Włoska',
    FRENCH: 'Francuska',
    SPANISH: 'Hiszpańska',
    GREEK: 'Grecka',
    ASIAN: 'Azjatycka',
    CHINESE: 'Chińska',
    JAPANESE: 'Japońska',
    THAI: 'Tajska',
    INDIAN: 'Indyjska',
    VIETNAMESE: 'Wietnamska',
    KOREAN: 'Koreańska',
    MEXICAN: 'Meksykańska',
    MIDDLE_EASTERN: 'Bliskowschodnia',
    AMERICAN: 'Amerykańska',
    BRITISH: 'Brytyjska',
    GERMAN: 'Niemiecka',
    RUSSIAN: 'Rosyjska',
    MEDITERRANEAN: 'Śródziemnomorska',
    CARIBBEAN: 'Karaibska',
    AFRICAN: 'Afrykańska',
    SCANDINAVIAN: 'Skandynawska',
    BALKAN: 'Bałkańska',
    TURKISH: 'Turecka',
    BRAZILIAN: 'Brazylijska',
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
 * Posortowane alfabetycznie dla lepszej czytelności w autocomplete.
 */
export const RECIPE_CUISINE_OPTIONS: RecipeCuisine[] = [
    'AFRICAN',
    'AMERICAN',
    'ASIAN',
    'BALKAN',
    'BRAZILIAN',
    'BRITISH',
    'CARIBBEAN',
    'CHINESE',
    'FRENCH',
    'GERMAN',
    'GREEK',
    'INDIAN',
    'ITALIAN',
    'JAPANESE',
    'KOREAN',
    'MEDITERRANEAN',
    'MEXICAN',
    'MIDDLE_EASTERN',
    'POLISH',
    'RUSSIAN',
    'SCANDINAVIAN',
    'SPANISH',
    'THAI',
    'TURKISH',
    'VIETNAMESE',
];

/**
 * Opcje dostępne dla poziomu trudności w formularzu.
 */
export const RECIPE_DIFFICULTY_OPTIONS: RecipeDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];


