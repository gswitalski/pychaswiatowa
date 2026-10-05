import type {
    SubscriptionPaymentMethod,
    SubscriptionPlanId,
} from '../../../../../shared/contracts/types';

/** Stan formularza na /checkout. */
export interface CheckoutFormState {
    planId: SubscriptionPlanId;
    paymentMethod: SubscriptionPaymentMethod;
    acceptedTerms: boolean;
    acceptedDigitalWaiver: boolean;
}

/** Faza wysyłki formularza checkout. */
export type CheckoutSubmitState = 'idle' | 'submitting' | 'redirecting' | 'error';

/** Kody błędów obsługiwane przez widok checkout. */
export type CheckoutErrorCode =
    | 'VALIDATION_ERROR'
    | 'SUBSCRIPTION_ALREADY_ACTIVE'
    | 'FORBIDDEN_ROLE'
    | 'RATE_LIMITED'
    | 'PAYMENT_PROVIDER_ERROR'
    | 'UNAUTHORIZED'
    | 'NETWORK_ERROR'
    | 'UNKNOWN';

export interface CheckoutErrorViewModel {
    code: CheckoutErrorCode;
    message: string;
    status: number;
    retryAfterSeconds?: number;
}

/** Wybór zachowywany na czas przekierowania do operatora płatności. */
export interface CheckoutDraft {
    planId: SubscriptionPlanId;
    paymentMethod: SubscriptionPaymentMethod;
}

export interface PlanOptionViewModel {
    id: SubscriptionPlanId;
    label: string;
    priceGross: number;
    priceSuffix: string;
    monthlyEquivalent: number | null;
    savingsPercent: number | null;
}

export interface PaymentMethodOptionViewModel {
    id: SubscriptionPaymentMethod;
    label: string;
    description: string;
    icon: string;
    autoRenew: boolean;
}

export interface OrderSummaryViewModel {
    planLabel: string;
    amountGross: number;
    dateKind: 'nextPayment' | 'activeUntil';
    periodEnd: Date;
    autoRenew: boolean;
}

export type CheckoutSuccessState = 'confirming' | 'confirmed' | 'pending';

export interface CheckoutSuccessViewModel {
    planId: SubscriptionPlanId | null;
    currentPeriodEnd: Date | null;
    autoRenew: boolean | null;
    invoiceUrl: string | null;
}
