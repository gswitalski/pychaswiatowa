import { ApplicationError } from "../_shared/errors.ts";
import { logger } from "../_shared/logger.ts";
import { createServiceRoleClient } from "../_shared/supabase-client.ts";
import {
    type AdminRecipeListItemDto,
    type GetAdminRecipesQueryDto,
    type GetAdminRecipesResponseDto,
} from "./admin-recipes.types.ts";

interface AdminRecipesRpcRow {
    id: number | string | null;
    name: string | null;
    author_id: string | null;
    author_username: string | null;
    author_email: string | null;
    category_name: string | null;
    created_at: string | null;
    average_rating: number | string | null;
    ratings_count: number | string | null;
    is_grill: boolean | null;
    is_termorobot: boolean | null;
    total_items: number | string | null;
}

interface RpcErrorShape {
    code?: string | null;
    message: string;
    details?: string | null;
}

export interface AdminRecipesRpcClient {
    rpc: (
        functionName: string,
        args: Record<string, unknown>,
    ) => Promise<
        { data: AdminRecipesRpcRow[] | null; error: RpcErrorShape | null }
    >;
}

function toSafeNonNegativeNumber(value: number | string | null): number {
    if (value === null) {
        return 0;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function normalizeText(value: string | null): string | null {
    const normalized = value?.trim() ?? "";
    return normalized || null;
}

function normalizeRating(value: number | string | null): number | null {
    if (value === null) {
        return null;
    }
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return Math.round(parsed * 10) / 10;
}

function mapRow(row: AdminRecipesRpcRow): AdminRecipeListItemDto {
    if (
        row.id === null || row.name === null || row.created_at === null ||
        row.author_id === null
    ) {
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "Invalid admin recipes row received from RPC",
        );
    }
    return {
        id: toSafeNonNegativeNumber(row.id),
        name: row.name,
        author_id: row.author_id,
        author_username: normalizeText(row.author_username),
        author_email: normalizeText(row.author_email),
        category_name: normalizeText(row.category_name),
        created_at: row.created_at,
        average_rating: normalizeRating(row.average_rating),
        ratings_count: toSafeNonNegativeNumber(row.ratings_count),
        is_grill: row.is_grill === true,
        is_termorobot: row.is_termorobot === true,
    };
}

export async function getAdminRecipes(params: {
    query: GetAdminRecipesQueryDto;
    client?: AdminRecipesRpcClient;
}): Promise<GetAdminRecipesResponseDto> {
    const page = params.query.page ?? 1;
    const pageSize = params.query.page_size ?? 25;
    const sortBy = params.query.sort_by ?? "created_at";
    const sortDir = params.query.sort_dir ?? "desc";
    const filters = params.query;
    const client = params.client ??
        (createServiceRoleClient() as unknown as AdminRecipesRpcClient);
    const { data, error } = await client.rpc("admin_get_recipes_page", {
        p_page_number: page,
        p_page_size: pageSize,
        p_sort_by: sortBy,
        p_sort_dir: sortDir,
        p_recipe_id: filters.id ?? null,
        p_name: filters.name ?? null,
        p_author: filters.author ?? null,
        p_category_ids: filters.category_id ?? null,
        p_include_uncategorized: filters.uncategorized ?? false,
        p_created_from: filters.created_from ?? null,
        p_created_to: filters.created_to ?? null,
        p_rating_min: filters.rating_min ?? null,
        p_rating_max: filters.rating_max ?? null,
        p_ratings_count_min: filters.ratings_count_min ?? null,
        p_ratings_count_max: filters.ratings_count_max ?? null,
        p_is_grill: filters.is_grill ?? false,
        p_is_termorobot: filters.is_termorobot ?? false,
    });
    if (error) {
        logger.error("[admin] RPC error while fetching admin recipes", {
            errorCode: error.code,
            errorMessage: error.message,
            errorDetails: error.details,
            page,
            pageSize,
            sortBy,
            sortDir,
        });
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "Failed to fetch admin recipes",
        );
    }

    const rows = data ?? [];
    if (rows.length > 0 && rows[0].total_items === null) {
        throw new ApplicationError(
            "INTERNAL_ERROR",
            "Invalid total_items received from RPC",
        );
    }
    const totalItems = toSafeNonNegativeNumber(rows[0]?.total_items ?? null);
    const recipeRows = rows.filter((row) => row.id !== null).map(mapRow);
    if (rows.length === 0) {
        logger.warn("[admin] Admin recipes RPC returned no rows");
    }
    return {
        data: recipeRows,
        pagination: {
            currentPage: page,
            pageSize,
            totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
            totalItems,
        },
        sorting: {
            sort_by: sortBy,
            sort_dir: sortDir,
        },
    };
}
