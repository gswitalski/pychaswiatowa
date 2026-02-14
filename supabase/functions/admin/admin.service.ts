/**
 * Admin Service
 * Business logic for admin-only endpoints.
 */

import { logger } from '../_shared/logger.ts';

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
