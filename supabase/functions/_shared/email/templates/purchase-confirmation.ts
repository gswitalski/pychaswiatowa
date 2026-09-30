import type { PaymentMethod, PlanId } from '../../billing/billing-plans.ts';

export interface PurchaseConfirmationData {
    username: string;
    planId: PlanId;
    paymentMethod: PaymentMethod;
    amountGross: number;
    periodEnd: string;
    documentUrl: string | null;
    appBaseUrl: string;
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatDate(value: string): string {
    return new Intl.DateTimeFormat('pl-PL', {
        dateStyle: 'long',
        timeZone: 'Europe/Warsaw',
    }).format(new Date(value));
}

export function renderPurchaseConfirmation(
    data: PurchaseConfirmationData,
): { subject: string; html: string; text: string } {
    const planName = data.planId === 'premium_yearly'
        ? 'Premium roczny'
        : 'Premium miesięczny';
    const methodName = data.paymentMethod === 'card' ? 'karta płatnicza' : 'BLIK';
    const periodLabel = data.paymentMethod === 'card'
        ? 'Następna płatność'
        : 'Dostęp Premium do';
    const amount = new Intl.NumberFormat('pl-PL', {
        style: 'currency',
        currency: 'PLN',
    }).format(data.amountGross / 100);
    const settingsUrl = `${data.appBaseUrl.replace(/\/+$/, '')}/settings`;
    const documentText = data.documentUrl
        ? `Dokument sprzedaży: ${data.documentUrl}\n`
        : '';
    const documentHtml = data.documentUrl
        ? `<p><a href="${escapeHtml(data.documentUrl)}">Pobierz dokument sprzedaży</a></p>`
        : '';

    return {
        subject: 'Potwierdzenie zakupu PychaŚwiatowa Premium',
        text: [
            `Cześć ${data.username},`,
            '',
            'Dziękujemy za zakup subskrypcji PychaŚwiatowa Premium.',
            `Plan: ${planName}`,
            `Kwota: ${amount}`,
            `Metoda płatności: ${methodName}`,
            `${periodLabel}: ${formatDate(data.periodEnd)}`,
            documentText.trimEnd(),
            `Ustawienia konta: ${settingsUrl}`,
        ].filter(Boolean).join('\n'),
        html: [
            '<!doctype html><html lang="pl"><body>',
            `<p>Cześć ${escapeHtml(data.username)},</p>`,
            '<p>Dziękujemy za zakup subskrypcji <strong>PychaŚwiatowa Premium</strong>.</p>',
            '<ul>',
            `<li>Plan: ${planName}</li>`,
            `<li>Kwota: ${amount}</li>`,
            `<li>Metoda płatności: ${methodName}</li>`,
            `<li>${periodLabel}: ${formatDate(data.periodEnd)}</li>`,
            '</ul>',
            documentHtml,
            `<p><a href="${escapeHtml(settingsUrl)}">Przejdź do ustawień konta</a></p>`,
            '</body></html>',
        ].join(''),
    };
}
