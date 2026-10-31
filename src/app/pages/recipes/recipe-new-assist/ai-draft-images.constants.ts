import { CLIPBOARD_IMAGE_MAX_BYTES } from '../../../shared/services/clipboard-image.types';

/** Maksymalna liczba zdjęć w jednej analizie AI. */
export const AI_DRAFT_MAX_IMAGES = 5;

/** Maksymalny rozmiar pojedynczego zdjęcia po kompresji. */
export const AI_DRAFT_MAX_IMAGE_BYTES = CLIPBOARD_IMAGE_MAX_BYTES;

/** Maksymalny łączny rozmiar zdjęć w jednej analizie. */
export const AI_DRAFT_MAX_TOTAL_IMAGES_BYTES = 15 * 1024 * 1024;

/** Minimalna liczba zdjęć, dla której pokazujemy wskazówkę o analizie. */
export const AI_DRAFT_ANALYZING_HINT_MIN_IMAGES = 2;
