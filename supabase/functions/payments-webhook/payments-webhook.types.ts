import type { PaymentMethod, PlanId } from '../_shared/billing/billing-plans.ts';

export type WebhookProcessingResult = 'processed' | 'ignored';

export class WebhookPermanentError extends Error {
    constructor(public readonly reason: string) {
        super(reason);
        this.name = 'WebhookPermanentError';
    }
}

export interface ResolvedPurchase {
    userId: string;
    planId: PlanId;
    paymentMethod: PaymentMethod;
    autoRenew: boolean;
    periodStart: Date;
    periodEnd: Date;
    providerSubscriptionId: string | null;
    payment: {
        amount_gross: number;
        currency: 'PLN';
        provider_session_id: string;
        provider_payment_intent_id: string | null;
        provider_invoice_id: string | null;
        document_number: string | null;
        document_url: string | null;
        document_pdf_url: string | null;
        terms_version: string | null;
        terms_accepted_at: string | null;
        paid_at: string;
    };
}
