/**
 * Cursor Utilities
 * Utilities for encoding, decoding, and validating cursor-based pagination tokens.
 *
 * Cursor format (base64url encoded JSON):
 * {
 *   v: 1,                    // Version number
 *   offset: number,          // Number of records already consumed
 *   limit: number,           // Limit used to generate this cursor
 *   sort: string,            // Sort specification (e.g., "created_at.desc")
 *   filtersHash: string      // Hash of filters to detect cursor reuse with different params
 * }
 */

import { ApplicationError } from './errors.ts';

/**
 * Current cursor format version.
 * Increment this when making breaking changes to cursor structure.
 */
const CURSOR_VERSION = 1;

/**
 * Represents the decoded cursor object.
 */
export interface CursorData {
    /** Cursor format version */
    v: number;
    /** Number of records already consumed (offset) */
    offset: number;
    /** Limit used when this cursor was generated */
    limit: number;
    /** Sort specification (e.g., "created_at.desc") */
    sort: string;
    /** Hash of filter parameters to ensure cursor matches current query */
    filtersHash: string;
}

/**
 * Parameters for building a filters hash.
 * Include all query parameters that affect result ordering/filtering.
 */
export interface FilterSignature {
    sort?: string;
    view?: string;
    q?: string;
    search?: string;
    categoryId?: number;
    tags?: string[];
    termorobot?: boolean;
    [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Encodes cursor data to an opaque base64url string.
 *
 * @param data - The cursor data to encode
 * @returns Base64url-encoded cursor string
 */
export function encodeCursor(data: CursorData): string {
    try {
        const json = JSON.stringify(data);
        const encoded = btoa(json);
        // Convert to base64url (URL-safe)
        return encoded
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    } catch (error) {
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to encode cursor'
        );
    }
}

/**
 * Decodes and validates a cursor string.
 *
 * @param cursorString - The base64url-encoded cursor string
 * @returns Decoded and validated cursor data
 * @throws ApplicationError with VALIDATION_ERROR if cursor is invalid
 */
export function decodeCursor(cursorString: string): CursorData {
    try {
        // Convert from base64url to standard base64
        let base64 = cursorString
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        // Add padding if needed
        while (base64.length % 4) {
            base64 += '=';
        }

        const json = atob(base64);
        const data = JSON.parse(json);

        // Validate cursor structure
        if (typeof data !== 'object' || data === null) {
            throw new Error('Cursor must be an object');
        }

        if (typeof data.v !== 'number') {
            throw new Error('Cursor version (v) must be a number');
        }

        if (data.v !== CURSOR_VERSION) {
            throw new Error(`Unsupported cursor version: ${data.v}. Expected: ${CURSOR_VERSION}`);
        }

        if (typeof data.offset !== 'number' || data.offset < 0 || !Number.isInteger(data.offset)) {
            throw new Error('Cursor offset must be a non-negative integer');
        }

        if (typeof data.limit !== 'number' || data.limit < 1 || !Number.isInteger(data.limit)) {
            throw new Error('Cursor limit must be a positive integer');
        }

        if (typeof data.sort !== 'string' || data.sort.length === 0) {
            throw new Error('Cursor sort must be a non-empty string');
        }

        if (typeof data.filtersHash !== 'string' || data.filtersHash.length === 0) {
            throw new Error('Cursor filtersHash must be a non-empty string');
        }

        return data as CursorData;
    } catch (error) {
        if (error instanceof ApplicationError) {
            throw error;
        }

        const message = error instanceof Error ? error.message : 'Invalid cursor format';
        throw new ApplicationError('VALIDATION_ERROR', `Invalid cursor: ${message}`);
    }
}

/**
 * Builds a deterministic hash of filter parameters.
 * Used to ensure cursor is only valid for the same set of filters.
 *
 * @param signature - Filter parameters that affect query results
 * @returns SHA-256 hash of the signature (hex string)
 */
export async function buildFiltersHash(signature: FilterSignature): Promise<string> {
    try {
        // Create a deterministic string from signature
        // Sort keys to ensure consistent ordering
        const keys = Object.keys(signature).sort();
        const normalized: Record<string, unknown> = {};

        for (const key of keys) {
            const value = signature[key];
            // Skip undefined values
            if (value !== undefined) {
                // Normalize arrays by sorting them
                if (Array.isArray(value)) {
                    normalized[key] = [...value].sort();
                } else {
                    normalized[key] = value;
                }
            }
        }

        const signatureString = JSON.stringify(normalized);

        // Generate SHA-256 hash
        const encoder = new TextEncoder();
        const data = encoder.encode(signatureString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);

        // Convert to hex string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        return hashHex;
    } catch (error) {
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to build filters hash'
        );
    }
}

/**
 * Creates a new cursor for the next page of results.
 *
 * @param currentOffset - Current offset
 * @param itemsReturned - Number of items in the current batch
 * @param limit - Limit per page
 * @param sort - Sort specification
 * @param filtersHash - Hash of current filters
 * @returns Encoded cursor string for the next page
 */
export function createNextCursor(
    currentOffset: number,
    itemsReturned: number,
    limit: number,
    sort: string,
    filtersHash: string
): string {
    const nextOffset = currentOffset + itemsReturned;

    const cursorData: CursorData = {
        v: CURSOR_VERSION,
        offset: nextOffset,
        limit,
        sort,
        filtersHash,
    };

    return encodeCursor(cursorData);
}

/**
 * Validates that a decoded cursor matches the current query parameters.
 *
 * @param cursor - Decoded cursor data
 * @param currentLimit - Current limit parameter
 * @param currentSort - Current sort parameter
 * @param currentFiltersHash - Hash of current filter parameters
 * @throws ApplicationError with VALIDATION_ERROR if cursor doesn't match current params
 */
export function validateCursorConsistency(
    cursor: CursorData,
    currentLimit: number,
    currentSort: string,
    currentFiltersHash: string
): void {
    // Check if limit changed
    if (cursor.limit !== currentLimit) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Cursor is invalid: limit parameter has changed'
        );
    }

    // Check if sort changed
    if (cursor.sort !== currentSort) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Cursor is invalid: sort parameter has changed'
        );
    }

    // Check if filters changed
    if (cursor.filtersHash !== currentFiltersHash) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Cursor is invalid: filter parameters have changed'
        );
    }
}

