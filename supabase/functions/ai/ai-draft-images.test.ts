import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import {
    MAX_IMAGE_SIZE_BYTES,
    decodeDraftImages,
    getDraftApiTimeoutMs,
    getMultiImageUserPromptParts,
    normalizeUnreadableImages,
    resolveDraftImages,
    validateDraftImageSizes,
} from './ai-draft-images.ts';

Deno.test('resolveDraftImages: rozpoznaje nowe i przestarzałe pole', () => {
    const image = { mime_type: 'image/png', data_base64: 'YQ==' };
    assertEquals(resolveDraftImages({ images: [image] }), {
        images: [image],
        usedLegacyImageField: false,
    });
    assertEquals(resolveDraftImages({ image }), {
        images: [image],
        usedLegacyImageField: true,
    });
});

Deno.test('validateDraftImageSizes: sprawdza limit pliku przed sumą', () => {
    assertEquals(validateDraftImageSizes([MAX_IMAGE_SIZE_BYTES + 1]), {
        ok: false,
        limit: 'per_file',
        index: 0,
    });
    assertEquals(validateDraftImageSizes([8 * 1024 * 1024, 8 * 1024 * 1024]), {
        ok: false,
        limit: 'total',
    });
    assertEquals(validateDraftImageSizes([5 * 1024 * 1024, 5 * 1024 * 1024, 5 * 1024 * 1024]), {
        ok: true,
    });
});

Deno.test('decodeDraftImages: zachowuje kolejność i zwraca indeks błędnego base64', () => {
    assertEquals(decodeDraftImages([
        { mime_type: 'image/png', data_base64: 'YQ==' },
        { mime_type: 'image/jpeg', data_base64: 'Yg==' },
    ]), {
        ok: true,
        images: [
            { bytes: new Uint8Array([97]), mimeType: 'image/png' },
            { bytes: new Uint8Array([98]), mimeType: 'image/jpeg' },
        ],
        totalBytes: 2,
    });
    assertEquals(decodeDraftImages([
        { mime_type: 'image/png', data_base64: 'YQ==' },
        { mime_type: 'image/jpeg', data_base64: 'not base64!' },
    ]), { ok: false, reason: 'INVALID_BASE64', index: 1 });
});

Deno.test('normalizacja ostrzeżeń zdjęć ignoruje niepoprawne indeksy', () => {
    assertEquals(normalizeUnreadableImages([0, 4, 2.5, 'x', 2, 2], 3), {
        indices: [2],
        warnings: ['Zdjęcie 2 było nieczytelne i zostało pominięte.'],
    });
    assertEquals(normalizeUnreadableImages([1], 1), { indices: [], warnings: [] });
});

Deno.test('timeout i prompt wielu zdjęć używają wymaganych limitów', () => {
    assertEquals(getDraftApiTimeoutMs(1), 100_000);
    assertEquals(getDraftApiTimeoutMs(3), 120_000);
    assertEquals(getDraftApiTimeoutMs(5), 140_000);
    assertEquals(getDraftApiTimeoutMs(10), 140_000);
    const prompt = getMultiImageUserPromptParts(3);
    assertEquals(prompt.intro.includes('3 zdjęć'), true);
    assertEquals(prompt.intro.includes('kolejności'), true);
    assertEquals(prompt.intro.includes('nieczytelne'), true);
});
