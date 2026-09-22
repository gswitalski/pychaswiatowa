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

export interface UpdateAdminUserRoleCommand {
    app_role: AppRole;
}

export interface UpdateAdminUserRoleResponseDto {
    user: AdminUserListItemDto;
}

export interface UpdateAdminUserAiCreditsCommand {
    draft_credits_total?: number;
    draft_credits_used?: number;
    image_credits_total?: number;
    image_credits_used?: number;
    limit_type?: 'lifetime' | 'monthly';
    next_reset_at?: string | null;
}

export interface AiCreditBalanceDto {
    total: number | null;
    used: number | null;
    remaining: number | null;
}

export interface UpdateAdminUserAiCreditsResponseDto {
    user_id: string;
    draft: AiCreditBalanceDto;
    image: AiCreditBalanceDto;
    limit_type: 'lifetime' | 'monthly' | 'unlimited';
    next_reset_at: string | null;
    updated_at: string | null;
}

const APP_ROLES = ['user', 'premium', 'admin'] as const;
const MAX_SMALLINT = 32767;

export const AdminUserRoleParamsSchema = z.string().uuid({
    message: 'Invalid user ID',
});

export const AdminUserRoleBodySchema = z.object({
    app_role: z.enum(APP_ROLES),
});

export const AdminUserAiCreditsBodySchema = z.object({
    draft_credits_total: z.number().int().nonnegative().max(MAX_SMALLINT).optional(),
    draft_credits_used: z.number().int().nonnegative().max(MAX_SMALLINT).optional(),
    image_credits_total: z.number().int().nonnegative().max(MAX_SMALLINT).optional(),
    image_credits_used: z.number().int().nonnegative().max(MAX_SMALLINT).optional(),
    limit_type: z.enum(['lifetime', 'monthly']).optional(),
    next_reset_at: z.string().datetime({ offset: true }).nullable().optional(),
}).strict().superRefine((data, context) => {
    if (
        data.draft_credits_used !== undefined
        && data.draft_credits_total !== undefined
        && data.draft_credits_used > data.draft_credits_total
    ) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['draft_credits_used'],
            message: 'draft_credits_used nie może być większe niż draft_credits_total',
        });
    }

    if (
        data.image_credits_used !== undefined
        && data.image_credits_total !== undefined
        && data.image_credits_used > data.image_credits_total
    ) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['image_credits_used'],
            message: 'image_credits_used nie może być większe niż image_credits_total',
        });
    }

    if (data.limit_type === 'monthly' && !data.next_reset_at) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['next_reset_at'],
            message: 'next_reset_at jest wymagane dla limitu miesięcznego',
        });
    }
});

export function validateAdminUserRoleParams(userId: string): string {
    const validationResult = AdminUserRoleParamsSchema.safeParse(userId);
    if (!validationResult.success) {
        logger.warn('[admin] Invalid userId path param for role update', {
            userId,
            issues: validationResult.error.issues,
        });
        throw new ApplicationError('VALIDATION_ERROR', 'Nieprawidlowy identyfikator uzytkownika.');
    }

    return validationResult.data;
}

export function validateAdminUserAiCreditsParams(userId: string): string {
    const validationResult = AdminUserRoleParamsSchema.safeParse(userId);
    if (!validationResult.success) {
        logger.warn('[admin] Invalid userId path param for AI credits update', {
            userId,
            issues: validationResult.error.issues,
        });
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Nieprawidłowy identyfikator użytkownika.',
        );
    }

    return validationResult.data;
}

export async function parseAndValidateAdminUserRoleBody(req: Request): Promise<UpdateAdminUserRoleCommand> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        logger.warn('[admin] Invalid JSON body for role update');
        throw new ApplicationError('VALIDATION_ERROR', 'Nieprawidlowe dane zadania.');
    }

    const validationResult = AdminUserRoleBodySchema.safeParse(body);
    if (!validationResult.success) {
        logger.warn('[admin] Invalid role update body', {
            issues: validationResult.error.issues,
        });
        throw new ApplicationError('VALIDATION_ERROR', 'Nieprawidlowa rola uzytkownika.');
    }

    return validationResult.data;
}

export async function parseAndValidateAdminUserAiCreditsBody(
    req: Request
): Promise<UpdateAdminUserAiCreditsCommand> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        throw new ApplicationError('VALIDATION_ERROR', 'Nieprawidłowe dane żądania.');
    }

    const validationResult = AdminUserAiCreditsBodySchema.safeParse(body);
    if (!validationResult.success) {
        logger.warn('[admin] Invalid AI credits update body', {
            issues: validationResult.error.issues,
        });
        throw new ApplicationError(
            'VALIDATION_ERROR',
            validationResult.error.issues[0]?.message ?? 'Nieprawidłowe dane kredytów AI.',
        );
    }

    return validationResult.data;
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

    return Object.fromEntries(
        Object.entries(validationResult.data).filter(([, value]) => value !== undefined),
    ) as GetAdminUsersQueryDto;
}
