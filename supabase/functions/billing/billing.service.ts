import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { BILLING_PAYMENT_SELECT_COLUMNS } from './billing.types.ts';

export interface BillingPaymentDto {
    id: number;
    plan_id: 'premium_monthly' | 'premium_yearly';
    payment_method_type: 'card' | 'blik';
    amount_gross: number;
    currency: 'PLN';
    status: 'paid' | 'failed';
    paid_at: string | null;
    document_number: string | null;
    document_url: string | null;
    document_pdf_url: string | null;
}

export async function getBillingPayments(params: {
    client: TypedSupabaseClient;
    userId: string;
    limit: number;
}): Promise<BillingPaymentDto[]> {
    const { data, error } = await params.client
        .from('subscription_payments')
        .select(BILLING_PAYMENT_SELECT_COLUMNS)
        .eq('user_id', params.userId)
        .order('paid_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(params.limit);

    if (error) {
        logger.error('[billing] Failed to fetch payment history', {
            userId: params.userId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch billing payments');
    }

    return (data ?? []).map((row) => {
        const hasValidPlan = row.plan_id === 'premium_monthly'
            || row.plan_id === 'premium_yearly';
        const hasValidMethod = row.payment_method_type === 'card'
            || row.payment_method_type === 'blik';
        const hasValidStatus = row.status === 'paid' || row.status === 'failed';

        if (!hasValidPlan || !hasValidMethod || !hasValidStatus || row.currency !== 'PLN') {
            logger.error('[billing] Invalid payment row returned from database', {
                userId: params.userId,
                paymentId: row.id,
            });
            throw new ApplicationError('INTERNAL_ERROR', 'Invalid billing payment data');
        }

        return {
            id: row.id,
            plan_id: row.plan_id as BillingPaymentDto['plan_id'],
            payment_method_type:
                row.payment_method_type as BillingPaymentDto['payment_method_type'],
            amount_gross: row.amount_gross,
            currency: 'PLN',
            status: row.status as BillingPaymentDto['status'],
            paid_at: row.paid_at,
            document_number: row.document_number,
            document_url: row.document_url,
            document_pdf_url: row.document_pdf_url,
        };
    });
}
