import { logger } from './logger.ts';
import { TypedSupabaseClient } from './supabase-client.ts';

export const RECIPE_NOTE_MAX_LENGTH = 2000;

export interface RecipeNoteResponseDto {
    recipe_id: number;
    note: string | null;
    updated_at: string | null;
}

export function normalizeRecipeNote(raw: string | null): string | null {
    if (raw === null) {
        return null;
    }

    const normalized = raw.replace(/\r\n?/g, '\n').trim();
    return normalized === '' ? null : normalized;
}

export function countRecipeNoteCharacters(note: string): number {
    return Array.from(note).length;
}

export async function getMyRecipeNote(
    client: TypedSupabaseClient,
    recipeId: number,
    userId: string | null
): Promise<string | null | undefined> {
    if (userId === null) {
        return undefined;
    }

    try {
        const { data, error } = await client
            .from('user_recipe_notes')
            .select('note')
            .eq('user_id', userId)
            .eq('recipe_id', recipeId)
            .maybeSingle();

        if (error) {
            logger.error('Error fetching own recipe note', {
                errorCode: error.code,
                errorMessage: error.message,
                userId,
                recipeId,
            });
            return undefined;
        }

        return data?.note ?? null;
    } catch (error) {
        logger.error('Unexpected error fetching own recipe note', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            recipeId,
        });
        return undefined;
    }
}
