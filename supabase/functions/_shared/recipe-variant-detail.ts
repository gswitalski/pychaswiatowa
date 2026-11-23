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
    user_action_state?: RecipeVariantUserActionState;
}

export interface RecipeVariantUserActionState {
    is_favorite: boolean;
    wants_to_try: boolean;
    in_plan: boolean;
    in_collection: boolean;
    has_note: boolean;
    my_rating: number | null;
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

async function getUserActionStateMap(
    client: TypedSupabaseClient,
    recipeIds: number[],
    userId: string | null,
): Promise<Map<number, RecipeVariantUserActionState>> {
    const result = new Map<number, RecipeVariantUserActionState>();
    if (!userId || recipeIds.length === 0) return result;

    const [flags, plan, collections, notes, ratings] = await Promise.all([
        client.from('user_recipe_flags').select('recipe_id,is_favorite,is_want_to_try')
            .eq('user_id', userId),
        client.from('plan_recipes').select('recipe_id').eq('user_id', userId),
        client.from('recipe_collections').select('recipe_id,collections!inner(user_id)')
            .eq('collections.user_id', userId),
        client.from('user_recipe_notes').select('recipe_id').eq('user_id', userId),
        client.from('recipe_ratings').select('recipe_id,rating').eq('user_id', userId),
    ]);
    if (flags.error || plan.error || collections.error || notes.error || ratings.error) {
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe variant action state');
    }

    const recipeIdSet = new Set(recipeIds);
    const planIds = new Set((plan.data ?? []).map((row) => Number(row.recipe_id)).filter((id) => recipeIdSet.has(id)));
    const collectionIds = new Set((collections.data ?? []).map((row) => Number(row.recipe_id)).filter((id) => recipeIdSet.has(id)));
    const noteIds = new Set((notes.data ?? []).map((row) => Number(row.recipe_id)).filter((id) => recipeIdSet.has(id)));
    const ratingMap = new Map<number, number>();
    for (const row of ratings.data ?? []) {
        const id = Number(row.recipe_id);
        if (recipeIdSet.has(id)) ratingMap.set(id, Number(row.rating));
    }
    const flagMap = new Map<number, { is_favorite: boolean; wants_to_try: boolean }>();
    for (const row of flags.data ?? []) {
        const id = Number(row.recipe_id);
        if (recipeIdSet.has(id)) {
            flagMap.set(id, {
                is_favorite: Boolean(row.is_favorite),
                wants_to_try: Boolean(row.is_want_to_try),
            });
        }
    }

    for (const recipeId of recipeIds) {
        const flag = flagMap.get(recipeId);
        result.set(recipeId, {
            is_favorite: flag?.is_favorite ?? false,
            wants_to_try: flag?.wants_to_try ?? false,
            in_plan: planIds.has(recipeId),
            in_collection: collectionIds.has(recipeId),
            has_note: noteIds.has(recipeId),
            my_rating: ratingMap.get(recipeId) ?? null,
        });
    }
    return result;
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

    const actionState = await getUserActionStateMap(
        serviceClient,
        visibleRows.slice(0, 10).map((row) => Number(row.id)),
        params.requesterUserId,
    );

    return {
        enabled: true,
        selectedId,
        summaries: visibleRows.map((row) => {
            const summary = mapSummary(row, getDifferingFields(visibleRows));
            const state = actionState.get(summary.recipe_id);
            return state ? { ...summary, user_action_state: state } : summary;
        }),
        resolution,
    };
}
