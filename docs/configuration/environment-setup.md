# Konfiguracja zmiennych środowiskowych dla testów

## Dla testów E2E

Utwórz plik `.env.local` w głównym katalogu projektu:

```bash
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123
BASE_URL=http://localhost:4200
```

### Jak utworzyć plik .env.local

#### Windows (PowerShell)
```powershell
New-Item -Path .env.local -ItemType File
notepad .env.local
```

#### Linux/Mac
```bash
touch .env.local
nano .env.local
```

Następnie wklej powyższe zmienne i zapisz plik.

## Dla Supabase Edge Functions

### Zmienne wymagane dla AI Services

Funkcje AI wymagają kluczy API do generowania draftów przepisów i obrazów:
- **OpenAI API** - dla generowania draftów przepisów i normalizacji składników
- **Gemini API** - dla generowania obrazów w obu trybach (`recipe_only` i `with_reference`)

#### Środowisko lokalne

Utwórz plik `supabase/.env.local` z następującą zawartością:

```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
GEMINI_API_KEY=AIza-your-gemini-api-key-here
```

Następnie uruchom funkcję z flagą `--env-file`:

```bash
supabase functions serve ai --env-file ./supabase/.env.local
```

#### Środowisko produkcyjne (Supabase Cloud)

Ustaw sekrety przez CLI:

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here
supabase secrets set GEMINI_API_KEY=AIza-your-gemini-api-key-here
```

Sprawdź ustawione sekrety:

```bash
supabase secrets list
```

### Jak uzyskać klucze API

#### OpenAI API

1. Zarejestruj się na [platform.openai.com](https://platform.openai.com)
2. Przejdź do **API Keys** → **Create new secret key**
3. Skopiuj wygenerowany klucz (zaczyna się od `sk-`)
4. Ustaw go jako zmienną środowiskową zgodnie z powyższymi instrukcjami

#### Gemini API

1. Przejdź do [Google AI Studio](https://aistudio.google.com/)
2. Zaloguj się kontem Google
3. Kliknij **"Get API key"** w menu lub przejdź do sekcji **API keys**
4. Utwórz nowy klucz API lub użyj istniejącego
5. Skopiuj klucz (zaczyna się od `AIza`)
6. Ustaw go jako zmienną środowiskową zgodnie z powyższymi instrukcjami

### Limity i koszty

#### AI Recipe Draft (`/ai/recipes/draft`)
- Endpoint używa modelu `gpt-4o-mini` (ekonomiczny, szybki)
- Zalecany limit budżetu w OpenAI Dashboard
- Implementacja zawiera timeout 30s i obsługę rate limiting (429)

#### AI Recipe Image (`/ai/recipes/image`) - Premium Feature
- Endpoint używa Google Gemini `gemini-3-pro-image-preview` w obu trybach:
  - **`recipe_only`**: generacja z tekstu przepisu
  - **`with_reference`**: generacja z obrazem referencyjnym
- **UWAGA**: Generacja obrazów jest droższa niż generacja tekstu
- Koszty Gemini: darmowy plan obejmuje ~50-1500 zapytań dziennie (zależnie od modelu)
- Implementacja zawiera timeout 90s i obsługę rate limiting (429)
- Dostępne tylko dla użytkowników z `app_role: premium` lub `admin`
- Zwraca obraz w formacie zwróconym przez Gemini (PNG, JPEG lub WebP), base64

## Uwagi

- Plik `.env.local` jest ignorowany przez git (jest w .gitignore)
- Plik `supabase/.env.local` również powinien być w .gitignore
- Nie commituj plików z rzeczywistymi kluczami API
- Dla testów lokalnych możesz użyć konta testowego z bazy danych development
- Dla CI/CD użyj GitHub Secrets do przechowywania tych wartości

## Lokalna weryfikacja Supabase

Porty projektu są niestandardowe i wynikają z `supabase/config.toml`:

- API: `54331`
- PostgreSQL: `54332`
- Studio: `54333`
- Mailpit: `54334`

Przed implementacją backendu sprawdź:

```powershell
deno --version
supabase --version
docker version
supabase status
```

Do sprawdzania migracji lokalnych używaj `supabase migration list --local`;
bez `--local` CLI może odpytać zdalny projekt. Po problemach z uruchomieniem
Docker Desktop zatrzymaj nieużywane stacki Supabase. Logi Edge Functions
czytaj przede wszystkim poleceniem:

```powershell
docker logs supabase_edge_runtime_pychaswiatowa
```

Smoke test funkcji powinien wywołać
`http://localhost:54331/functions/v1/{funkcja}`. Oczekiwane `401` lub inne
`4xx` z kodu funkcji oznacza, że worker wystartował; `500`,
`InvalidWorkerResponse` albo brak odpowiedzi oznacza błąd.
