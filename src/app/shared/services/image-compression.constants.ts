/** Limit obrazu referencyjnego w POST /ai/recipes/image (backend). */
export const REFERENCE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** Maks. dłuższy bok przed kompresją (zdjęcia z aparatu). */
export const IMAGE_COMPRESS_MAX_DIMENSION_PX = 2048;

/** Dolna granica jakości JPEG/WebP przy iteracyjnej kompresji. */
export const IMAGE_COMPRESS_MIN_QUALITY = 0.35;

/** Minimalny dłuższy bok — poniżej kończymy próby. */
export const IMAGE_COMPRESS_MIN_DIMENSION_PX = 640;
