import type { ClipboardImageErrorCode } from './clipboard-image.types';

/** Komunikaty inline (przycisk schowka, Ctrl+V, walidacja pliku) — PS-92 */
export const CLIPBOARD_IMAGE_UI_MESSAGES = {
    noImage: 'Schowek nie zawiera obrazu. Skopiuj grafikę i spróbuj ponownie.',
    unsupportedFormat: 'Nieobsługiwany format pliku. Dozwolone formaty: PNG, JPG, WebP.',
    fileTooLarge: 'Plik jest zbyt duży. Maksymalny rozmiar to 10 MB.',
    permissionDenied:
        'Brak dostępu do schowka. Zezwól na dostęp w ustawieniach przeglądarki lub użyj Ctrl+V.',
    readFailed: 'Nie udało się odczytać schowka.',
    clipboardUnsupportedTooltip:
        'Niedostępne w tej przeglądarce — użyj Ctrl+V, przeciągnij plik lub wybierz z dysku.',
} as const;

const ERROR_CODE_TO_MESSAGE: Record<ClipboardImageErrorCode, string> = {
    NO_IMAGE: CLIPBOARD_IMAGE_UI_MESSAGES.noImage,
    UNSUPPORTED_FORMAT: CLIPBOARD_IMAGE_UI_MESSAGES.unsupportedFormat,
    FILE_TOO_LARGE: CLIPBOARD_IMAGE_UI_MESSAGES.fileTooLarge,
    PERMISSION_DENIED: CLIPBOARD_IMAGE_UI_MESSAGES.permissionDenied,
    READ_FAILED: CLIPBOARD_IMAGE_UI_MESSAGES.readFailed,
};

export function messageForClipboardImageErrorCode(code: ClipboardImageErrorCode): string {
    return ERROR_CODE_TO_MESSAGE[code];
}
