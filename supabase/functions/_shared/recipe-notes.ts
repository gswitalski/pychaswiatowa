import { logger } from './logger.ts';
import type { TypedSupabaseClient } from './supabase-client.ts';

/** Response shape for PUT /recipes/{id}/note */
export interface RecipeNoteDto {
    recipe_id: number;
    my_note: string | null;
}

/**
 * Result of reading the user's note.
 * `ok` with `note: null` means "the user has no note"; `unavailable` means the read
 * failed and the real state is unknown. These MUST NOT be conflated: treating a failed
 * read as "no note" would let the client overwrite an existing note.
 */
export type RecipeNoteLookup =
    | { status: 'ok'; note: string | null }
    | { status: 'unavailable' };

/** Fields added to recipe detail responses for authenticated users. */
export interface RecipeNoteFields {
    /** Present only when the read succeeded; `null` = the user has no note. */
    my_note?: string | null;
    /** Present (true) only when reading the note failed; `my_note` is then omitted. */
    my_note_unavailable?: true;
}

/**
 * Fetches the authenticated user's private note for a single recipe.
 * Never returns `note: null` for a failed read - returns `unavailable` instead.
 */
export async function getRecipeNoteForUser(
    client: TypedSupabaseClient,
    recipeId: number,
    userId: string | null
): Promise<RecipeNoteLookup> {
    if (userId === null) {
        return { status: 'ok', note: null };
    }

    try {
        const { data, error } = await client
            .from('user_recipe_notes')
            .select('note')
            .eq('user_id', userId)
            .eq('recipe_id', recipeId)
            .maybeSingle();

        if (error) {
            logger.error('Error fetching recipe note', {
                errorCode: error.code,
                errorMessage: error.message,
                userId,
                recipeId,
            });
            return { status: 'unavailable' };
        }

        return { status: 'ok', note: data?.note ?? null };
    } catch (error) {
        logger.error('Unexpected error fetching recipe note', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            recipeId,
        });
        return { status: 'unavailable' };
    }
}

/**
 * Builds the note fields for recipe detail responses.
 * Anonymous: no fields. Authenticated: `my_note` when known, otherwise
 * `my_note_unavailable` (also when the lookup is missing - unknown is never "no note").
 */
export function buildNoteFields(
    lookup: RecipeNoteLookup | undefined,
    isAuthenticated: boolean
): RecipeNoteFields {
    if (!isAuthenticated) {
        return {};
    }

    if (lookup?.status === 'ok') {
        return { my_note: lookup.note };
    }

    return { my_note_unavailable: true };
}
