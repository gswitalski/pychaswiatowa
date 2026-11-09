import { describe, expect, it } from 'vitest';
import { extractFunctionErrorStatus, toStatusError } from './function-error-status';

describe('function-error-status', () => {
    it('wyciąga status z błędu i jego kontekstu', () => {
        expect(extractFunctionErrorStatus({ status: 401 })).toBe(401);
        expect(extractFunctionErrorStatus({ context: { status: 404 } })).toBe(404);
        expect(extractFunctionErrorStatus({ message: 'Forbidden' })).toBe(403);
        expect(extractFunctionErrorStatus(null)).toBeNull();
    });

    it('buduje błąd ze statusem domyślnym', () => {
        expect(toStatusError(null, 'Fallback')).toMatchObject({
            message: 'Fallback',
            status: 500,
        });
    });
});
