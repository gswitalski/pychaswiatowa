import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { generateRecipeDraft, getSystemPrompt } from './ai.service.ts';

function createDraft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        name: '  Lasagne ze szpinakiem  ',
        description: '  Warstwowe danie.  ',
        ingredients_raw: '  250 g makaronu\n500 g szpinaku  ',
        steps_raw: '  Ugotować makaron\nUpiec lasagne  ',
        tips_raw: '  Podawać na ciepło.  ',
        category_name: '  Obiad  ',
        tags: ['Włoskie', ' włoskie ', 'Obiad'],
        servings: 6,
        prep_time_minutes: 20,
        total_time_minutes: 75,
        diet_type: 'VEGETARIAN',
        cuisine: 'ITALIAN',
        difficulty: 'EASY',
        is_termorobot: true,
        is_grill: false,
        ...overrides,
    };
}

async function withMockedOpenAI<T>(
    llmPayload: Record<string, unknown>,
    run: () => Promise<T>,
): Promise<T> {
    const originalFetch = globalThis.fetch;
    const originalApiKey = Deno.env.get('OPENAI_API_KEY');

    Deno.env.set('OPENAI_API_KEY', 'test');
    globalThis.fetch = (() =>
        Promise.resolve(
            new Response(
                JSON.stringify({
                    choices: [{
                        message: {
                            content: JSON.stringify(llmPayload),
                        },
                    }],
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                },
            ),
        )) as typeof fetch;

    try {
        return await run();
    } finally {
        globalThis.fetch = originalFetch;
        if (originalApiKey === undefined) {
            Deno.env.delete('OPENAI_API_KEY');
        } else {
            Deno.env.set('OPENAI_API_KEY', originalApiKey);
        }
    }
}

function generateTextDraft() {
    return generateRecipeDraft({
        userId: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
        source: 'text',
        text: 'Lasagne ze szpinakiem',
        language: 'pl',
    });
}

Deno.test({
    name: 'getSystemPrompt: zawiera wymagane instrukcje stylu opisu (PS-34)',
    fn: () => {
        const prompt = getSystemPrompt('pl');

        assertEquals(
            prompt.includes('3–5 zdań'),
            true,
            'Prompt powinien wymagać 3–5 zdań',
        );
        assertEquals(
            prompt.includes('familiarny') || prompt.includes('potoczny'),
            true,
            'Prompt powinien wymagać tonu familiarnego/potocznego',
        );
        assertEquals(
            prompt.includes('humorystyczny') || prompt.includes('uszczypliwość'),
            true,
            'Prompt powinien wymagać elementu humorystycznego',
        );
        assertEquals(
            prompt.includes('ciekawostką') || prompt.includes('historyczną'),
            true,
            'Prompt powinien wymagać ciekawostki historycznej/geograficznej',
        );
        assertEquals(
            prompt.includes('wulgarnych') || prompt.includes('obraźliwych'),
            true,
            'Prompt powinien zabraniać treści nieodpowiednich',
        );
        assertEquals(
            prompt.includes('carbonara') || prompt.includes('PRZYKŁAD'),
            true,
            'Prompt powinien zawierać przykład few-shot',
        );
    },
});

Deno.test({
    name: 'generateRecipeDraft: zwraca komplet znormalizowanych metadanych',
    permissions: { env: true },
    fn: async () => {
        const result = await withMockedOpenAI(
            {
                is_valid_recipe: true,
                draft: createDraft(),
                meta: {
                    confidence: 0.92,
                    warnings: [],
                },
            },
            generateTextDraft,
        );

        assertEquals(result.success, true);
        if (!result.success) {
            return;
        }

        assertEquals(result.data.draft.name, 'Lasagne ze szpinakiem');
        assertEquals(result.data.draft.tags, ['Włoskie', 'Obiad']);
        assertEquals(result.data.draft.tips_raw, 'Podawać na ciepło.');
        assertEquals(result.data.draft.servings, 6);
        assertEquals(result.data.draft.prep_time_minutes, 20);
        assertEquals(result.data.draft.total_time_minutes, 75);
        assertEquals(result.data.draft.diet_type, 'VEGETARIAN');
        assertEquals(result.data.draft.cuisine, 'ITALIAN');
        assertEquals(result.data.draft.difficulty, 'EASY');
        assertEquals(result.data.draft.is_termorobot, true);
        assertEquals(result.data.draft.is_grill, false);
        assertEquals(result.data.meta, {
            confidence: 0.92,
            warnings: [],
        });
    },
});

Deno.test({
    name: 'generateRecipeDraft: koryguje błędne metadane i deduplikuje ostrzeżenia',
    permissions: { env: true },
    fn: async () => {
        const duplicateWarning =
            'Odrzucono nieprawidłową wartość pola servings (poza zakresem 1–99).';
        const result = await withMockedOpenAI(
            {
                is_valid_recipe: true,
                draft: createDraft({
                    servings: 150,
                    prep_time_minutes: 60,
                    total_time_minutes: 40,
                    cuisine: 'UNKNOWN',
                }),
                meta: {
                    confidence: 0.73,
                    warnings: ['Ostrzeżenie modelu.', duplicateWarning],
                },
            },
            generateTextDraft,
        );

        assertEquals(result.success, true);
        if (!result.success) {
            return;
        }

        assertEquals(result.data.draft.servings, null);
        assertEquals(result.data.draft.total_time_minutes, 60);
        assertEquals(result.data.draft.cuisine, null);
        assertEquals(result.data.meta.confidence, 0.73);
        assertEquals(result.data.meta.warnings, [
            'Ostrzeżenie modelu.',
            duplicateWarning,
            'Skorygowano czas całkowity: był krótszy niż czas przygotowania.',
            'Odrzucono nieprawidłową wartość pola cuisine (nieznana wartość).',
        ]);
    },
});

Deno.test({
    name: 'generateRecipeDraft: brak metadanych nie odrzuca poprawnej treści',
    permissions: { env: true },
    fn: async () => {
        const draftWithoutMetadata = createDraft();
        for (const key of [
            'servings',
            'prep_time_minutes',
            'total_time_minutes',
            'diet_type',
            'cuisine',
            'difficulty',
            'is_termorobot',
            'is_grill',
        ]) {
            delete draftWithoutMetadata[key];
        }

        const result = await withMockedOpenAI(
            {
                is_valid_recipe: true,
                draft: draftWithoutMetadata,
                meta: {
                    confidence: 0.61,
                    warnings: [],
                },
            },
            generateTextDraft,
        );

        assertEquals(result.success, true);
        if (!result.success) {
            return;
        }

        assertEquals(result.data.draft.servings, null);
        assertEquals(result.data.draft.prep_time_minutes, null);
        assertEquals(result.data.draft.total_time_minutes, null);
        assertEquals(result.data.draft.diet_type, null);
        assertEquals(result.data.draft.cuisine, null);
        assertEquals(result.data.draft.difficulty, null);
        assertEquals(result.data.draft.is_termorobot, false);
        assertEquals(result.data.draft.is_grill, false);
        assertEquals(result.data.meta.confidence, 0.61);
        assertEquals(result.data.meta.warnings.length, 1);
        assertEquals(
            result.data.meta.warnings[0].startsWith(
                'Niekompletne metadane przepisu — brak pól:',
            ),
            true,
        );
    },
});

Deno.test({
    name: 'generateRecipeDraft: nie dodaje metadanych dla treści niebędącej przepisem',
    permissions: { env: true },
    fn: async () => {
        const result = await withMockedOpenAI(
            {
                is_valid_recipe: false,
                reasons: ['Brak składników', 'Brak kroków'],
            },
            generateTextDraft,
        );

        assertEquals(result, {
            success: false,
            reasons: ['Brak składników', 'Brak kroków'],
        });
    },
});
