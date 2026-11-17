import type { SubscriptionPaymentMethod } from '../../../../shared/contracts/types';

/**
 * Metody płatności widoczne w checkoucie. Wersja startowa (MVP) sprzedaje tylko kartę
 * (subskrypcja odnawiana automatycznie). BLIK jest obsłużony w API, ale ukryty w UI do czasu
 * wdrożenia przypomnień o końcu okresu (dodaj 'blik', skonfiguruj ceny jednorazowe w Stripe).
 */
export const CHECKOUT_ENABLED_PAYMENT_METHODS: readonly SubscriptionPaymentMethod[] = ['card'];
export const CHECKOUT_DRAFT_STORAGE_KEY = 'pych.checkoutDraft';
export const CHECKOUT_REDIRECT_ALLOWED_HOSTS = ['checkout.stripe.com'] as const;
export const CHECKOUT_POLL_INTERVAL_MS = 2_000;
export const CHECKOUT_POLL_MAX_ATTEMPTS = 15;
export const CHECKOUT_DEFAULT_RETRY_AFTER_SECONDS = 60;
export const SUPPORT_EMAIL = 'kontakt@pychaswiatowa.pl';
