import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import {
    AiRecipeDraftMetadataSchema,
    getMetadataPromptSection,
    normalizeDraftMetadata,
} from './ai-draft-metadata.ts';
import {
    getImageExtractionPrompt,
    getSystemPrompt,
} from './ai.service.ts';

function createValidMetadata(): Record<string, unknown> {
    return {
        servings: 6,
        prep_time_minutes: 20,
        total_time_minutes: 75,
        diet_type: 'VEGETARIAN',
        cuisine: 'ITALIAN',
        difficulty: 'EASY',
        is_termorobot: true,
        is_grill: false,
    };
}

Deno.test('normalizeDraftMetadata: zachowuje komplet poprawnych wartości', () => {
    const result = normalizeDraftMetadata(createValidMetadata());

    assertEquals(result.metadata, createValidMetadata());
    assertEquals(result.warnings, []);
    assertEquals(AiRecipeDraftMetadataSchema.safeParse(result.metadata).success, true);
});

Deno.test('normalizeDraftMetadata: zachowuje obie flagi ustawione na true', () => {
    const result = normalizeDraftMetadata({
        ...createValidMetadata(),
        is_grill: true,
    });

    assertEquals(result.metadata.is_termorobot, true);
    assertEquals(result.metadata.is_grill, true);
    assertEquals(result.warnings, []);
});

Deno.test('normalizeDraftMetadata: akceptuje cuisine null bez ostrzeżenia', () => {
    const result = normalizeDraftMetadata({
        ...createValidMetadata(),
        cuisine: null,
    });

    assertEquals(result.metadata.cuisine, null);
    assertEquals(result.warnings, []);
});

Deno.test('normalizeDraftMetadata: normalizuje liczby, enumy i flagi zapisane jako tekst', () => {
    const result = normalizeDraftMetadata({
        servings: '4',
        prep_time_minutes: '19.6',
        total_time_minutes: 90,
        diet_type: ' vegan ',
        cuisine: 'italian',
        difficulty: 'hard',
        is_termorobot: 'TRUE',
        is_grill: ' false ',
    });

    assertEquals(result.metadata, {
        servings: 4,
        prep_time_minutes: 20,
        total_time_minutes: 90,
        diet_type: 'VEGAN',
        cuisine: 'ITALIAN',
        difficulty: 'HARD',
        is_termorobot: true,
        is_grill: false,
    });
    assertEquals(result.warnings, []);
});

Deno.test('normalizeDraftMetadata: koryguje czas całkowity krótszy od przygotowania', () => {
    const result = normalizeDraftMetadata({
        ...createValidMetadata(),
        prep_time_minutes: 60,
        total_time_minutes: 40,
    });

    assertEquals(result.metadata.prep_time_minutes, 60);
    assertEquals(result.metadata.total_time_minutes, 60);
    assertEquals(result.warnings, [
        'Skorygowano czas całkowity: był krótszy niż czas przygotowania.',
    ]);
});

Deno.test('normalizeDraftMetadata: odrzuca wartości poza zakresem i nieznany enum', () => {
    const result = normalizeDraftMetadata({
        ...createValidMetadata(),
        servings: 150,
        total_time_minutes: 4320,
        cuisine: 'UNKNOWN_CUISINE',
    });

    assertEquals(result.metadata.servings, null);
    assertEquals(result.metadata.total_time_minutes, null);
    assertEquals(result.metadata.cuisine, null);
    assertEquals(result.warnings, [
        'Odrzucono nieprawidłową wartość pola servings (poza zakresem 1–99).',
        'Odrzucono nieprawidłową wartość pola total_time_minutes (poza zakresem 0–999).',
        'Odrzucono nieprawidłową wartość pola cuisine (nieznana wartość).',
    ]);
});

Deno.test('normalizeDraftMetadata: zwraca bezpieczne wartości przy braku wszystkich pól', () => {
    const result = normalizeDraftMetadata({});

    assertEquals(result.metadata, {
        servings: null,
        prep_time_minutes: null,
        total_time_minutes: null,
        diet_type: null,
        cuisine: null,
        difficulty: null,
        is_termorobot: false,
        is_grill: false,
    });
    assertEquals(result.warnings, [
        'Niekompletne metadane przepisu — brak pól: servings, prep_time_minutes, total_time_minutes, diet_type, cuisine, difficulty, is_termorobot, is_grill.',
    ]);
});

Deno.test('normalizeDraftMetadata: traktuje null jako brak poza dozwolonym cuisine', () => {
    const result = normalizeDraftMetadata({
        ...createValidMetadata(),
        servings: null,
        diet_type: null,
        is_grill: null,
    });

    assertEquals(result.metadata.servings, null);
    assertEquals(result.metadata.diet_type, null);
    assertEquals(result.metadata.is_grill, false);
    assertEquals(result.warnings, [
        'Niekompletne metadane przepisu — brak pól: servings, diet_type, is_grill.',
    ]);
});

Deno.test('normalizeDraftMetadata: nie koryguje relacji, gdy jeden z czasów jest odrzucony', () => {
    const result = normalizeDraftMetadata({
        ...createValidMetadata(),
        prep_time_minutes: 60,
        total_time_minutes: 1000,
    });

    assertEquals(result.metadata.prep_time_minutes, 60);
    assertEquals(result.metadata.total_time_minutes, null);
    assertEquals(result.warnings, [
        'Odrzucono nieprawidłową wartość pola total_time_minutes (poza zakresem 0–999).',
    ]);
});

Deno.test('normalizeDraftMetadata: obsługuje wartości brzegowe i niepoprawne typy', () => {
    const cases: Array<{
        field: string;
        value: unknown;
        expected: unknown;
    }> = [
        { field: 'servings', value: 1, expected: 1 },
        { field: 'servings', value: 99, expected: 99 },
        { field: 'servings', value: 100, expected: null },
        { field: 'servings', value: '4–6', expected: null },
        { field: 'prep_time_minutes', value: 0, expected: 0 },
        { field: 'prep_time_minutes', value: -1, expected: null },
        { field: 'total_time_minutes', value: 999, expected: 999 },
        { field: 'total_time_minutes', value: 1000, expected: null },
        { field: 'total_time_minutes', value: Number.NaN, expected: null },
        { field: 'total_time_minutes', value: Number.POSITIVE_INFINITY, expected: null },
        { field: 'is_termorobot', value: 1, expected: false },
        { field: 'is_grill', value: 'tak', expected: false },
    ];

    for (const testCase of cases) {
        const result = normalizeDraftMetadata({
            ...createValidMetadata(),
            [testCase.field]: testCase.value,
        });

        assertEquals(
            result.metadata[testCase.field as keyof typeof result.metadata],
            testCase.expected,
        );
    }
});

Deno.test('normalizeDraftMetadata: nie mutuje obiektu wejściowego', () => {
    const input = {
        ...createValidMetadata(),
        cuisine: 'italian',
    };
    const snapshot = structuredClone(input);

    normalizeDraftMetadata(input);

    assertEquals(input, snapshot);
});

Deno.test('prompty zawierają pełny kontrakt metadanych i priorytet źródła', () => {
    const metadataPrompt = getMetadataPromptSection();
    const systemPrompt = getSystemPrompt('pl');
    const imagePrompt = getImageExtractionPrompt();

    for (const field of [
        'servings',
        'prep_time_minutes',
        'total_time_minutes',
        'diet_type',
        'cuisine',
        'difficulty',
        'is_termorobot',
        'is_grill',
    ]) {
        assertEquals(systemPrompt.includes(field), true);
    }

    assertEquals(metadataPrompt.includes('MA ZAWSZE pierwszeństwo'), true);
    assertEquals(metadataPrompt.includes('VEGETARIAN'), true);
    assertEquals(metadataPrompt.includes('HARD'), true);
    assertEquals(metadataPrompt.includes('VIETNAMESE'), true);
    assertEquals(metadataPrompt.includes('Termorobot'), true);
    assertEquals(metadataPrompt.includes('is_grill'), true);
    assertEquals(metadataPrompt.includes('minutach'), true);
    assertEquals(metadataPrompt.includes('większy lub równy prep_time_minutes'), true);
    assertEquals(imagePrompt.includes('metadane (porcje, czas, trudność)'), true);
});
