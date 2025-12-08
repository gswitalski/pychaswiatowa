# Testy E2E - PychaŚwiatowa

Ten katalog zawiera testy end-to-end (E2E) dla aplikacji PychaŚwiatowa, zaimplementowane przy użyciu Playwright.

## Struktura

```
e2e/
├── login.spec.ts         # Testy strony logowania
├── fixtures.ts           # Współdzielone fixtures i helpery
├── .env.example          # Przykładowy plik środowiskowy
└── README.md            # Ta dokumentacja
```

## Uruchamianie testów

### Wszystkie testy
```bash
npm run test:e2e
```

### Testy w trybie UI (interaktywnym)
```bash
npm run test:e2e:ui
```

### Testy w trybie debug
```bash
npm run test:e2e:debug
```

### Wyświetlenie raportu z ostatnich testów
```bash
npm run test:e2e:report
```

## Konfiguracja

### Zmienne środowiskowe

Utwórz plik `.env.local` w katalogu głównym projektu:

```bash
cp e2e/.env.example .env.local
```

Następnie wypełnij go danymi użytkownika testowego:

```
TEST_USER_EMAIL=twoj-email-testowy@example.com
TEST_USER_PASSWORD=twoje-haslo-testowe
```

## Konwencje testów

### Page Object Model (POM)

Testy wykorzystują wzorzec Page Object Model dla lepszej organizacji i ponownego wykorzystania kodu:

```typescript
class LoginPage {
    constructor(private page: Page) {}

    get emailInput() {
        return this.page.getByRole('textbox', { name: /email/i });
    }

    async login(email: string, password: string) {
        await this.emailInput.fill(email);
        await this.passwordInput.fill(password);
        await this.submitButton.click();
    }
}
```

### Fixtures

Wykorzystaj fixtures do współdzielenia konfiguracji między testami:

```typescript
import { test, expect } from './fixtures';

test('test z zalogowanym użytkownikiem', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard');
    // ... test z zalogowanym użytkownikiem
});
```

### Lokatory

Preferuj lokatory oparte na rolach i dostępności (accessibility):

```typescript
// ✅ Dobre
page.getByRole('button', { name: /zaloguj/i })
page.getByLabel(/hasło/i)
page.getByText(/witaj/i)

// ❌ Unikaj
page.locator('#login-button')
page.locator('.password-input')
```

## Struktura testów

Każdy plik testowy powinien:

1. **Grupować testy** w describe blocks
2. **Używać Page Objects** dla powtarzalnych interakcji
3. **Testować zarówno happy paths jak i edge cases**
4. **Być niezależnym** od innych testów
5. **Czyscić po sobie** (teardown)

## Wskazówki

### Oczekiwanie na elementy

Playwright automatycznie czeka na elementy, ale możesz dostosować timeout:

```typescript
await expect(element).toBeVisible({ timeout: 5000 });
```

### Screenshots i traces

Screenshots i traces są automatycznie zapisywane przy niepowodzeniu testu w katalogu `test-results/`.

### Testy responsywne

Testuj różne rozmiary ekranów:

```typescript
test('mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // ... test
});
```

## Debugowanie

### Visual Debugger

```bash
npm run test:e2e:debug
```

### Codegen - nagrywanie testów

```bash
npx playwright codegen http://localhost:4200
```

### Trace Viewer

Po niepowodzeniu testu, otwórz trace:

```bash
npx playwright show-trace test-results/login-spec-test-1/trace.zip
```

## CI/CD

Testy E2E są automatycznie uruchamiane w pipeline CI/CD. W środowisku CI:
- Używane jest tylko 1 worker (testy sekwencyjne)
- 2 próby w przypadku niepowodzenia
- Automatyczne generowanie raportów HTML

## Dodawanie nowych testów

1. Utwórz nowy plik `nazwa-strony.spec.ts`
2. Zdefiniuj Page Object dla testowanej strony
3. Napisz testy używając wzorca Arrange-Act-Assert
4. Upewnij się, że testy są niezależne i czyszczą po sobie

Przykład:

```typescript
import { test, expect } from '@playwright/test';

class DashboardPage {
    constructor(private page: Page) {}
    
    async navigate() {
        await this.page.goto('/dashboard');
    }
    
    // ... więcej metod
}

test.describe('Dashboard', () => {
    test('should display user name', async ({ page }) => {
        const dashboard = new DashboardPage(page);
        await dashboard.navigate();
        // ... asercje
    });
});
```

## Przydatne linki

- [Dokumentacja Playwright](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Test Generator](https://playwright.dev/docs/codegen)

