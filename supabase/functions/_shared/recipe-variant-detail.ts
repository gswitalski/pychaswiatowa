import type { TypedSupabaseClient } from './supabase-client.ts';
import { ApplicationError } from './errors.ts';

export type VariantResolutionReason = 'INVALID_PARAMETER' | 'VARIANT_DELETED';

export interface RecipeVariantSummaryDto {
    recipe_id: number;
    variant_name: string;
    is_default: boolean;
    sort_order: number;
    image_path: string | null;
    chips: {
        diet_type: string | null;
        is_termorobot: boolean;
        is_grill: boolean;
        difficulty: string | null;
        servings: number | null;
    };
}

export interface RecipeVariantResolutionDto {
    reason: VariantResolutionReason;
    message: string;
}

interface VariantRow {
    id: number;
    user_id: string;
    visibility: string;
    deleted_at: string | null;
    recipe_family_id: string | null;
    variant_name: string | null;
    is_default: boolean | null;
    sort_order: number | null;
    image_path: string | null;
    diet_type: string | null;
    is_termorobot: boolean | null;
    is_grill: boolean | null;
    difficulty: string | null;
    servings: number | null;
}

export interface VariantResolution {
    enabled: boolean;
    selectedId: number;
    summaries: RecipeVariantSummaryDto[];
    resolution: RecipeVariantResolutionDto | null;
}

const VARIANT_COLUMNS =
    'id, user_id, visibility, deleted_at, recipe_family_id, variant_name, is_default, sort_order, image_path, diet_type, is_termorobot, is_grill, difficulty, servings';

function isAccessible(row: VariantRow, requesterUserId: string | null): boolean {
    return row.user_id === requesterUserId || row.visibility === 'PUBLIC';
}

function invalidResolution(): RecipeVariantResolutionDto {
    return {
        reason: 'INVALID_PARAMETER',
        message: 'Wskazany wariant jest niedostępny — pokazujemy wariant domyślny.',
    };
}

function deletedResolution(): RecipeVariantResolutionDto {
    return {
        reason: 'VARIANT_DELETED',
        message: 'Ten wariant został usunięty — pokazujemy wariant domyślny.',
    };
}

function parseVariantId(raw: string | undefined): number | null {
    if (!raw || !/^[0-9]+$/.test(raw)) return null;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function mapSummary(row: VariantRow, differing: Set<string>): RecipeVariantSummaryDto {
    const chips: RecipeVariantSummaryDto['chips'] = {
        diet_type: differing.has('diet_type') ? row.diet_type : null,
        is_termorobot: differing.has('is_termorobot') && Boolean(row.is_termorobot),
        is_grill: differing.has('is_grill') && Boolean(row.is_grill),
        difficulty: differing.has('difficulty') ? row.difficulty : null,
        servings: differing.has('servings') ? row.servings : null,
    };
    return {
        recipe_id: Number(row.id),
        variant_name: row.variant_name ?? 'Wariant podstawowy',
        is_default: Boolean(row.is_default),
        sort_order: Number(row.sort_order ?? 0),
        image_path: row.image_path ?? null,
        chips,
    };
}

function getDifferingFields(rows: VariantRow[]): Set<string> {
    const fields = ['diet_type', 'is_termorobot', 'is_grill', 'difficulty', 'servings'] as const;
    return new Set(fields.filter((field) => new Set(rows.map((row) => row[field])).size > 1));
}

export async function resolveRecipeVariantDetail(params: {
    client: TypedSupabaseClient;
    recipeId: number;
    requesterUserId: string | null;
    rawVariantId?: string;
    isAdmin?: boolean;
    endpoint: 'recipes' | 'explore';
}): Promise<VariantResolution> {
    const serviceClient = params.client;
    const { data: feature, error: featureError } = await serviceClient
        .from('feature_flags')
        .select('mode')
        .eq('name', 'recipe_variants')
        .maybeSingle();
    if (featureError) throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch feature flags');
    const enabled = feature?.mode === 'all' || (feature?.mode === 'admin' && params.isAdmin === true);
    if (!enabled) {
        return {
            enabled: false,
            selectedId: params.recipeId,
            summaries: [],
            resolution: null,
        };
    }

    const { data: anchor, error: anchorError } = await serviceClient
        .from('recipes')
        .select(VARIANT_COLUMNS)
        .eq('id', params.recipeId)
        .maybeSingle();
    if (anchorError) throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe variant metadata');
    if (!anchor) throw new ApplicationError('NOT_FOUND', 'Recipe not found');

    const typedAnchor = anchor as unknown as VariantRow;
    const access = isAccessible(typedAnchor, params.requesterUserId);
    if (!access) {
        throw new ApplicationError(params.endpoint === 'recipes' ? 'FORBIDDEN' : 'NOT_FOUND', 'Recipe not found');
    }
    if (!typedAnchor.recipe_family_id) {
        return { enabled: true, selectedId: params.recipeId, summaries: [], resolution: null };
    }

    const { data: siblings, error: siblingsError } = await serviceClient
        .from('recipes')
        .select(VARIANT_COLUMNS)
        .eq('recipe_family_id', typedAnchor.recipe_family_id)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
    if (siblingsError) throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe variants');

    const activeRows = (siblings ?? []) as unknown as VariantRow[];
    const visibleRows = activeRows.filter((row) => isAccessible(row, params.requesterUserId));
    if (visibleRows.length === 0) {
        throw new ApplicationError('NOT_FOUND', 'Recipe not found');
    }
    const defaultRow = visibleRows.find((row) => row.is_default) ?? visibleRows[0];
    let selectedId = Number(typedAnchor.id);
    let resolution: RecipeVariantResolutionDto | null = null;
    const requestedId = parseVariantId(params.rawVariantId);

    if (params.rawVariantId !== undefined && requestedId === null) {
        selectedId = Number(defaultRow.id);
        resolution = invalidResolution();
    } else if (requestedId !== null && requestedId !== params.recipeId) {
        const requested = activeRows.find((row) => Number(row.id) === requestedId);
        if (!requested) {
            const deleted = await serviceClient.from('recipes').select('id').eq('id', requestedId)
                .eq('recipe_family_id', typedAnchor.recipe_family_id).not('deleted_at', 'is', null).maybeSingle();
            selectedId = Number(defaultRow.id);
            resolution = deleted.data ? deletedResolution() : invalidResolution();
        } else if (!visibleRows.some((row) => Number(row.id) === requestedId)) {
            selectedId = Number(defaultRow.id);
            resolution = invalidResolution();
        } else {
            selectedId = requestedId;
        }
    } else if (typedAnchor.deleted_at !== null) {
        selectedId = Number(defaultRow.id);
        resolution = deletedResolution();
    }

    return {
        enabled: true,
        selectedId,
        summaries: visibleRows.map((row) => mapSummary(row, getDifferingFields(visibleRows))),
        resolution,
    };
}
