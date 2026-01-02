/**
 * Service layer for utils Edge Function.
 * Contains pure business logic for utility operations.
 */

import { SlugifyRequest } from './utils.types.ts';

/**
 * Transliteration map for Polish diacritics to ASCII equivalents.
 */
const PL_DIACRITICS_MAP: Record<string, string> = {
    'ą': 'a',
    'ć': 'c',
    'ę': 'e',
    'ł': 'l',
    'ń': 'n',
    'ó': 'o',
    'ś': 's',
    'ż': 'z',
    'ź': 'z',
};

/**
 * Generates a URL-safe slug from text input.
 * 
 * Algorithm:
 * 1. Convert to lowercase
 * 2. Transliterate Polish diacritics (ą->a, ć->c, etc.)
 * 3. Replace non-alphanumeric characters with hyphens
 * 4. Collapse multiple consecutive hyphens to single hyphen
 * 5. Trim hyphens from start and end
 * 6. Truncate to maxLength (re-trim hyphens after truncation)
 * 7. If empty, apply fallback (processed with same algorithm)
 * 
 * @param params - Slugify parameters
 * @returns URL-safe slug string
 */
export function generateSlug(params: SlugifyRequest): string {
    const { text, maxLength, fallback } = params;

    /**
     * Core slugify algorithm - pure function without recursion prevention.
     */
    const slugifyCore = (input: string, limit: number): string => {
        // Step 1: Convert to lowercase
        let result = input.toLowerCase();

        // Step 2: Transliterate Polish diacritics
        // Use Array.from() to properly handle Unicode characters
        result = Array.from(result)
            .map((char) => PL_DIACRITICS_MAP[char] || char)
            .join('');

        // Step 3: Replace non-alphanumeric with hyphens
        result = result.replace(/[^a-z0-9]+/g, '-');

        // Step 4: Collapse multiple hyphens
        result = result.replace(/-+/g, '-');

        // Step 5: Trim hyphens from start and end
        result = result.replace(/^-+|-+$/g, '');

        // Step 6: Truncate to maxLength
        if (result.length > limit) {
            result = result.substring(0, limit);
            // Re-trim hyphens after truncation
            result = result.replace(/-+$/g, '');
        }

        return result;
    };

    // Generate slug from input text
    let slug = slugifyCore(text, maxLength);

    // Step 7: Apply fallback if result is empty
    if (!slug) {
        slug = slugifyCore(fallback, maxLength);
        
        // If fallback also produces empty string, return hardcoded default
        if (!slug) {
            slug = 'przepis';
        }
    }

    return slug;
}

