import { z } from 'npm:zod@3.22.4';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    DEFAULT_BAD_ADMIN_USERS_QUERY_MESSAGE,
    PositiveIntegerQueryStringSchema,
    type SortDirection,
} from './admin.types.ts';

export const ADMIN_RECIPES_SORT_FIELDS = [
    'name',
    'author',
    'category',
    'created_at',
    'average_rating',
    'ratings_count',
] as const;
export type AdminRecipesSortBy = (typeof ADMIN_RECIPES_SORT_FIELDS)[number];

export interface GetAdminRecipesQueryDto {
    page?: number;
    page_size?: number;
    sort_by?: AdminRecipesSortBy;
    sort_dir?: SortDirection;
}

export interface AdminRecipeListItemDto {
    id: number;
    name: string;
    author_id: string;
    author_username: string | null;
    author_email: string | null;
    category_name: string | null;
    created_at: string;
    average_rating: number | null;
    ratings_count: number;
    is_grill: boolean;
    is_termorobot: boolean;
}

export interface GetAdminRecipesResponseDto {
    data: AdminRecipeListItemDto[];
    pagination: {
        currentPage: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    };
    sorting: {
        sort_by: AdminRecipesSortBy;
        sort_dir: SortDirection;
    };
}

export const AdminRecipesQuerySchema = z.object({
    page: PositiveIntegerQueryStringSchema.optional().refine(
        (value) => value === undefined || value <= Number.MAX_SAFE_INTEGER,
        { message: 'page cannot exceed Number.MAX_SAFE_INTEGER' },
    ),
    page_size: PositiveIntegerQueryStringSchema.optional().refine(
        (value) => value === undefined || value <= 100,
        { message: 'page_size cannot exceed 100' },
    ),
    sort_by: z.enum(ADMIN_RECIPES_SORT_FIELDS).optional(),
    sort_dir: z.enum(['asc', 'desc']).optional(),
});

export function validateAdminRecipesQuery(params: URLSearchParams): GetAdminRecipesQueryDto {
    const rawQuery = {
        page: params.get('page') ?? undefined,
        page_size: params.get('page_size') ?? undefined,
        sort_by: params.get('sort_by') ?? undefined,
        sort_dir: params.get('sort_dir') ?? undefined,
    };
    const result = AdminRecipesQuerySchema.safeParse(rawQuery);
    if (!result.success) {
        logger.warn('[admin] Invalid admin recipes query params', {
            issues: result.error.issues,
            rawQuery,
        });
        throw new ApplicationError('VALIDATION_ERROR', DEFAULT_BAD_ADMIN_USERS_QUERY_MESSAGE);
    }

    return Object.fromEntries(
        Object.entries(result.data).filter(([, value]) => value !== undefined),
    ) as GetAdminRecipesQueryDto;
}
