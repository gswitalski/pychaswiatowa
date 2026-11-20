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
