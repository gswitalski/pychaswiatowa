import { test as base, type Page } from '@playwright/test';

/**
 * Fixtures dla testów Playwright w projekcie PychaŚwiatowa
 * Fixtures umożliwiają współdzielenie wspólnej konfiguracji i funkcjonalności między testami
 */

// Typ dla zalogowanej strony
type AuthenticatedPage = {
    authenticatedPage: Page;
};

/**
 * Fixture dla zalogowanej strony
 * Automatycznie loguje użytkownika przed każdym testem
 */
export const test = base.extend<AuthenticatedPage>({
    authenticatedPage: async ({ page }, use) => {
        // Setup: Logowanie użytkownika
        const email = process.env.TEST_USER_EMAIL || 'test@example.com';
        const password = process.env.TEST_USER_PASSWORD || 'password123';

        await page.goto('/login');
        await page.getByRole('textbox', { name: /email/i }).fill(email);
        await page.getByLabel(/hasło/i).fill(password);
        await page.getByRole('button', { name: /zaloguj/i }).click();

        // Oczekiwanie na przekierowanie do dashboard
        await page.waitForURL(/\/dashboard/, { timeout: 10000 });

        // Użycie zalogowanej strony w teście
        await use(page);

        // Teardown: Wylogowanie po teście
        // Możesz dodać opcjonalne czyszczenie sesji
    },
});

export { expect } from '@playwright/test';

/**
 * Helper do tworzenia losowych danych testowych
 */
export const generateTestData = {
    email: () => `test-${Date.now()}@example.com`,
    password: () => `Pass${Date.now()}!`,
    recipeName: () => `Test Recipe ${Date.now()}`,
    collectionName: () => `Test Collection ${Date.now()}`,
};

