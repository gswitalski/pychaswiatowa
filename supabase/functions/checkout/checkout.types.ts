import { z } from 'npm:zod@3.22.4';

export const CreateCheckoutSessionSchema = z.object({
    plan_id: z.enum(['premium_yearly', 'premium_monthly']),
    payment_method: z.enum(['card', 'blik']),
    accepted_terms: z.literal(true, {
        errorMap: () => ({ message: 'Wymagana akceptacja regulaminu' }),
    }),
    accepted_digital_content_waiver: z.literal(true, {
        errorMap: () => ({ message: 'Wymagana zgoda na natychmiastowe dostarczenie treści cyfrowej' }),
    }),
});

export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionSchema>;

export interface CheckoutSessionResponseDto {
    checkout_url: string;
    session_id: string;
    expires_at: string;
}
