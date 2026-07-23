# Testowanie - PychaŚwiatowa

Ten folder zawiera całą dokumentację testową projektu. Poniżej mapa dokumentów - zacznij od tego, czego akurat potrzebujesz.

## Mapa dokumentacji

| Chcę... | Dokument |
| --- | --- |
| Szybko uruchomić testy (komendy) | ten plik, sekcja "Szybki start" poniżej |
| Nauczyć się pisać/uruchamiać testy jednostkowe i E2E, poznać konwencje | [automated-testing-guide.md](./automated-testing-guide.md) |
| Zrozumieć strategię testów projektu (zakres, poziomy, środowiska, kryteria, harmonogram, ryzyka) | [strategy.md](./strategy.md) |
| Sprawdzić historię konfiguracji środowiska testowego | [setup-history.md](./setup-history.md) |
| Wykonać manualny/smoke test konkretnego endpointu lub funkcji | [manual/README.md](./manual/README.md) |

## Szybki start

### Testy jednostkowe (Vitest)

```bash
# Uruchom wszystkie testy
npm run test

# Tryb watch - automatyczne uruchamianie po zmianach
npm run test:watch

# UI mode - wizualna nawigacja
npm run test:ui

# Pokrycie kodu
npm run test:coverage
```

### Testy E2E (Playwright)

```bash
# Uruchom wszystkie testy E2E
npm run test:e2e

# Tryb UI - interaktywny
npm run test:e2e:ui

# Tryb debug
npm run test:e2e:debug

# Pokaż raport z ostatnich testów
npm run test:e2e:report
```

Szczegóły konwencji Playwright (Page Object Model, fixtures) znajdują się w [e2e/README.md](../../e2e/README.md).

### Konfiguracja zmiennych środowiskowych dla E2E

Utwórz plik `.env.local` w głównym katalogu projektu:

```bash
# .env.local
TEST_USER_EMAIL=twoj-email-testowy@example.com
TEST_USER_PASSWORD=twoje-haslo-testowe
BASE_URL=http://localhost:4200
```

Pełny przewodnik po pisaniu testów, mockowaniu, coverage i CI/CD: [automated-testing-guide.md](./automated-testing-guide.md).

## Dokumentacja testowa poza tym folderem

Część testów manualnych żyje bezpośrednio przy kodzie Edge Functions, aby były łatwe do znalezienia i aktualizacji razem z endpointem:

- [supabase/functions/plan/TESTING.md](../../supabase/functions/plan/TESTING.md) - testy manualne endpointów `/plan`
- [supabase/functions/ai/TESTING_TIPS.md](../../supabase/functions/ai/TESTING_TIPS.md) - testy AI draftu przepisu z polem `tips_raw`
- [supabase/functions/public/TESTING_TIPS.md](../../supabase/functions/public/TESTING_TIPS.md) - testy wyszukiwania po polu `tips`
- Skrypty smoke-testowe (PowerShell), uruchamiane lokalnie po `supabase start`:
  - [supabase/functions/public/scripts/README.md](../../supabase/functions/public/scripts/README.md)
  - [supabase/functions/shopping-list/scripts/README.md](../../supabase/functions/shopping-list/scripts/README.md)
  - [supabase/functions/internal/scripts/README.md](../../supabase/functions/internal/scripts/README.md)

## Status środowiska

- Vitest skonfigurowany i przetestowany
- Playwright skonfigurowany (Chromium)
- Coverage skonfigurowane (progi: 70%)

Przykładowe testy referencyjne:

- `src/app/app.spec.ts` - test komponentu głównego
- `src/app/core/services/auth.service.spec.ts` - test serwisu
- `e2e/login.spec.ts` - test strony logowania z Page Object Model

## Następne kroki

1. Dodaj testy dla swoich komponentów i serwisów
2. Rozszerz testy E2E o kluczowe ścieżki użytkownika
3. Nowy manualny test endpointu/feature -> dodaj plik w [manual/](./manual/) zamiast dokładania go na głównym poziomie tego folderu

## Pomoc

Jeśli napotkasz problemy:

1. Sprawdź [automated-testing-guide.md](./automated-testing-guide.md) (sekcja "Pomoc i wsparcie")
2. Uruchom test w trybie verbose: `npm run test -- --reporter=verbose`
3. Dla testów E2E użyj trybu debug: `npm run test:e2e:debug`
