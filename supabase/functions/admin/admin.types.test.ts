import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { ApplicationError } from '../_shared/errors.ts';
import {
    validateAdminUsersQuery,
    validateAdminUserRoleParams,
    AdminUserRoleBodySchema,
    AdminUserAiCreditsBodySchema,
} from './admin.types.ts';

function createSearchParams(raw: string): URLSearchParams {
    return new URLSearchParams(raw);
}

Deno.test('validateAdminUsersQuery: poprawne query przechodzi walidację', () => {
    const params = createSearchParams('page=2&page_size=10&sort_by=login&sort_dir=asc');
    const result = validateAdminUsersQuery(params);

    assertEquals(result, {
        page: 2,
        page_size: 10,
        sort_by: 'login',
        sort_dir: 'asc',
    });
});

Deno.test('validateAdminUsersQuery: puste query przechodzi (domysly uzupelnia serwis)', () => {
    const params = createSearchParams('');
    const result = validateAdminUsersQuery(params);

    assertEquals(result, {});
});

Deno.test('validateAdminUsersQuery: page=0 zwraca VALIDATION_ERROR', () => {
    const params = createSearchParams('page=0');

    let thrown: unknown = null;
    try {
        validateAdminUsersQuery(params);
    } catch (error) {
        thrown = error;
    }

    assertEquals(thrown instanceof ApplicationError, true);
    if (thrown instanceof ApplicationError) {
        assertEquals(thrown.code, 'VALIDATION_ERROR');
    }
});

Deno.test('validateAdminUsersQuery: page_size=101 zwraca VALIDATION_ERROR', () => {
    const params = createSearchParams('page_size=101');

    let thrown: unknown = null;
    try {
        validateAdminUsersQuery(params);
    } catch (error) {
        thrown = error;
    }

    assertEquals(thrown instanceof ApplicationError, true);
    if (thrown instanceof ApplicationError) {
        assertEquals(thrown.code, 'VALIDATION_ERROR');
    }
});

Deno.test('validateAdminUserRoleParams: poprawny UUID przechodzi', () => {
    const userId = '7c8966c3-bc93-4bda-bcd1-bdcfd2af7b99';
    const result = validateAdminUserRoleParams(userId);
    assertEquals(result, userId);
});

Deno.test('validateAdminUserRoleParams: nieprawidlowy UUID zwraca VALIDATION_ERROR', () => {
    let thrown: unknown = null;
    try {
        validateAdminUserRoleParams('not-a-uuid');
    } catch (error) {
        thrown = error;
    }

    assertEquals(thrown instanceof ApplicationError, true);
    if (thrown instanceof ApplicationError) {
        assertEquals(thrown.code, 'VALIDATION_ERROR');
    }
});

Deno.test('AdminUserRoleBodySchema: akceptuje dozwolone role', () => {
    for (const app_role of ['user', 'premium', 'admin'] as const) {
        const result = AdminUserRoleBodySchema.safeParse({ app_role });
        assertEquals(result.success, true);
    }
});

Deno.test('AdminUserRoleBodySchema: odrzuca nieprawidlowa role', () => {
    const result = AdminUserRoleBodySchema.safeParse({ app_role: 'superadmin' });
    assertEquals(result.success, false);
});

Deno.test('AdminUserAiCreditsBodySchema: akceptuje poprawną korektę', () => {
    const result = AdminUserAiCreditsBodySchema.safeParse({
        draft_credits_total: 10,
        draft_credits_used: 2,
        limit_type: 'monthly',
        next_reset_at: '2026-10-15T00:00:00.000Z',
    });

    assertEquals(result.success, true);
});

Deno.test('AdminUserAiCreditsBodySchema: odrzuca used większe niż total', () => {
    const result = AdminUserAiCreditsBodySchema.safeParse({
        draft_credits_total: 1,
        draft_credits_used: 2,
    });

    assertEquals(result.success, false);
});

Deno.test('AdminUserAiCreditsBodySchema: wymaga daty resetu dla monthly', () => {
    const result = AdminUserAiCreditsBodySchema.safeParse({
        limit_type: 'monthly',
    });

    assertEquals(result.success, false);
});
