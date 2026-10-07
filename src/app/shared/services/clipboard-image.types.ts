/** Dozwolone typy MIME — spójne z API uploadu zdjęcia */
export const CLIPBOARD_IMAGE_ACCEPTED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

export type ClipboardAcceptedMimeType = (typeof CLIPBOARD_IMAGE_ACCEPTED_MIME_TYPES)[number];

export const CLIPBOARD_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type ClipboardImageErrorCode =
    | 'NO_IMAGE'
    | 'UNSUPPORTED_FORMAT'
    | 'FILE_TOO_LARGE'
    | 'PERMISSION_DENIED'
    | 'READ_FAILED';

export class ClipboardImageError extends Error {
    constructor(
        readonly code: ClipboardImageErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'ClipboardImageError';
    }
}
