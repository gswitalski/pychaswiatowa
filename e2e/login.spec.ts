import { test, expect, type Page } from '@playwright/test';

/**
 * Przykładowy test E2E dla strony logowania
 * Zgodnie z wytycznymi Playwright dla projektu PychaŚwiatowa
 */

// Page Object Model dla strony logowania
class LoginPage {
    constructor(private page: Page) {}

    // Lokatory
    get emailInput() {
        return this.page.getByRole('textbox', { name: /email/i });
    }

    get passwordInput() {
        return this.page.getByLabel(/hasło/i);
    }

    get submitButton() {
        return this.page.getByRole('button', { name: /zaloguj/i });
    }

    get errorMessage() {
        return this.page.getByRole('alert');
    }

    // Akcje
    async navigate() {
        await this.page.goto('/login');
    }

    async fillLoginForm(email: string, password: string) {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
    }

    async submitForm() {
        await this.submitButton.click();
    }

    async login(email: string, password: string) {
        await this.fillLoginForm(email, password);
        await this.submitForm();
    }
}

test.describe('Strona logowania', () => {
    let loginPage: LoginPage;

    test.beforeEach(async ({ page }) => {
        loginPage = new LoginPage(page);
        await loginPage.navigate();
    });

    test('powinna wyświetlić formularz logowania', async ({ page }) => {
        // Sprawdzenie podstawowych elementów strony
        await expect(page.getByRole('heading', { name: /logowanie/i })).toBeVisible();
        await expect(loginPage.emailInput).toBeVisible();
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.submitButton).toBeVisible();
    });

    test('powinna walidować puste pole email', async ({ page }) => {
        // Próba wysłania formularza bez wypełnienia pól
        await loginPage.submitButton.click();

        // Sprawdzenie walidacji HTML5
        const emailInputElement = await loginPage.emailInput.elementHandle();
        const isValid = await emailInputElement?.evaluate(
            (input: HTMLInputElement) => input.validity.valid
        );

        expect(isValid).toBe(false);
    });

    test('powinna walidować nieprawidłowy format email', async ({ page }) => {
        // Wypełnienie pola email nieprawidłowym formatem
        await loginPage.emailInput.fill('nieprawidlowy-email');
        await loginPage.passwordInput.fill('password123');
        await loginPage.submitButton.click();

        // Sprawdzenie walidacji HTML5
        const emailInputElement = await loginPage.emailInput.elementHandle();
        const isValid = await emailInputElement?.evaluate(
            (input: HTMLInputElement) => input.validity.valid
        );

        expect(isValid).toBe(false);
    });

    test('powinna pokazać błąd dla nieprawidłowych danych logowania', async () => {
        // Próba logowania z nieprawidłowymi danymi
        await loginPage.login('test@example.com', 'wrongpassword');

        // Oczekiwanie na komunikat o błędzie
        await expect(loginPage.errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('powinna przekierować do dashboard po udanym logowaniu', async ({ page }) => {
        // UWAGA: Ten test wymaga istniejącego użytkownika testowego w bazie danych
        // W środowisku CI/CD należy przygotować dane testowe lub użyć API do utworzenia użytkownika

        // Pomiń test jeśli nie ma zmiennych środowiskowych z danymi testowymi
        test.skip(!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
            'Wymagane zmienne środowiskowe TEST_USER_EMAIL i TEST_USER_PASSWORD');

        const testEmail = process.env.TEST_USER_EMAIL as string;
        const testPassword = process.env.TEST_USER_PASSWORD as string;

        await loginPage.login(testEmail, testPassword);

        // Oczekiwanie na przekierowanie do dashboard
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

        // Sprawdzenie czy użytkownik jest zalogowany
        await expect(page.getByText(/witaj/i)).toBeVisible();
    });

    test('powinna przełączyć widoczność hasła po kliknięciu ikony', async ({ page }) => {
        // Sprawdzenie czy hasło jest początkowo ukryte
        await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

        // Znalezienie i kliknięcie przycisku pokazującego hasło
        const toggleButton = page.getByRole('button', { name: /pokaż hasło|ukryj hasło/i });
        if (await toggleButton.count() > 0) {
            await toggleButton.click();

            // Sprawdzenie czy hasło jest teraz widoczne
            await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
        }
    });

    test('powinna zawierać link do strony rejestracji', async ({ page }) => {
        const registerLink = page.getByRole('link', { name: /zarejestruj/i });
        await expect(registerLink).toBeVisible();
        await expect(registerLink).toHaveAttribute('href', /register/);
    });
});

// Test grupy dla responsywności
test.describe('Responsywność strony logowania', () => {
    test('powinna być responsywna na urządzeniach mobilnych', async ({ page }) => {
        // Ustawienie rozmiaru ekranu na urządzenie mobilne
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/login');

        // Sprawdzenie czy elementy są widoczne i użyteczne na małym ekranie
        const loginPage = new LoginPage(page);
        await expect(loginPage.emailInput).toBeVisible();
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.submitButton).toBeVisible();
    });

    test('powinna być responsywna na tabletach', async ({ page }) => {
        // Ustawienie rozmiaru ekranu na tablet
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/login');

        // Sprawdzenie czy elementy są widoczne
        const loginPage = new LoginPage(page);
        await expect(loginPage.emailInput).toBeVisible();
        await expect(loginPage.submitButton).toBeVisible();
    });
});

