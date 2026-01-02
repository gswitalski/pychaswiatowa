/**
 * Internal types for utils Edge Function.
 */

/**
 * Internal request model for slugify operation.
 * All fields are required after validation with defaults applied.
 */
export interface SlugifyRequest {
    text: string;
    maxLength: number;
    fallback: string;
}

