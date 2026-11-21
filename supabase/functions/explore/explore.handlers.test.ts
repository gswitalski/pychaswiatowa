import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { getRequestedVariant } from './explore.handlers.ts';

Deno.test('PS-110 GWT 2–4: explore zachowuje surowy variant z query stringa', () => {
    const request = new Request('http://localhost/explore/recipes/10?variant=-1');
    assertEquals(getRequestedVariant(request), '-1');
});

Deno.test('PS-110 GWT 9: brak variant pozostaje undefined', () => {
    assertEquals(
        getRequestedVariant(new Request('http://localhost/explore/recipes/10')),
        undefined,
    );
});
