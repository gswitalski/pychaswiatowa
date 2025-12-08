# 🧪 Testowanie - PychaŚwiatowa

Środowisko testowe jest w pełni skonfigurowane i gotowe do użycia!

## 🚀 Szybki start

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

## 📝 Konfiguracja zmiennych środowiskowych dla E2E

Utwórz plik `.env.local` w głównym katalogu projektu:

```bash
# .env.local
TEST_USER_EMAIL=twoj-email-testowy@example.com
TEST_USER_PASSWORD=twoje-haslo-testowe
BASE_URL=http://localhost:4200
```

## 📚 Dokumentacja

- **[docs/testing-guide.md](docs/testing-guide.md)** - Kompletny przewodnik po testowaniu
- **[e2e/README.md](e2e/README.md)** - Szczegóły testów E2E
- **[docs/testing-setup-summary.md](docs/testing-setup-summary.md)** - Podsumowanie konfiguracji

## ✅ Status środowiska

- ✅ Vitest skonfigurowany i przetestowany
- ✅ Playwright skonfigurowany (Chromium)
- ✅ Przykładowe testy jednostkowe działają (8/8 testów przechodzi)
- ✅ Przykładowe testy E2E utworzone
- ✅ Coverage skonfigurowane (progi: 70%)
- ✅ Dokumentacja kompletna

## 📊 Przykładowe testy

### Testy jednostkowe
- ✅ `src/app/app.spec.ts` - test komponentu głównego
- ✅ `src/app/core/services/auth.service.spec.ts` - test serwisu (7 testów)

### Testy E2E
- ✅ `e2e/login.spec.ts` - test strony logowania z Page Object Model

## 🎯 Następne kroki

1. Dodaj testy dla swoich komponentów i serwisów
2. Rozszerz testy E2E o kluczowe ścieżki użytkownika
3. Konfiguruj CI/CD do automatycznego uruchamiania testów

## 💡 Wskazówki

- Testy jednostkowe powinny być umieszczone obok testowanych plików (`.spec.ts`)
- Testy E2E powinny być w katalogu `e2e/`
- Używaj Page Object Model dla testów E2E
- Mockuj zewnętrzne zależności w testach jednostkowych
- Pisz testy według wzorca Arrange-Act-Assert

## 🔍 Pokrycie kodu

Po uruchomieniu `npm run test:coverage`, raport będzie dostępny w:
- Console (podsumowanie)
- `coverage/index.html` (szczegółowy raport HTML)

Progi pokrycia:
- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

## 🆘 Pomoc

Jeśli napotkasz problemy:
1. Sprawdź dokumentację w `docs/testing-guide.md`
2. Uruchom test w trybie verbose: `npm run test -- --reporter=verbose`
3. Dla testów E2E użyj trybu debug: `npm run test:e2e:debug`

---

Więcej informacji w [docs/testing-guide.md](docs/testing-guide.md)

