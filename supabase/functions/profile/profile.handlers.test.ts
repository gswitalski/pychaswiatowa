import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { extractProfileSubPath } from './profile.handlers.ts';

Deno.test('extractProfileSubPath: lokalny gateway z /functions/v1/profile', () => {
    assertEquals(
        extractProfileSubPath(
            'http://127.0.0.1:54331/functions/v1/profile/change-password'
        ),
        '/change-password'
    );
    assertEquals(
        extractProfileSubPath(
            'http://127.0.0.1:54331/functions/v1/profile/username-available'
        ),
        '/username-available'
    );
    assertEquals(
        extractProfileSubPath('http://127.0.0.1:54331/functions/v1/profile'),
        '/'
    );
});

Deno.test('extractProfileSubPath: ścieżka wdrożenia /profile/...', () => {
    assertEquals(
        extractProfileSubPath('https://example.supabase.co/profile/change-password'),
        '/change-password'
    );
});

Deno.test('extractProfileSubPath: sam sufiks (runtime produkcyjny)', () => {
    assertEquals(
        extractProfileSubPath('https://example.supabase.co/change-password'),
        '/change-password'
    );
});

Deno.test('extractProfileSubPath: normalizuje końcowy slash', () => {
    assertEquals(
        extractProfileSubPath(
            'http://127.0.0.1:54331/functions/v1/profile/change-password/'
        ),
        '/change-password'
    );
});
