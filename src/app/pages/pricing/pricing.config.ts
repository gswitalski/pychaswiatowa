import type { SubscriptionPlanId } from '../../../../shared/contracts/types';

export type BillingPeriod = 'monthly' | 'yearly';
export type PlanAvailability = 'available' | 'unavailable' | 'text';

export interface PricingFeature {
    readonly name: string;
    readonly free: string;
    readonly premium: string;
    readonly freeAvailability: PlanAvailability;
    readonly premiumAvailability: PlanAvailability;
    readonly comingSoon?: boolean;
}

export interface PricingFeatureCategory {
    readonly name: string;
    readonly features: readonly PricingFeature[];
}

export const PRICING_CONFIG = {
    trial: {
        days: 7,
    },
    plans: {
        free: {
            id: 'free',
            name: 'Free',
            priceMonthly: 0,
            priceYearly: 0,
        },
        premium: {
            id: 'premium',
            name: 'Premium',
            priceMonthly: 2400,
            priceYearly: 16900,
            priceYearlyMonthly: 1408,
            savingsPercent: 17,
        },
    },
    limits: {
        free: {
            planItems: 3,
            aiImportsLifetime: 3,
        },
        premium: {
            planItems: 50,
        },
    },
} as const;

export const PLAN_ID_BY_PERIOD: Readonly<Record<BillingPeriod, SubscriptionPlanId>> = {
    monthly: 'premium_monthly',
    yearly: 'premium_yearly',
};

export const PERIOD_BY_PLAN_ID: Readonly<Record<SubscriptionPlanId, BillingPeriod>> = {
    premium_monthly: 'monthly',
    premium_yearly: 'yearly',
};

export function getPremiumPlanPrice(planId: SubscriptionPlanId): number {
    const period = PERIOD_BY_PLAN_ID[planId];

    return period === 'monthly'
        ? PRICING_CONFIG.plans.premium.priceMonthly
        : PRICING_CONFIG.plans.premium.priceYearly;
}

export const PLAN_BENEFITS = {
    free: [
        'Nielimitowane przepisy',
        'Kolekcje, tagi i import z Markdown',
        `Mój plan do ${PRICING_CONFIG.limits.free.planItems} pozycji`,
        `Do ${PRICING_CONFIG.limits.free.aiImportsLifetime} importów AI`,
    ],
    premium: [
        'Wszystko z planu Free',
        'Miesięczna pula kredytów AI',
        `Mój plan do ${PRICING_CONFIG.limits.premium.planItems} pozycji`,
        'Brak reklam i priorytet zadań AI',
    ],
} as const;

export const PRICING_FEATURE_CATEGORIES: readonly PricingFeatureCategory[] = [
    {
        name: 'AI i import',
        features: [
            {
                name: 'Asysta AI (draft przepisu z tekstu)',
                free: '1–3 importy lifetime',
                premium: 'Miesięczna pula kredytów',
                freeAvailability: 'text',
                premiumAvailability: 'text',
            },
            {
                name: 'Import ze zdjęcia / skanu',
                free: 'Niedostępne',
                premium: 'Dostępne',
                freeAvailability: 'unavailable',
                premiumAvailability: 'available',
                comingSoon: true,
            },
            {
                name: 'Import z URL',
                free: 'Niedostępne',
                premium: 'Dostępne',
                freeAvailability: 'unavailable',
                premiumAvailability: 'available',
                comingSoon: true,
            },
            {
                name: 'Generowanie zdjęcia AI',
                free: 'Niedostępne',
                premium: 'Z puli kredytów',
                freeAvailability: 'unavailable',
                premiumAvailability: 'text',
            },
        ],
    },
    {
        name: 'Przepisy i organizacja',
        features: [
            {
                name: 'Przepisy',
                free: 'Bez limitu',
                premium: 'Bez limitu',
                freeAvailability: 'text',
                premiumAvailability: 'text',
            },
            {
                name: 'Kolekcje i tagi',
                free: 'Dostępne',
                premium: 'Dostępne',
                freeAvailability: 'available',
                premiumAvailability: 'available',
            },
            {
                name: 'Import z Markdown',
                free: 'Dostępne',
                premium: 'Dostępne',
                freeAvailability: 'available',
                premiumAvailability: 'available',
            },
            {
                name: 'Upload zdjęcia własnego',
                free: 'Dostępne',
                premium: 'Wyższy limit przestrzeni',
                freeAvailability: 'available',
                premiumAvailability: 'text',
            },
        ],
    },
    {
        name: 'Plan i zakupy',
        features: [
            {
                name: 'Mój plan (limit pozycji)',
                free: '3 pozycje',
                premium: '50 pozycji',
                freeAvailability: 'text',
                premiumAvailability: 'text',
            },
            {
                name: 'Lista zakupów (podstawowa)',
                free: 'Dostępne',
                premium: 'Dostępne',
                freeAvailability: 'available',
                premiumAvailability: 'available',
            },
            {
                name: 'Zaawansowane scalanie jednostek',
                free: 'Niedostępne',
                premium: 'Dostępne',
                freeAvailability: 'unavailable',
                premiumAvailability: 'available',
                comingSoon: true,
            },
            {
                name: 'Planer tygodniowy',
                free: 'Niedostępne',
                premium: 'Dostępne',
                freeAvailability: 'unavailable',
                premiumAvailability: 'available',
                comingSoon: true,
            },
            {
                name: 'Konto rodzinne',
                free: 'Niedostępne',
                premium: 'Dostępne',
                freeAvailability: 'unavailable',
                premiumAvailability: 'available',
                comingSoon: true,
            },
        ],
    },
    {
        name: 'Komfort i reklamy',
        features: [
            {
                name: 'Reklamy w katalogu',
                free: 'Tak (po starcie reklam)',
                premium: 'Brak reklam',
                freeAvailability: 'text',
                premiumAvailability: 'text',
            },
            {
                name: 'Priorytet zadań AI',
                free: 'Standardowy',
                premium: 'Podwyższony',
                freeAvailability: 'text',
                premiumAvailability: 'text',
            },
        ],
    },
] as const;

export const PRICING_FAQ = [
    {
        question: 'Jak działa 7-dniowy trial?',
        answer: 'Przez 7 dni od aktywacji konta Premium masz pełny dostęp do funkcji Premium. Aktywacja trialu wymaga podania metody płatności — karta nie zostaje obciążona przed upływem okresu próbnego.',
    },
    {
        question: 'Co się dzieje po zakończeniu trialu?',
        answer: 'Jeśli anulujesz trial przed jego końcem, konto wraca do planu Free i karta nie jest obciążana. Jeśli go nie anulujesz, po 7 dniach pobierana jest opłata za wybrany plan. Przepisy i dane zostają na koncie.',
    },
    {
        question: 'Czy mogę anulować subskrypcję w dowolnym momencie?',
        answer: 'Tak. Anulowanie zatrzymuje przyszłe odnowienia, a dostęp do Premium zostaje do końca bieżącego okresu. Anulowanie zgłaszasz do nas — adres jest w regulaminie subskrypcji.',
    },
    {
        question: 'Jakie metody płatności są dostępne?',
        answer: 'Kartą płatniczą lub BLIK-iem. Kartą — subskrypcja odnawia się automatycznie; BLIK-iem płacisz jednorazowo za wybrany okres.',
    },
    {
        question: 'Czy mogę zmienić plan z miesięcznego na roczny?',
        answer: 'Zmiana planu miesięcznego na roczny albo rocznego na miesięczny obowiązuje od następnego okresu rozliczeniowego. Szczegóły opisuje regulamin subskrypcji.',
    },
] as const;
