import { z } from 'npm:zod@3.22.4';
import type { AppRole } from '../_shared/auth.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';

export const ADMIN_USERS_SORT_FIELDS = ['created_at', 'login', 'last_sign_in_at', 'recipes_count'] as const;
export const DEFAULT_BAD_ADMIN_USERS_QUERY_MESSAGE = 'Nieprawidlowe parametry paginacji lub sortowania.';

export type AdminUsersSortBy = (typeof ADMIN_USERS_SORT_FIELDS)[number];
export type SortDirection = 'asc' | 'desc';

export interface GetAdminUsersQueryDto {
    page?: number;
    page_size?: number;
    sort_by?: AdminUsersSortBy;
    sort_dir?: SortDirection;
}

export interface AdminUserListItemDto {
    id: string;
    login: string;
    username: string;
    role: AppRole;
    created_at: string;
    last_sign_in_at: string | null;
    recipes_count: number;
}

export interface GetAdminUsersResponseDto {
    data: AdminUserListItemDto[];
    pagination: {
        currentPage: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    };
    sorting: {
        sort_by: AdminUsersSortBy;
        sort_dir: SortDirection;
    };
}

const PositiveIntegerQueryStringSchema = z.string()
    .trim()
    .regex(/^\d+$/, 'Expected a positive integer')
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value >= 1, {
        message: 'Expected a positive integer',
    });

export const AdminUsersQuerySchema = z.object({
    page: PositiveIntegerQueryStringSchema.optional(),
    page_size: PositiveIntegerQueryStringSchema.optional().refine((value) => (
        value === undefined || value <= 100
    ), {
        message: 'page_size cannot exceed 100',
    }),
    sort_by: z.enum(ADMIN_USERS_SORT_FIELDS).optional(),
    sort_dir: z.enum(['asc', 'desc']).optional(),
});

export function validateAdminUsersQuery(params: URLSearchParams): GetAdminUsersQueryDto {
    const rawQuery = {
        page: params.get('page') ?? undefined,
        page_size: params.get('page_size') ?? undefined,
        sort_by: params.get('sort_by') ?? undefined,
        sort_dir: params.get('sort_dir') ?? undefined,
    };

    const validationResult = AdminUsersQuerySchema.safeParse(rawQuery);
    if (!validationResult.success) {
        logger.warn('[admin] Invalid admin users query params', {
            issues: validationResult.error.issues,
            rawQuery,
        });
        throw new ApplicationError('VALIDATION_ERROR', DEFAULT_BAD_ADMIN_USERS_QUERY_MESSAGE);
    }

    return validationResult.data;
}
