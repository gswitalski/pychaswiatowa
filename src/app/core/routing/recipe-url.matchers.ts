import { UrlSegment, UrlMatchResult } from '@angular/router';

/**
 * UrlMatcher dla kanonicznych URL-i przepisów explore w formacie explore/recipes/:id-:slug
 *
 * Dopasowuje pełne ścieżki:
 * - "explore/recipes/123-biala-kielbasa-z-jablkami"
 * - "explore/recipes/42-przepis"
 *
 * Wyodrębnia:
 * - id: numeryczna część przed pierwszym myślnikiem
 * - slug: część po pierwszym myślniku
 *
 * @param segments Segmenty URL do dopasowania
 * @param group Grupa segmentów URL
 * @param route Konfiguracja trasy
 * @returns Wynik dopasowania lub null jeśli nie pasuje
 */
export function exploreRecipeIdSlugMatcher(
    segments: UrlSegment[],
): UrlMatchResult | null {
    // Oczekujemy dokładnie 3 segmentów: "explore", "recipes", ":id-:slug"
    if (segments.length < 3) {
        return null;
    }

    // Sprawdź czy pierwsze dwa segmenty to "explore" i "recipes"
    if (segments[0].path !== 'explore' || segments[1].path !== 'recipes') {
        return null;
    }

    const recipeSegment = segments[2].path;

    // Regex: cyfry na początku, myślnik, dowolne znaki po myślniku
    // Pattern: ^\d+-.*$
    const idSlugPattern = /^(\d+)-(.+)$/;
    const match = recipeSegment.match(idSlugPattern);

    if (!match) {
        return null;
    }

    const [, id, slug] = match;

    // Guard: id musi być liczbą dodatnią
    const idNum = parseInt(id, 10);
    if (isNaN(idNum) || idNum <= 0) {
        return null;
    }

    return {
        consumed: [segments[0], segments[1], segments[2]],
        posParams: {
            id: new UrlSegment(id, {}),
            slug: new UrlSegment(slug, {}),
        },
    };
}

/**
 * UrlMatcher dla legacy URL-i przepisów explore w formacie explore/recipes/:id
 *
 * Dopasowuje pełne ścieżki:
 * - "explore/recipes/123"
 * - "explore/recipes/42"
 *
 * Wyodrębnia:
 * - id: numeryczna wartość segmentu
 *
 * @param segments Segmenty URL do dopasowania
 * @param group Grupa segmentów URL
 * @param route Konfiguracja trasy
 * @returns Wynik dopasowania lub null jeśli nie pasuje
 */
export function exploreRecipeIdOnlyMatcher(
    segments: UrlSegment[],
): UrlMatchResult | null {
    // Oczekujemy dokładnie 3 segmentów: "explore", "recipes", ":id"
    if (segments.length < 3) {
        return null;
    }

    // Sprawdź czy pierwsze dwa segmenty to "explore" i "recipes"
    if (segments[0].path !== 'explore' || segments[1].path !== 'recipes') {
        return null;
    }

    const recipeSegment = segments[2].path;

    // Regex: tylko cyfry, bez myślnika
    // Pattern: ^\d+$
    const idOnlyPattern = /^\d+$/;

    if (!idOnlyPattern.test(recipeSegment)) {
        return null;
    }

    const id = recipeSegment;
    const idNum = parseInt(id, 10);

    // Guard: id musi być liczbą dodatnią
    if (isNaN(idNum) || idNum <= 0) {
        return null;
    }

    return {
        consumed: [segments[0], segments[1], segments[2]],
        posParams: {
            id: new UrlSegment(id, {}),
        },
    };
}

/**
 * UrlMatcher dla kanonicznych URL-i przepisów w formacie :id-:slug
 * (dla użycia w child routes)
 *
 * Dopasowuje segmenty takie jak:
 * - "123-biala-kielbasa-z-jablkami"
 * - "42-przepis"
 *
 * Wyodrębnia:
 * - id: numeryczna część przed pierwszym myślnikiem
 * - slug: część po pierwszym myślniku
 *
 * @param segments Segmenty URL do dopasowania
 * @param group Grupa segmentów URL
 * @param route Konfiguracja trasy
 * @returns Wynik dopasowania lub null jeśli nie pasuje
 */
export function recipeIdSlugMatcher(
    segments: UrlSegment[],
): UrlMatchResult | null {
    // Oczekujemy dokładnie jednego segmentu
    if (segments.length === 0) {
        return null;
    }

    const segment = segments[0].path;

    // Regex: cyfry na początku, myślnik, dowolne znaki po myślniku
    // Pattern: ^\d+-.*$
    const idSlugPattern = /^(\d+)-(.+)$/;
    const match = segment.match(idSlugPattern);

    if (!match) {
        return null;
    }

    const [, id, slug] = match;

    // Guard: id musi być liczbą dodatnią
    const idNum = parseInt(id, 10);
    if (isNaN(idNum) || idNum <= 0) {
        return null;
    }

    return {
        consumed: [segments[0]],
        posParams: {
            id: new UrlSegment(id, {}),
            slug: new UrlSegment(slug, {}),
        },
    };
}

/**
 * UrlMatcher dla legacy URL-i przepisów w formacie :id (tylko liczba)
 *
 * Dopasowuje segmenty takie jak:
 * - "123"
 * - "42"
 *
 * NIE dopasowuje:
 * - "123-slug" (obsługiwane przez recipeIdSlugMatcher)
 * - "abc" (nie jest liczbą)
 *
 * Wyodrębnia:
 * - id: numeryczna wartość segmentu
 *
 * @param segments Segmenty URL do dopasowania
 * @param group Grupa segmentów URL
 * @param route Konfiguracja trasy
 * @returns Wynik dopasowania lub null jeśli nie pasuje
 */
export function recipeIdOnlyMatcher(
    segments: UrlSegment[],
): UrlMatchResult | null {
    // Oczekujemy dokładnie jednego segmentu
    if (segments.length === 0) {
        return null;
    }

    const segment = segments[0].path;

    // Regex: tylko cyfry, bez myślnika
    // Pattern: ^\d+$
    const idOnlyPattern = /^\d+$/;

    if (!idOnlyPattern.test(segment)) {
        return null;
    }

    const id = segment;
    const idNum = parseInt(id, 10);

    // Guard: id musi być liczbą dodatnią
    if (isNaN(idNum) || idNum <= 0) {
        return null;
    }

    return {
        consumed: [segments[0]],
        posParams: {
            id: new UrlSegment(id, {}),
        },
    };
}

