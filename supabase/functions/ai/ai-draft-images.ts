import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';

/** Maximum number of images accepted for one recipe draft. */
export const MAX_DRAFT_IMAGES = 5;
/** Maximum decoded size of one image (10 MB). */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
/** Maximum combined decoded size of all draft images (15 MB). */
export const MAX_TOTAL_DRAFT_IMAGES_SIZE_BYTES = 15 * 1024 * 1024;
/** Best-effort body size protection before JSON parsing (22 MB). */
export const MAX_DRAFT_REQUEST_BODY_BYTES = 22 * 1024 * 1024;
export const DRAFT_IMAGE_DETAIL = 'high' as const;
export const DRAFT_API_TIMEOUT_PER_EXTRA_IMAGE_MS = 10_000;
export const DRAFT_API_TIMEOUT_MAX_MS = 140_000;

export interface DraftImageInput {
    mime_type: string;
    data_base64: string;
}

export interface DecodedDraftImage {
    bytes: Uint8Array;
    mimeType: string;
}

export type ResolvedDraftImages = {
    images: DraftImageInput[];
    usedLegacyImageField: boolean;
};

export type DecodeDraftImagesResult =
    | { ok: true; images: DecodedDraftImage[]; totalBytes: number }
    | { ok: false; reason: 'INVALID_BASE64'; index: number }
    | { ok: false; reason: 'PAYLOAD_TOO_LARGE'; limit: 'per_file' | 'total'; index?: number };

export function resolveDraftImages(
    request: { image?: DraftImageInput; images?: DraftImageInput[] },
): ResolvedDraftImages {
    if (request.images !== undefined) {
        return { images: request.images, usedLegacyImageField: false };
    }
    if (request.image !== undefined) {
        return { images: [request.image], usedLegacyImageField: true };
    }
    throw new ApplicationError('INTERNAL_ERROR', 'Image request passed schema validation without an image');
}

/** Decodes standard or URL-safe base64 without throwing for malformed input. */
export function tryDecodeBase64(value: string): Uint8Array | null {
    try {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    } catch {
        return null;
    }
}

export function validateDraftImageSizes(
    sizes: number[],
): { ok: true } | { ok: false; limit: 'per_file' | 'total'; index?: number } {
    for (let index = 0; index < sizes.length; index++) {
        if (sizes[index] > MAX_IMAGE_SIZE_BYTES) {
            return { ok: false, limit: 'per_file', index };
        }
    }
    if (sizes.reduce((total, size) => total + size, 0) > MAX_TOTAL_DRAFT_IMAGES_SIZE_BYTES) {
        return { ok: false, limit: 'total' };
    }
    return { ok: true };
}

export function decodeDraftImages(images: DraftImageInput[]): DecodeDraftImagesResult {
    const decoded: DecodedDraftImage[] = [];
    for (let index = 0; index < images.length; index++) {
        const bytes = tryDecodeBase64(images[index].data_base64);
        if (bytes === null) {
            return { ok: false, reason: 'INVALID_BASE64', index };
        }
        decoded.push({ bytes, mimeType: images[index].mime_type });
    }

    const sizeResult = validateDraftImageSizes(decoded.map((image) => image.bytes.length));
    if (!sizeResult.ok) {
        return {
            ok: false,
            reason: 'PAYLOAD_TOO_LARGE',
            limit: sizeResult.limit,
            ...(sizeResult.index !== undefined ? { index: sizeResult.index } : {}),
        };
    }
    return {
        ok: true,
        images: decoded,
        totalBytes: decoded.reduce((total, image) => total + image.bytes.length, 0),
    };
}

export function getDraftApiTimeoutMs(imageCount: number, baseTimeoutMs = 100_000): number {
    return Math.min(
        baseTimeoutMs + Math.max(0, imageCount - 1) * DRAFT_API_TIMEOUT_PER_EXTRA_IMAGE_MS,
        DRAFT_API_TIMEOUT_MAX_MS,
    );
}

export function getMultiImageUserPromptParts(count: number): { intro: string; outro: string } {
    return {
        intro: `Załączono ${count} zdjęć. Są to KOLEJNE fragmenty JEDNEGO przepisu kulinarnego (np. kolejne strony książki kucharskiej), podane w kolejności stron. Każde zdjęcie jest poprzedzone podpisem "Zdjęcie k z ${count}".

Połącz informacje ze wszystkich zdjęć w jeden spójny przepis:
- składniki, kroki i wskazówki z różnych zdjęć scalaj w kolejności zdjęć, bez duplikowania powtórzonych fragmentów,
- jeśli ta sama informacja (np. nazwa, porcje, czas) występuje na kilku zdjęciach, użyj wartości jawnie podanej w źródle,
- zdjęcie nieczytelne lub niezawierające treści przepisu pomiń, a jego numer (od 1, zgodnie z podpisem) dodaj do pola "unreadable_images",
- jeśli żadne zdjęcie nie zawiera przepisu, zwróć is_valid_recipe=false.

Obowiązują wszystkie pozostałe zasady i format JSON z instrukcji systemowej.`,
        outro: 'Zwróć odpowiedź w formacie JSON zgodnie z instrukcjami.',
    };
}

export function normalizeUnreadableImages(
    raw: unknown,
    imageCount: number,
): { indices: number[]; warnings: string[] } {
    if (imageCount <= 1 || !Array.isArray(raw)) {
        return { indices: [], warnings: [] };
    }
    const indices = [...new Set(raw.filter((value): value is number =>
        Number.isInteger(value) && value >= 1 && value <= imageCount,
    ))].sort((left, right) => left - right);
    const invalidCount = raw.length - indices.length;
    if (invalidCount > 0) {
        logger.warn('Ignored invalid unreadable image indices', { imageCount, invalidCount });
    }
    return {
        indices,
        warnings: indices.map((index) => `Zdjęcie ${index} było nieczytelne i zostało pominięte.`),
    };
}
