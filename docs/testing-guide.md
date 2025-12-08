# Przewodnik po testowaniu - PychaŚwiatowa

## Spis treści

1. [Wprowadzenie](#wprowadzenie)
2. [Testy jednostkowe (Vitest)](#testy-jednostkowe-vitest)
3. [Testy E2E (Playwright)](#testy-e2e-playwright)
4. [Uruchamianie testów](#uruchamianie-testów)
5. [Pisanie testów](#pisanie-testów)
6. [CI/CD](#cicd)

## Wprowadzenie

Projekt PychaŚwiatowa wykorzystuje wielopoziomową strategię testowania opartą na Piramidzie Testów:

- **Testy jednostkowe (Vitest)**: Testowanie pojedynczych komponentów i serwisów w izolacji
- **Testy E2E (Playwright)**: Testowanie całej aplikacji z perspektywy użytkownika

## Testy jednostkowe (Vitest)

### Konfiguracja

Konfiguracja testów znajduje się w pliku `vitest.config.ts`. Główne ustawienia:

- **Environment**: `jsdom` - symuluje środowisko przeglądarki
- **Setup file**: `test-setup.ts` - inicjalizacja Angular TestBed
- **Coverage**: V8 provider z progami pokrycia 70%

### Struktura testu

Każdy test powinien następować wzorca **Arrange-Act-Assert**:

```typescript
import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

describe('MyService', () => {
    let service: MyService;
    let mockDependency: any;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        mockDependency = { method: vi.fn() };

        await TestBed.configureTestingModule({
            providers: [
                MyService,
                { provide: Dependency, useValue: mockDependency },
            ],
        }).compileComponents();

        service = TestBed.inject(MyService);
        vi.clearAllMocks();
    });

    it('should do something', async () => {
        // Arrange
        mockDependency.method.mockReturnValue('result');

        // Act
        const result = await service.doSomething();

        // Assert
        expect(result).toBe('result');
        expect(mockDependency.method).toHaveBeenCalledTimes(1);
    });
});
```

### Testowanie serwisów

#### Mockowanie zależności

```typescript
const mockHttpClient = {
    get: vi.fn(),
    post: vi.fn(),
};

await TestBed.configureTestingModule({
    providers: [
        MyService,
        { provide: HttpClient, useValue: mockHttpClient },
    ],
}).compileComponents();
```

#### Testowanie Observable

Używaj `firstValueFrom` z RxJS:

```typescript
import { firstValueFrom } from 'rxjs';

it('should return data', async () => {
    mockHttpClient.get.mockReturnValue(of({ data: 'test' }));
    
    const result = await firstValueFrom(service.getData());
    
    expect(result).toEqual({ data: 'test' });
});
```

#### Testowanie błędów

```typescript
import { throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

it('should handle errors', async () => {
    const httpError = new HttpErrorResponse({ status: 500 });
    mockHttpClient.get.mockReturnValue(throwError(() => httpError));
    
    await expect(() => firstValueFrom(service.getData()))
        .rejects.toMatchObject({ status: 500 });
});
```

### Testowanie komponentów

#### Podstawowy test komponentu

```typescript
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('MyComponent', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MyComponent, NoopAnimationsModule],
        }).compileComponents();
    });

    it('should create', () => {
        const fixture = TestBed.createComponent(MyComponent);
        const component = fixture.componentInstance;
        
        expect(component).toBeTruthy();
    });
});
```

#### Testowanie interakcji użytkownika

```typescript
it('should handle button click', () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    button.click();
    fixture.detectChanges();

    expect(component.someProperty).toBe(true);
});
```

#### Testowanie komponentów z Angular Material

```typescript
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

beforeEach(async () => {
    const mockDialogRef = { close: vi.fn() };
    const mockData = { id: 1, name: 'Test' };

    await TestBed.configureTestingModule({
        imports: [MyDialogComponent, NoopAnimationsModule],
        providers: [
            { provide: MatDialogRef, useValue: mockDialogRef },
            { provide: MAT_DIALOG_DATA, useValue: mockData },
        ],
    }).compileComponents();
});
```

### Uruchamianie testów jednostkowych

```bash
# Uruchom wszystkie testy jednostkowe
npm run test

# Tryb watch - automatyczne uruchamianie po zmianach
npm run test:watch

# UI mode - wizualna nawigacja po testach
npm run test:ui

# Pokrycie kodu
npm run test:coverage

# Uruchom konkretny plik testowy
npm run test src/app/core/services/auth.service.spec.ts
```

## Testy E2E (Playwright)

### Konfiguracja

Konfiguracja testów znajduje się w pliku `playwright.config.ts`. Testy znajdują się w katalogu `e2e/`.

Szczegółowa dokumentacja: [e2e/README.md](../e2e/README.md)

### Uruchamianie testów E2E

```bash
# Uruchom wszystkie testy E2E
npm run test:e2e

# Tryb UI - interaktywny
npm run test:e2e:ui

# Tryb debug
npm run test:e2e:debug

# Pokaż raport
npm run test:e2e:report
```

### Zmienne środowiskowe dla testów E2E

Utwórz plik `.env.local` w głównym katalogu:

```bash
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
BASE_URL=http://localhost:4200
```

## Uruchamianie testów

### Wszystkie testy

```bash
# Jednostkowe + E2E
npm run test:all
```

### Tylko jednostkowe

```bash
npm run test:run
```

### Tylko E2E

```bash
npm run test:e2e
```

## Pisanie testów

### Konwencje nazewnictwa

- Pliki testowe: `*.spec.ts`
- Lokalizacja: obok testowanego pliku (dla testów jednostkowych)
- E2E: katalog `e2e/`

### Struktura describe blocks

```typescript
describe('FeatureName', () => {
    describe('methodName()', () => {
        it('should do something in normal case', () => {});
        it('should handle error case', () => {});
        it('should handle edge case', () => {});
    });
});
```

### Co testować

#### Testy jednostkowe

✅ **Testuj:**
- Logikę biznesową
- Ścieżki sukcesu i błędów
- Przypadki brzegowe
- Transformacje danych
- Warunki i rozgałęzienia

❌ **Nie testuj:**
- Kodu frameworka/bibliotek
- Trywialnych getterów/setterów
- Szczegółów implementacji CSS

#### Testy E2E

✅ **Testuj:**
- Krytyczne ścieżki użytkownika (user flows)
- Integrację między komponentami
- Formularze i walidację
- Nawigację
- Responsywność

❌ **Nie testuj:**
- Każdego detalu (pokrywa to jednostkowe)
- Logiki biznesowej (pokrywają to jednostkowe)

## Wskazówki

### Mockowanie

Używaj `vi.fn()` dla prostych mocków:

```typescript
const mockFunction = vi.fn();
mockFunction.mockReturnValue('value');
mockFunction.mockResolvedValue('async value');
mockFunction.mockRejectedValue(new Error('error'));
```

### Asercje

```typescript
// Vitest
expect(value).toBe(expectedValue);
expect(value).toEqual(expectedObject);
expect(array).toHaveLength(3);
expect(fn).toHaveBeenCalledWith(arg1, arg2);
expect(fn).toHaveBeenCalledTimes(1);

// Playwright
await expect(element).toBeVisible();
await expect(element).toHaveText('text');
await expect(page).toHaveURL(/pattern/);
```

### Debugowanie

#### Vitest

```typescript
// Dodaj console.log w teście
console.log(component.someProperty);

// Użyj debuggera
debugger;
```

#### Playwright

```bash
# Uruchom z debuggerem
npm run test:e2e:debug

# Zobacz trace po niepowodzeniu
npx playwright show-trace test-results/path/trace.zip
```

## Coverage (pokrycie kodu)

### Uruchomienie

```bash
npm run test:coverage
```

### Progi pokrycia

Skonfigurowane w `vitest.config.ts`:

- Linie: 70%
- Funkcje: 70%
- Branches: 70%
- Statements: 70%

### Raport

Po uruchomieniu `test:coverage`, raport HTML jest dostępny w `coverage/index.html`.

## CI/CD

Testy są automatycznie uruchamiane w pipeline GitHub Actions przy każdym push i pull request.

### Pipeline testowy

1. Instalacja zależności
2. Uruchomienie testów jednostkowych (Vitest)
3. Uruchomienie testów E2E (Playwright)
4. Generowanie raportów pokrycia
5. Publikacja wyników

### Wymagania dla PR

- ✅ Wszystkie testy jednostkowe muszą przechodzić
- ✅ Wszystkie testy E2E muszą przechodzić
- ✅ Pokrycie kodu musi przekraczać progi (70%)
- ✅ Brak błędów lintera

## Najlepsze praktyki

1. **Pisz testy najpierw** (TDD) tam gdzie to możliwe
2. **Jeden test = jeden koncept** - testuj jedną rzecz na raz
3. **Arrange-Act-Assert** - jasna struktura testu
4. **Mockuj zależności** - izoluj testowaną jednostkę
5. **Testuj ścieżki błędów** - nie tylko happy path
6. **Używaj opisowych nazw** - test powinien dokumentować zachowanie
7. **Testy niezależne** - każdy test działa w izolacji
8. **Czyść po sobie** - używaj afterEach do czyszczenia

## Przydatne linki

- [Dokumentacja Vitest](https://vitest.dev/)
- [Dokumentacja Playwright](https://playwright.dev/)
- [Angular Testing Guide](https://angular.dev/guide/testing)
- [Testing Library](https://testing-library.com/)

## Pomoc i wsparcie

Jeśli napotkasz problemy z testami:

1. Sprawdź logi testów z flagą `--reporter=verbose`
2. Uruchom pojedynczy test w trybie debug
3. Sprawdź coverage aby zobaczyć co nie jest pokryte
4. Przeczytaj `.cursor/rules/vitest.mdc` i `.cursor/rules/playwright.mdc` dla szczegółowych wytycznych

