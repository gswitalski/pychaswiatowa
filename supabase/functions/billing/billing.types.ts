import { z } from 'npm:zod@3.22.4';

export const GetBillingPaymentsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const BILLING_PAYMENT_SELECT_COLUMNS =
    'id, plan_id, payment_method_type, amount_gross, currency, status, paid_at, document_number, document_url, document_pdf_url';
