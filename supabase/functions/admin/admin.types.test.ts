import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { validateAdminUsersQuery } from './admin.types.ts';

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
