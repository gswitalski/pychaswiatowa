import { createServiceRoleClient, type TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';

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

export interface RecipeVariantsResponseDto {
    data: RecipeVariantSummaryDto[];
}

export interface RecipeUsageDto {
    plan: number;
    collections: number;
    shopping_list: number;
}

function mapRpcError(error: { code?: string; message?: string }): never {
    if (error.code === 'P0003') throw new ApplicationError('FORBIDDEN', 'Recipe variants feature is disabled');
    if (error.code === 'P0002') throw new ApplicationError('NOT_FOUND', 'Recipe not found');
    if (error.code === 'P0009') throw new ApplicationError('CONFLICT', error.message ?? 'Operation conflicts with recipe variant rules');
    if (error.code === '23505') throw new ApplicationError('CONFLICT', 'Variant name already exists');
    if (error.code === 'P0001') throw new ApplicationError('VALIDATION_ERROR', error.message ?? 'Invalid recipe content');
    if (error.code === '22023') throw new ApplicationError('VALIDATION_ERROR', error.message ?? 'Invalid variant data');
    logger.error('Recipe variant RPC failed', {
        errorCode: error.code,
        errorMessage: error.message,
    });
    throw new ApplicationError('INTERNAL_ERROR', 'Recipe variant operation failed');
}

interface RpcClient {
    rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
}

interface VariantRow {
    recipe_id: number;
    variant_name: string;
    is_default: boolean;
    sort_order: number;
    image_path: string | null;
    diet_type: string | null;
    is_termorobot: boolean;
    is_grill: boolean;
    difficulty: string | null;
    servings: number | null;
}
interface CreateVariantResult {
    recipe_id: number;
    source_image_path?: string | null;
    image_warning?: string | null;
}
export interface CreateAiRecipeVariantInput {
    variantName: string;
    familyName: string | null;
    visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
    description: string | null;
    ingredientsRaw: string;
    stepsRaw: string;
    tags: string[];
    tipsRaw: string | null;
    categoryId: number | null;
    servings: number | null;
    prepTimeMinutes: number | null;
    totalTimeMinutes: number | null;
    dietType: string | null;
    cuisine: string | null;
    difficulty: string | null;
    isTermorobot: boolean;
    isGrill: boolean;
}
interface UsageResult { plan: number; collections: number; shopping_list: number }

function rpcClient(client?: TypedSupabaseClient): RpcClient {
    return (client ?? createServiceRoleClient()) as unknown as RpcClient;
}

export async function listRecipeVariants(
    _client: TypedSupabaseClient,
    recipeId: number,
    userId: string,
    isAdmin: boolean,
): Promise<RecipeVariantsResponseDto> {
    const { data, error } = await rpcClient(_client).rpc('recipe_variants_list', {
        p_recipe_id: recipeId, p_user_id: userId, p_is_admin: isAdmin,
    });
    if (error) mapRpcError(error);
    return {
        data: (data as VariantRow[] | null ?? []).map((row) => ({
            recipe_id: Number(row.recipe_id),
            variant_name: row.variant_name,
            is_default: Boolean(row.is_default),
            sort_order: Number(row.sort_order),
            image_path: row.image_path ?? null,
            chips: {
                diet_type: row.diet_type ?? null,
                is_termorobot: Boolean(row.is_termorobot),
                is_grill: Boolean(row.is_grill),
                difficulty: row.difficulty ?? null,
                servings: row.servings === null ? null : Number(row.servings),
            },
        })),
    };
}

async function callBooleanRpc(client: TypedSupabaseClient, name: string, args: Record<string, unknown>): Promise<void> {
    const { error } = await rpcClient(client).rpc(name, args);
    if (error) mapRpcError(error);
}

export async function createRecipeVariant(
    _client: TypedSupabaseClient,
    recipeId: number,
    userId: string,
    variantName: string,
    sourceRecipeId: number | null,
    isAdmin: boolean,
): Promise<{ recipe_id: number; image_warning: string | null }> {
    const { data, error } = await rpcClient(_client).rpc('create_recipe_variant', {
        p_recipe_id: recipeId, p_user_id: userId, p_variant_name: variantName,
        p_source_recipe_id: sourceRecipeId, p_is_admin: isAdmin,
    });
    if (error) mapRpcError(error);
    const result = data as CreateVariantResult;
    if (!result.source_image_path) {
        return { recipe_id: Number(result.recipe_id), image_warning: result.image_warning ?? null };
    }

    const destination = `${userId}/${result.recipe_id}/cover_${Date.now()}${getImageExtension(result.source_image_path)}`;
    const storage = (_client ?? createServiceRoleClient()).storage.from('recipe-images');
    const { error: copyError } = await storage.copy(result.source_image_path, destination);
    if (copyError) {
        return {
            recipe_id: Number(result.recipe_id),
            image_warning: 'Nie udało się skopiować zdjęcia wariantu.',
        };
    }

    const { error: updateError } = await (_client ?? createServiceRoleClient())
        .from('recipes')
        .update({ image_path: destination })
        .eq('id', result.recipe_id)
        .eq('user_id', userId);
    if (updateError) {
        await storage.remove([destination]);
        return {
            recipe_id: Number(result.recipe_id),
            image_warning: 'Nie udało się przypisać skopiowanego zdjęcia.',
        };
    }

    return { recipe_id: Number(result.recipe_id), image_warning: null };
}

export async function createAiRecipeVariant(
    client: TypedSupabaseClient,
    recipeId: number,
    userId: string,
    input: CreateAiRecipeVariantInput,
    isAdmin: boolean,
): Promise<number> {
    const { data, error } = await rpcClient(client).rpc('create_recipe_variant_from_ai', {
        p_recipe_id: recipeId,
        p_user_id: userId,
        p_is_admin: isAdmin,
        p_variant_name: input.variantName,
        p_family_name: input.familyName,
        p_visibility: input.visibility,
        p_description: input.description,
        p_ingredients_raw: input.ingredientsRaw,
        p_steps_raw: input.stepsRaw,
        p_tag_names: input.tags,
        p_tips_raw: input.tipsRaw,
        p_category_id: input.categoryId,
        p_servings: input.servings,
        p_prep_time_minutes: input.prepTimeMinutes,
        p_total_time_minutes: input.totalTimeMinutes,
        p_diet_type: input.dietType,
        p_cuisine: input.cuisine,
        p_difficulty: input.difficulty,
        p_is_termorobot: input.isTermorobot,
        p_is_grill: input.isGrill,
    });
    if (error) mapRpcError(error);
    const result = data as { recipe_id?: number } | null;
    if (!result?.recipe_id) {
        throw new ApplicationError('INTERNAL_ERROR', 'Recipe variant RPC returned no recipe ID');
    }
    return Number(result.recipe_id);
}

function getImageExtension(path: string): string {
    const match = path.match(/(\.[a-z0-9]+)$/i);
    return match ? match[1] : '.jpg';
}

export async function renameRecipeVariant(_client: TypedSupabaseClient, recipeId: number, userId: string, name: string, isAdmin: boolean) {
    return await callBooleanRpc(_client, 'rename_recipe_variant', { p_recipe_id: recipeId, p_user_id: userId, p_variant_name: name, p_is_admin: isAdmin });
}

export async function updateRecipeFamily(_client: TypedSupabaseClient, recipeId: number, userId: string, name: string | null, visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC' | null, isAdmin: boolean) {
    return await callBooleanRpc(_client, 'update_recipe_family', { p_recipe_id: recipeId, p_user_id: userId, p_name: name, p_visibility: visibility, p_is_admin: isAdmin });
}

export async function setDefaultRecipeVariant(_client: TypedSupabaseClient, recipeId: number, userId: string, isAdmin: boolean) {
    return await callBooleanRpc(_client, 'set_default_recipe_variant', { p_recipe_id: recipeId, p_user_id: userId, p_is_admin: isAdmin });
}

export async function reorderRecipeVariants(_client: TypedSupabaseClient, recipeId: number, userId: string, ids: number[], isAdmin: boolean) {
    return await callBooleanRpc(_client, 'reorder_recipe_variants', { p_recipe_id: recipeId, p_user_id: userId, p_recipe_ids: ids, p_is_admin: isAdmin });
}

export async function getRecipeVariantUsage(_client: TypedSupabaseClient, recipeId: number, userId: string, isAdmin: boolean): Promise<RecipeUsageDto> {
    const { data, error } = await rpcClient(_client).rpc('recipe_variant_usage', { p_recipe_id: recipeId, p_user_id: userId, p_is_admin: isAdmin });
    if (error) mapRpcError(error);
    const result = data as UsageResult;
    return { plan: Number(result.plan), collections: Number(result.collections), shopping_list: Number(result.shopping_list) };
}

export async function deleteRecipeVariant(_client: TypedSupabaseClient, recipeId: number, userId: string, isAdmin: boolean) {
    return await callBooleanRpc(_client, 'delete_recipe_variant', { p_recipe_id: recipeId, p_user_id: userId, p_is_admin: isAdmin });
}

export async function deleteRecipeFamily(_client: TypedSupabaseClient, recipeId: number, userId: string, isAdmin: boolean) {
    return await callBooleanRpc(_client, 'delete_recipe_family', { p_recipe_id: recipeId, p_user_id: userId, p_is_admin: isAdmin });
}
