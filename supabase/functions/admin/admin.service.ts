/**
 * Admin Service
 * Business logic for admin-only endpoints.
 */

import { logger } from '../_shared/logger.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import type { AppRole } from '../_shared/auth.ts';
import {
    ADMIN_USERS_SORT_FIELDS,
    type AdminUsersSortBy,
    type SortDirection,
    type GetAdminUsersQueryDto,
    type AdminUserListItemDto,
    type GetAdminUsersResponseDto,
} from './admin.types.ts';

const DEFAULT_ADMIN_USERS_PAGE = 1;
const DEFAULT_ADMIN_USERS_PAGE_SIZE = 25;
const MAX_ADMIN_USERS_PAGE_SIZE = 100;
const DEFAULT_ADMIN_USERS_SORT_BY: AdminUsersSortBy = 'created_at';
const DEFAULT_ADMIN_USERS_SORT_DIR: SortDirection = 'desc';

interface NormalizedAdminUsersQueryDto {
    page: number;
    page_size: number;
    sort_by: AdminUsersSortBy;
    sort_dir: SortDirection;
}

interface AdminUsersRpcRow {
    id: string | null;
    login: string | null;
    username: string | null;
    role: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
    recipes_count: number | string | null;
    total_items: number | string | null;
}

interface RpcErrorShape {
    code?: string | null;
    message: string;
    details?: string | null;
}

interface AdminUsersRpcClient {
    rpc: (
        functionName: string,
        args: Record<string, unknown>
    ) => Promise<{ data: AdminUsersRpcRow[] | null; error: RpcErrorShape | null }>;
}

export interface AdminSummaryDto {
    version: string;
    generated_at: string;
    notes: string;
    metrics: {
        users_total: number | null;
        recipes_total: number | null;
        public_recipes_total: number | null;
    };
}

export interface AdminHealthDto {
    status: 'ok';
    checked_at: string;
}

function mapRole(rawRole: string | null): AppRole {
    if (rawRole === 'admin' || rawRole === 'premium' || rawRole === 'user') {
        return rawRole;
    }

    return 'user';
}

function toSafeNonNegativeNumber(value: number | string | null): number {
    if (value === null) {
        return 0;
    }

    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return Math.max(0, Math.floor(parsed));
}

function normalizeAdminUsersQuery(query: GetAdminUsersQueryDto): NormalizedAdminUsersQueryDto {
    const page = Number.isInteger(query.page) && (query.page ?? 0) >= 1
        ? (query.page as number)
        : DEFAULT_ADMIN_USERS_PAGE;
    const requestedPageSize = Number.isInteger(query.page_size) && (query.page_size ?? 0) >= 1
        ? (query.page_size as number)
        : DEFAULT_ADMIN_USERS_PAGE_SIZE;
    const pageSize = Math.min(requestedPageSize, MAX_ADMIN_USERS_PAGE_SIZE);
    const sortBy = ADMIN_USERS_SORT_FIELDS.includes(query.sort_by as AdminUsersSortBy)
        ? (query.sort_by as AdminUsersSortBy)
        : DEFAULT_ADMIN_USERS_SORT_BY;
    const sortDir = query.sort_dir === 'asc' || query.sort_dir === 'desc'
        ? query.sort_dir
        : DEFAULT_ADMIN_USERS_SORT_DIR;

    return {
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_dir: sortDir,
    };
}

function mapAdminUsersRowToDto(row: AdminUsersRpcRow): AdminUserListItemDto {
    if (!row.id || !row.created_at) {
        throw new ApplicationError('INTERNAL_ERROR', 'Invalid admin users row received from RPC');
    }

    return {
        id: row.id,
        login: row.login ?? '',
        username: row.username ?? '',
        role: mapRole(row.role),
        created_at: row.created_at,
        last_sign_in_at: row.last_sign_in_at ?? null,
        recipes_count: toSafeNonNegativeNumber(row.recipes_count),
    };
}

async function getAdminUsersPageFromRpc(
    query: NormalizedAdminUsersQueryDto
): Promise<AdminUsersRpcRow[]> {
    const client = createServiceRoleClient() as unknown as AdminUsersRpcClient;
    const { data, error } = await client.rpc('admin_get_users_page', {
        p_page_number: query.page,
        p_page_size: query.page_size,
        p_sort_by: query.sort_by,
        p_sort_dir: query.sort_dir,
    });

    if (error) {
        logger.error('[admin] RPC error while fetching admin users', {
            errorCode: error.code,
            errorMessage: error.message,
            errorDetails: error.details,
            page: query.page,
            pageSize: query.page_size,
            sortBy: query.sort_by,
            sortDir: query.sort_dir,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch admin users');
    }

    return data ?? [];
}

export async function getAdminSummary(): Promise<AdminSummaryDto> {
    logger.info('[admin] Generating summary stub');

    return {
        version: 'mvp-stub',
        generated_at: new Date().toISOString(),
        notes: 'Admin dashboard placeholder; dane zostana dodane w kolejnych iteracjach.',
        metrics: {
            users_total: null,
            recipes_total: null,
            public_recipes_total: null,
        },
    };
}

export async function getAdminHealth(): Promise<AdminHealthDto> {
    logger.info('[admin] Generating health stub');

    return {
        status: 'ok',
        checked_at: new Date().toISOString(),
    };
}

export async function getAdminUsers(
    { query }: { query: GetAdminUsersQueryDto }
): Promise<GetAdminUsersResponseDto> {
    const normalizedQuery = normalizeAdminUsersQuery(query);
    logger.info('[admin] Fetching admin users list', normalizedQuery);

    const rows = await getAdminUsersPageFromRpc(normalizedQuery);
    const data = rows.map(mapAdminUsersRowToDto);
    const totalItems = rows.length > 0 ? toSafeNonNegativeNumber(rows[0].total_items) : 0;
    const totalPages = totalItems === 0
        ? 0
        : Math.ceil(totalItems / normalizedQuery.page_size);

    return {
        data,
        pagination: {
            currentPage: normalizedQuery.page,
            pageSize: normalizedQuery.page_size,
            totalPages,
            totalItems,
        },
        sorting: {
            sort_by: normalizedQuery.sort_by,
            sort_dir: normalizedQuery.sort_dir,
        },
    };
}
