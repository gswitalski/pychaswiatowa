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

// TODO: Po wdrożeniu checkout zastąpić wywołaniem GET /pricing/plans.
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
            planItems: 7,
            aiImportsLifetime: 3,
        },
        premium: {
            planItems: 50,
        },
    },
} as const;

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
                free: '7 pozycji',
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
        answer: 'Przez 7 dni od rejestracji konta Premium masz pełny dostęp do funkcji Premium. Trial aktywuje się automatycznie — nie wymagamy danych karty z góry.',
    },
    {
        question: 'Co się dzieje po zakończeniu trialu?',
        answer: 'Jeśli nie subskrybujesz, konto wraca do planu Free. Twoje przepisy i dane są bezpieczne — nie usuwamy żadnych danych.',
    },
    {
        question: 'Czy mogę anulować subskrypcję w dowolnym momencie?',
        answer: 'Tak. Możesz anulować w ustawieniach konta w dowolnej chwili. Dostęp do Premium obowiązuje do końca opłaconego okresu.',
    },
    {
        question: 'Jakie metody płatności są dostępne?',
        answer: 'BLIK, karta płatnicza oraz przelewy. Szczegóły podamy po wdrożeniu checkout.',
    },
    {
        question: 'Czy mogę zmienić plan z miesięcznego na roczny?',
        answer: 'Tak — w ustawieniach konta, ze zmianą od następnego okresu rozliczeniowego.',
    },
] as const;
