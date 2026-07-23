# Historia konfiguracji środowiska testowego - PychaŚwiatowa

> **To jest log historyczny (append-only), nie instrukcja "jak skonfigurować środowisko dziś".**
> Każdy wpis opisuje stan konfiguracji z konkretnej daty. Bieżące instrukcje uruchamiania testów znajdziesz w [automated-testing-guide.md](./automated-testing-guide.md) i [README.md](./README.md).
> Przy kolejnych większych zmianach konfiguracji środowiska testowego (nowe narzędzie, zmiana progów coverage, nowy runner itd.) dopisz nową, datowaną sekcję na końcu tego pliku - nie nadpisuj poniższego wpisu.

---

## 8 grudnia 2025 - Wstępna konfiguracja Vitest + Playwright

### Wykonane kroki

#### 1. Instalacja zależności

##### Vitest (testy jednostkowe)
```bash
npm install --save-dev @analogjs/vite-plugin-angular @analogjs/vitest-angular @angular/platform-browser-dynamic @testing-library/angular @testing-library/user-event @vitest/ui zone.js --legacy-peer-deps
```

##### Playwright (testy E2E)
```bash
npm install --save-dev @playwright/test --legacy-peer-deps
npx playwright install chromium
```

#### 2. Utworzone pliki konfiguracyjne

##### Vitest
- **vitest.config.ts** - główna konfiguracja Vitest
  - Environment: jsdom
  - Pool: forks z singleFork
  - Coverage: V8 provider z progami 70%
  - Aliasy: `@` dla `/src`, `@shared` dla `/shared`

- **test-setup.ts** - plik setup dla testów Angular
  - Inicjalizacja Zone.js
  - Konfiguracja TestBed

##### Playwright
- **playwright.config.ts** - konfiguracja testów E2E
  - Tylko Chromium/Desktop Chrome (zgodnie z wytycznymi)
  - Timeout: 30s
  - Retries: 2 w CI, 0 lokalnie
  - Auto-start serwera deweloperskiego
  - Trace i screenshots przy niepowodzeniach

#### 3. Struktura katalogów

```
pychaswiatowa/
├── e2e/                              # Katalog testów E2E
│   ├── login.spec.ts                 # Przykładowy test strony logowania
│   ├── fixtures.ts                   # Fixtures i helpery dla Playwright
│   └── README.md                     # Dokumentacja testów E2E
├── src/app/
│   ├── app.spec.ts                   # Test głównego komponentu (zaktualizowany)
│   └── core/services/
│       └── auth.service.spec.ts      # Przykładowy test serwisu
├── docs/
│   ├── testing-guide.md              # Kompletny przewodnik po testowaniu
│   └── testing-setup-summary.md      # Ten plik
├── vitest.config.ts                  # Konfiguracja Vitest
├── test-setup.ts                     # Setup testów jednostkowych
├── playwright.config.ts              # Konfiguracja Playwright
└── package.json                      # Zaktualizowane skrypty

```

> Uwaga: powyższa struktura odzwierciedla stan z 8 grudnia 2025. Dokumentacja testowa została od tego czasu przeniesiona do `docs/testing/`.

#### 4. Dodane skrypty do package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report",
    "test:all": "npm run test:run && npm run test:e2e"
  }
}
```

#### 5. Przykładowe testy

##### Test jednostkowy komponentu (app.spec.ts)
- ✅ Zaktualizowany do Vitest
- ✅ Inicjalizacja TestBed w beforeAll
- ✅ Test tworzenia komponentu

##### Test jednostkowy serwisu (auth.service.spec.ts)
- ✅ 7 testów obejmujących wszystkie metody
- ✅ Mockowanie SupabaseService
- ✅ Testowanie ścieżek sukcesu i błędów
- ✅ Wszystkie testy przechodzą

##### Test E2E (login.spec.ts)
- ✅ Page Object Model
- ✅ Testy formularza logowania
- ✅ Walidacja pól
- ✅ Testy responsywności
- ✅ Fixtures dla zalogowanych użytkowników

#### 6. Dokumentacja

##### testing-guide.md
Kompletny przewodnik zawierający:
- Wprowadzenie do strategii testowania
- Szczegółowe instrukcje testowania serwisów
- Szczegółowe instrukcje testowania komponentów
- Przykłady kodu
- Mockowanie i asercje
- Debugowanie
- Coverage i CI/CD
- Najlepsze praktyki

##### e2e/README.md
Dokumentacja testów E2E:
- Struktura testów
- Uruchamianie testów
- Konfiguracja zmiennych środowiskowych
- Page Object Model
- Fixtures
- Konwencje i wskazówki
- Debugowanie

#### 7. Aktualizacja .gitignore

Dodane wpisy:
```
# Test results
/test-results
/playwright-report
/blob-report
/.nyc_output
/coverage
*.lcov
```

### Weryfikacja

#### Testy jednostkowe
```bash
✓ app.spec.ts - Test tworzenia komponentu przechodzi
✓ auth.service.spec.ts - Wszystkie 7 testów przechodzi
  - signUp() - 2 testy
  - signIn() - 2 testy
  - signOut() - 2 testy
  - getSession() - 1 test
```

#### Struktura testów E2E
✓ Konfiguracja Playwright gotowa
✓ Przykładowy test login.spec.ts utworzony
✓ Fixtures dla zalogowanych użytkowników
✓ Dokumentacja README

### Komendy do uruchomienia testów

#### Testy jednostkowe
```bash
# Uruchom wszystkie testy
npm run test

# Uruchom w trybie watch
npm run test:watch

# UI mode (wizualna nawigacja)
npm run test:ui

# Pokrycie kodu
npm run test:coverage

# Konkretny plik
npm run test -- src/app/core/services/auth.service.spec.ts
```

#### Testy E2E
```bash
# Uruchom wszystkie testy E2E
npm run test:e2e

# Tryb UI (interaktywny)
npm run test:e2e:ui

# Tryb debug
npm run test:e2e:debug

# Pokaż raport
npm run test:e2e:report
```

#### Wszystkie testy
```bash
npm run test:all
```

### Zmienne środowiskowe dla testów E2E

Utwórz plik `.env.local` w głównym katalogu projektu:

```bash
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
BASE_URL=http://localhost:4200
```

### Progi pokrycia kodu

Skonfigurowane w `vitest.config.ts`:
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

### Zgodność z wytycznymi

#### Vitest ✓
- ✅ Wykorzystuje `vi` do mocków
- ✅ Plik setupu (test-setup.ts) z konfiguracją
- ✅ Coverage z V8 provider
- ✅ Environment: jsdom dla testów DOM
- ✅ Pool: forks z singleFork dla stabilności Angular
- ✅ Importy Zone.js w testach
- ✅ Inicjalizacja TestBed w beforeAll
- ✅ NoopAnimationsModule dla komponentów Material

#### Playwright ✓
- ✅ Tylko Chromium/Desktop Chrome
- ✅ Browser contexts dla izolacji
- ✅ Page Object Model
- ✅ Resilient locators (role-based)
- ✅ Trace viewer przy niepowodzeniach
- ✅ Test hooks (beforeEach, afterEach)
- ✅ Parallel execution (gdy możliwe)

### Następne kroki (zaplanowane w tamtym momencie)

1. **Utworzenie testów dla istniejących komponentów i serwisów**
   - Stopniowe dodawanie testów jednostkowych
   - Priorytet: krytyczne serwisy i komponenty

2. **Rozszerzenie testów E2E**
   - Test rejestracji użytkownika
   - Test CRUD przepisów
   - Test CRUD kolekcji
   - Test wyszukiwania

3. **Konfiguracja CI/CD**
   - GitHub Actions workflow
   - Automatyczne uruchamianie testów
   - Generowanie raportów pokrycia

4. **Zmienne środowiskowe w CI**
   - Konfiguracja GitHub Secrets
   - Użytkownik testowy w bazie danych

5. **Pre-commit hooks**
   - Husky do uruchamiania testów przed commitem
   - Lint-staged dla formatowania

### Zasoby

- [Dokumentacja Vitest](https://vitest.dev/)
- [Dokumentacja Playwright](https://playwright.dev/)
- [Angular Testing Guide](https://angular.dev/guide/testing)
- [Testing Best Practices](https://testingjavascript.com/)

### Uwagi

- Używana flaga `--legacy-peer-deps` przy instalacji z powodu różnic w wersjach Angular
- Zone.js musiało być zainstalowane osobno jako devDependency
- Wszystkie testy przechodzą pomyślnie
- Środowisko gotowe do pisania nowych testów

### Status na dzień 8 grudnia 2025

🟢 **GOTOWE** - Środowisko testowe w pełni skonfigurowane i zweryfikowane
