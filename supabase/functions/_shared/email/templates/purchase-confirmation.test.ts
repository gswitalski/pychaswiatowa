import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/assert_string_includes.ts';
import { renderPurchaseConfirmation } from './purchase-confirmation.ts';

Deno.test('purchase confirmation: escapuje nazwę użytkownika i renderuje kartę', () => {
    const result = renderPurchaseConfirmation({
        username: '<Jan & "Anna">',
        planId: 'premium_monthly',
        paymentMethod: 'card',
        amountGross: 2400,
        periodEnd: '2026-10-30T20:00:00.000Z',
        documentUrl: 'https://invoice.example/1',
        appBaseUrl: 'https://pychaswiatowa.pl/',
    });

    assertStringIncludes(result.html, '&lt;Jan &amp; &quot;Anna&quot;&gt;');
    assertStringIncludes(result.html, 'Następna płatność');
    assertStringIncludes(result.html, 'https://invoice.example/1');
    assertStringIncludes(result.text, '24,00');
});

Deno.test('purchase confirmation: BLIK bez dokumentu nie renderuje linku', () => {
    const result = renderPurchaseConfirmation({
        username: 'Jan',
        planId: 'premium_yearly',
        paymentMethod: 'blik',
        amountGross: 16900,
        periodEnd: '2027-09-30T20:00:00.000Z',
        documentUrl: null,
        appBaseUrl: 'https://pychaswiatowa.pl',
    });

    assertStringIncludes(result.html, 'Dostęp Premium do');
    assertEquals(result.html.includes('Pobierz dokument sprzedaży'), false);
});
