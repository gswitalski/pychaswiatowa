import { Injectable } from '@angular/core';

/**
 * Opcje konfiguracji dla generowania slug'ów.
 */
export interface SlugifyOptions {
    /** Maksymalna długość slug'a (domyślnie 80). */
    maxLength?: number;
    /** Fallback gdy slug pusty (domyślnie 'przepis'). */
    fallback?: string;
}

/**
 * Serwis odpowiedzialny za generowanie URL-safe slug'ów z tekstu.
 * Implementuje reguły PRD dla normalizacji URL przepisów.
 *
 * Zasady slugify:
 * - lowercase
 * - transliteracja polskich znaków diakrytycznych
 * - znaki niealfanumeryczne → separator lub usunięcie
 * - wielokrotne separatory → pojedynczy '-'
 * - trim '-' z początku/końca
 * - limit długości (domyślnie 80)
 * - fallback gdy pusty (domyślnie 'przepis')
 */
@Injectable({
    providedIn: 'root',
})
export class SlugService {
    /**
     * Mapa polskich znaków diakrytycznych na ich ASCII odpowiedniki.
     */
    private readonly polishCharsMap: Record<string, string> = {
        ą: 'a',
        Ą: 'a',
        ć: 'c',
        Ć: 'c',
        ę: 'e',
        Ę: 'e',
        ł: 'l',
        Ł: 'l',
        ń: 'n',
        Ń: 'n',
        ó: 'o',
        Ó: 'o',
        ś: 's',
        Ś: 's',
        ż: 'z',
        Ż: 'z',
        ź: 'z',
        Ź: 'z',
    };

    /**
     * Generuje URL-safe slug z podanego tekstu.
     *
     * @param text Tekst do przekonwertowania na slug
     * @param options Opcjonalne parametry konfiguracji
     * @returns URL-safe slug
     *
     * @example
     * slugify('Biała kiełbasa z jabłkami') // 'biala-kielbasa-z-jablkami'
     * slugify('  Hello!!! World  ') // 'hello-world'
     * slugify('') // 'przepis' (fallback)
     * slugify('Very long recipe name...', { maxLength: 20 }) // 'very-long-recipe-nam'
     */
    slugify(text: string, options?: SlugifyOptions): string {
        const maxLength = options?.maxLength ?? 80;
        const fallback = options?.fallback ?? 'przepis';

        // Guard clauses
        if (!text || typeof text !== 'string') {
            return fallback;
        }

        let slug = text;

        // 1. Lowercase
        slug = slug.toLowerCase();

        // 2. Transliteracja polskich znaków
        slug = this.transliteratePolishChars(slug);

        // 3. Zamiana znaków niealfanumerycznych na separator
        // Zachowujemy litery (ASCII + już przetransformowane polskie), cyfry i myślnik
        slug = slug.replace(/[^a-z0-9-]/g, '-');

        // 4. Redukcja wielokrotnych separatorów do pojedynczego
        slug = slug.replace(/-+/g, '-');

        // 5. Trim separatorów z początku i końca
        slug = slug.replace(/^-+|-+$/g, '');

        // 6. Obcięcie do maksymalnej długości
        if (slug.length > maxLength) {
            slug = slug.substring(0, maxLength);
            // Ponownie trim separatora na końcu (jeśli obcięliśmy w środku słowa)
            slug = slug.replace(/-+$/g, '');
        }

        // 7. Fallback jeśli pusty
        if (slug.length === 0) {
            return fallback;
        }

        return slug;
    }

    /**
     * Transliteruje polskie znaki diakrytyczne na ich ASCII odpowiedniki.
     *
     * @param text Tekst do transliteracji
     * @returns Tekst z przetransformowanymi znakami polskimi
     */
    private transliteratePolishChars(text: string): string {
        return text
            .split('')
            .map((char) => this.polishCharsMap[char] ?? char)
            .join('');
    }
}

