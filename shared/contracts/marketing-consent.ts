/**
 * Single source of truth for the marketing consent text version used by signup UI flow.
 * Backend SQL allowlist must stay aligned with this value.
 */
export const MARKETING_CONSENT_TEXT_VERSION = 'marketing-consent-pl-v1' as const;

/** All consent text versions currently accepted in application contracts. */
export const MARKETING_CONSENT_TEXT_VERSIONS = [
    MARKETING_CONSENT_TEXT_VERSION,
] as const;

export type MarketingConsentTextVersion =
    (typeof MARKETING_CONSENT_TEXT_VERSIONS)[number];
