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
            // 169 zł / rok vs 12 × 24 zł = 288 zł → oszczędność ok. 41%.
            savingsPercent: 41,
        },
    },
    limits: {
        free: {
            // Musi odpowiadać domyślnej wartości PLAN_LIMIT_FREE w supabase/functions/plan/plan.types.ts.
            planItems: 7,
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
        'Miesięczna pula kredytów AI (tekst, link, zdjęcia)',
        'Generowanie zdjęć przepisów przez AI',
        `Mój plan do ${PRICING_CONFIG.limits.premium.planItems} pozycji`,
        'Brak reklam w katalogu',
    ],
} as const;

export const PRICING_FEATURE_CATEGORIES: readonly PricingFeatureCategory[] = [
    {
        name: 'AI i import',
        features: [
            {
                name: 'Asysta AI (draft przepisu z tekstu)',
                free: `${PRICING_CONFIG.limits.free.aiImportsLifetime} importy łącznie`,
                premium: 'Miesięczna pula kredytów',
                freeAvailability: 'text',
                premiumAvailability: 'text',
            },
            {
                name: 'Import ze zdjęć / skanu (do 5 zdjęć)',
                free: 'W puli importów próbnych',
                premium: 'Z miesięcznej puli kredytów',
                freeAvailability: 'text',
                premiumAvailability: 'text',
            },
            {
                name: 'Import z linku (URL)',
                free: 'W puli importów próbnych',
                premium: 'Z miesięcznej puli kredytów',
                freeAvailability: 'text',
                premiumAvailability: 'text',
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
                premium: 'Dostępne',
                freeAvailability: 'available',
                premiumAvailability: 'available',
            },
        ],
    },
    {
        name: 'Plan i zakupy',
        features: [
            {
                name: 'Mój plan (limit pozycji)',
                free: `${PRICING_CONFIG.limits.free.planItems} pozycji`,
                premium: `${PRICING_CONFIG.limits.premium.planItems} pozycji`,
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
                comingSoon: true,
            },
        ],
    },
] as const;

export const PRICING_FAQ = [
    {
        question: 'Czy mogę anulować subskrypcję w dowolnym momencie?',
        answer: 'Tak. Anulowanie zatrzymuje przyszłe odnowienia, a dostęp do Premium zostaje do końca bieżącego okresu. Anulowanie zgłaszasz do nas — adres jest w regulaminie subskrypcji.',
    },
    {
        question: 'Jakie metody płatności są dostępne?',
        answer: 'Kartą płatniczą. Subskrypcja odnawia się automatycznie na kolejny okres rozliczeniowy.',
    },
    {
        question: 'Czy mogę zmienić plan z miesięcznego na roczny?',
        answer: 'Zmiana planu miesięcznego na roczny albo rocznego na miesięczny obowiązuje od następnego okresu rozliczeniowego. Szczegóły opisuje regulamin subskrypcji.',
    },
] as const;
