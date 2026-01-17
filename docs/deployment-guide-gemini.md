# Przewodnik wdrożenia nowej wersji aplikacji na produkcję z API Gemini

## Spis treści
1. [Przegląd procesu](#przegląd-procesu)
2. [Wymagania wstępne](#wymagania-wstępne)
3. [Konfiguracja klucza API Gemini](#konfiguracja-klucza-api-gemini)
4. [Proces wdrożenia przez GitHub](#proces-wdrożenia-przez-github)
5. [Weryfikacja wdrożenia](#weryfikacja-wdrożenia)
6. [Rozwiązywanie problemów](#rozwiązywanie-problemów)
7. [Koszty i limity](#koszty-i-limity)

---

## Przegląd procesu

Aplikacja PychaŚwiatowa wykorzystuje automatyczny proces CI/CD oparty na GitHub Actions. Wdrożenie nowej wersji na produkcję odbywa się automatycznie po każdym `push` do gałęzi `main` i składa się z trzech głównych etapów:

1. **Testy jednostkowe** (`test`)
2. **Wdrożenie backendu** (Supabase Edge Functions + migracje bazy danych)
3. **Wdrożenie frontendu** (Firebase Hosting)

Aplikacja używa obecnie dwóch kluczy API do usług AI:
- **OpenAI API** (`OPENAI_API_KEY`) - do generowania draftów przepisów i obrazów (tryb `recipe_only`)
- **Gemini API** (`GEMINI_API_KEY`) - do generowania obrazów w trybie `with_reference` (z obrazem referencyjnym)

---

## Wymagania wstępne

### 1. Dostęp do Google AI Studio i klucz API Gemini

Aby wygenerować klucz API Gemini:

1. Przejdź do [Google AI Studio](https://aistudio.google.com/)
2. Zaloguj się kontem Google
3. Kliknij **"Get API key"** w menu lub przejdź do sekcji **API keys**
4. Utwórz nowy klucz API lub użyj istniejącego
5. Skopiuj klucz (format: `AIza...`)

**Uwaga:** Klucz API Gemini jest darmowy w określonych limitach (patrz sekcja [Koszty i limity](#koszty-i-limity)).

### 2. Dostęp do repozytorium GitHub

Musisz posiadać:
- Dostęp administracyjny do repozytorium `pychaswiatowa` na GitHub
- Uprawnienia do zarządzania GitHub Secrets

### 3. Dostęp do projektu Supabase

Musisz posiadać:
- Dostęp do projektu Supabase w środowisku produkcyjnym
- Uprawnienia do zarządzania secrets (zmienne środowiskowe)

---

## Konfiguracja klucza API Gemini

### Opcja A: Konfiguracja przez GitHub Secrets (ZALECANA)

GitHub Actions automatycznie ustawi klucz Gemini jako secret w Supabase podczas wdrożenia, jeśli dodasz go do GitHub Secrets.

#### Krok 1: Dodaj klucz do GitHub Secrets

1. Przejdź do repozytorium na GitHub
2. Kliknij **Settings** → **Secrets and variables** → **Actions**
3. Kliknij **New repository secret**
4. Jako **Name** wpisz: `GEMINI_API_KEY`
5. Jako **Secret** wklej skopiowany klucz API Gemini (np. `AIza...`)
6. Kliknij **Add secret**

#### Krok 2: Zaktualizuj workflow GitHub Actions

Plik `.github/workflows/main-deploy.yml` musi zostać zaktualizowany, aby przekazać klucz Gemini do Supabase.

**Obecna wersja (linia 56-60):**
```yaml
- name: Set Edge Function secrets
  run: |
    supabase secrets set APP_PUBLIC_URL=${{ secrets.APP_PUBLIC_URL }}
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

**Nowa wersja (z kluczem Gemini i OpenAI):**
```yaml
- name: Set Edge Function secrets
  run: |
    supabase secrets set \
      APP_PUBLIC_URL=${{ secrets.APP_PUBLIC_URL }} \
      OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }} \
      GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

**Uwaga:** W tej metodzie klucze są ustawiane za każdym razem podczas wdrożenia, co gwarantuje ich aktualność.

### Opcja B: Konfiguracja bezpośrednio w Supabase CLI

Jeśli preferujesz ustawić klucz ręcznie (jednorazowo):

#### Krok 1: Zainstaluj Supabase CLI

```bash
# Windows (PowerShell)
scoop install supabase

# macOS/Linux
brew install supabase/tap/supabase
```

#### Krok 2: Zaloguj się i połącz z projektem

```bash
# Zaloguj się do Supabase
supabase login

# Połącz z projektem produkcyjnym
supabase link --project-ref <TWOJ_PROJECT_ID>
```

**Uwaga:** `<TWOJ_PROJECT_ID>` znajdziesz w GitHub Secrets jako `SUPABASE_PROJECT_ID`.

#### Krok 3: Ustaw klucz API Gemini

```bash
supabase secrets set GEMINI_API_KEY=AIza...
```

#### Krok 4: Sprawdź ustawione sekrety

```bash
supabase secrets list
```

Powinieneś zobaczyć:
```
APP_PUBLIC_URL
OPENAI_API_KEY
GEMINI_API_KEY
```

**Uwaga:** Opcja B wymaga ręcznej aktualizacji przy każdej zmianie klucza. Zalecamy **Opcję A** dla środowiska produkcyjnego.

---

## Proces wdrożenia przez GitHub

### Automatyczne wdrożenie (standard)

Gdy masz już skonfigurowane wszystkie GitHub Secrets (w tym `GEMINI_API_KEY`), proces wdrożenia jest w pełni automatyczny:

#### Krok 1: Commit i push do gałęzi `main`

```bash
# Upewnij się, że jesteś na gałęzi main
git checkout main

# Dodaj zmiany (jeśli są)
git add .
git commit -m "feat: add Gemini API integration for image generation"

# Wyślij na GitHub
git push origin main
```

#### Krok 2: Monitoruj workflow na GitHub

1. Przejdź do repozytorium na GitHub
2. Kliknij zakładkę **Actions**
3. Znajdź najnowszy workflow **"Deploy to Production"**
4. Kliknij na niego, aby zobaczyć szczegóły

Workflow składa się z trzech jobów:
- **🧪 Run Unit Tests** (~2-3 min)
- **🚀 Deploy Backend (Supabase)** (~3-5 min)
- **🌐 Deploy Frontend (Firebase)** (~5-7 min)

Całkowity czas: **~10-15 minut**

#### Krok 3: Sprawdź logi

W przypadku błędów sprawdź logi poszczególnych kroków:

**Przykładowy sukces:**
```
✅ Unit tests passed
✅ Database migrations applied
✅ Edge Functions deployed (ai, categories, collections, ...)
✅ Frontend deployed to Firebase
```

**Przykładowy błąd:**
```
❌ Error: Failed to set secrets
```

W przypadku błędu przejdź do sekcji [Rozwiązywanie problemów](#rozwiązywanie-problemów).

---

## Weryfikacja wdrożenia

### 1. Sprawdź sekrety w Supabase

Upewnij się, że klucz Gemini został poprawnie ustawiony:

```bash
# Połącz z projektem produkcyjnym
supabase link --project-ref <TWOJ_PROJECT_ID>

# Sprawdź listę sekretów
supabase secrets list
```

Powinieneś zobaczyć:
```
APP_PUBLIC_URL
OPENAI_API_KEY
GEMINI_API_KEY  ← Nowy klucz
```

### 2. Testuj funkcję generowania obrazów AI

#### a) Test w aplikacji (jako użytkownik premium)

1. Zaloguj się do aplikacji produkcyjnej
2. Otwórz edycję przepisu, który ma już zdjęcie
3. Kliknij przycisk **AI** obok pola zdjęcia
4. System powinien automatycznie wybrać tryb **"z referencją zdjęcia"** (używa Gemini)
5. Po kliknięciu **"Generuj"** poczekaj ~30-90 sekund
6. Powinieneś zobaczyć nowe zdjęcie w modalu podglądu

#### b) Test przez API (curl)

```bash
# Pobierz JWT token użytkownika premium z aplikacji
# (Otwórz DevTools → Application → Local Storage → token)

export JWT_TOKEN="eyJhbGc..."
export SUPABASE_URL="https://twoj-project.supabase.co"

# Test generowania obrazu bez referencji (OpenAI - recipe_only)
curl -X POST "$SUPABASE_URL/functions/v1/ai/recipes/image" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipe": {
      "id": 123,
      "name": "Sernik klasyczny",
      "description": "Kremowy sernik",
      "ingredients": [{"type": "item", "content": "500g twaróg"}],
      "steps": [{"type": "item", "content": "Wymieszać składniki"}],
      "tags": ["deser"]
    },
    "mode": "recipe_only",
    "language": "pl",
    "output_format": "pycha_recipe_image_v1"
  }'
```

Oczekiwany wynik (sukces):
```json
{
  "image": {
    "mime_type": "image/webp",
    "data_base64": "UklGRiQAAABXRUJQ..."
  },
  "meta": {
    "mode": "recipe_only",
    "style_contract": { ... }
  }
}
```

### 3. Sprawdź logi Edge Functions

```bash
# Loguj się do Supabase Dashboard
# Przejdź do: Edge Functions → ai → Logs

# Lub przez CLI:
supabase functions logs ai
```

Szukaj wpisów:
```
[INFO] Generating image with Gemini (image-to-image)
[INFO] Gemini API payload
[INFO] Recipe image generated successfully (Gemini)
```

---

## Rozwiązywanie problemów

### Problem 1: `Gemini API key not configured`

**Objaw:**
```json
{
  "error": "Gemini AI service is not configured"
}
```

**Rozwiązanie:**
1. Sprawdź, czy klucz został dodany do GitHub Secrets:
   - GitHub → Settings → Secrets → `GEMINI_API_KEY`
2. Sprawdź, czy workflow został zaktualizowany (krok `Set Edge Function secrets`)
3. Uruchom workflow ponownie (GitHub Actions → Re-run all jobs)
4. Jeśli to nie pomoże, ustaw klucz ręcznie:
   ```bash
   supabase secrets set GEMINI_API_KEY=AIza...
   ```

### Problem 2: `Gemini API rate limit exceeded`

**Objaw:**
```json
{
  "error": "Gemini AI service rate limit exceeded. Please try again later."
}
```

**Rozwiązanie:**
1. Google AI Studio ma darmowe limity:
   - **1500 zapytań dziennie** (Gemini 1.5 Flash)
   - **50 zapytań dziennie** (Gemini 1.5 Pro)
2. Sprawdź aktualny model w `ai.service.ts` (linia 591):
   ```typescript
   const GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview";
   ```
3. Jeśli przekroczono limity, poczekaj do następnego dnia lub rozważ płatny plan Google Cloud

### Problem 3: `Gemini API timeout`

**Objaw:**
```json
{
  "error": "Gemini AI service request timed out"
}
```

**Rozwiązanie:**
1. Gemini ma timeout 90 sekund (3x dłuższy niż OpenAI)
2. Sprawdź logi Supabase:
   ```bash
   supabase functions logs ai --tail
   ```
3. Jeśli timeout występuje często, zwiększ wartość `GEMINI_API_TIMEOUT_MS` w `ai.service.ts` (linia 596)
4. Lub zmień model na szybszy (np. `gemini-2.0-flash-exp`)

### Problem 4: Workflow GitHub Actions nie uruchomił się

**Objawy:**
- Brak nowego workflow w zakładce Actions
- Workflow oznaczony jako "Skipped"

**Rozwiązanie:**
1. Sprawdź, czy push był do gałęzi `main`:
   ```bash
   git branch
   # Powinna być * main
   ```
2. Sprawdź, czy workflow nie jest zablokowany:
   - GitHub → Settings → Actions → General → **"Allow all actions"**
3. Sprawdź logi commitów:
   ```bash
   git log --oneline -5
   ```
4. Uruchom workflow ręcznie:
   - GitHub → Actions → Deploy to Production → **"Run workflow"**

### Problem 5: Workflow zakończył się błędem w kroku `Set Edge Function secrets`

**Objaw:**
```
Error: Failed to set secrets
supabase secrets set: command not found
```

**Rozwiązanie:**
1. Sprawdź, czy krok `Setup Supabase CLI` wykonał się poprawnie
2. Sprawdź, czy `SUPABASE_ACCESS_TOKEN` jest poprawny w GitHub Secrets
3. Upewnij się, że format komendy jest poprawny (patrz sekcja [Opcja A](#opcja-a-konfiguracja-przez-github-secrets-zalecana))

### Problem 6: Frontend wdrożył się, ale zmiany nie są widoczne

**Objawy:**
- Workflow zakończył się sukcesem
- Aplikacja nadal działa ze starą wersją

**Rozwiązanie:**
1. Wyczyść cache przeglądarki (Ctrl+Shift+Del)
2. Otwórz aplikację w trybie incognito
3. Sprawdź, czy Firebase prawidłowo wdrożył nową wersję:
   - Firebase Console → Hosting → Release history
4. Jeśli problem się utrzymuje, sprawdź logi deployment:
   ```
   GitHub Actions → Deploy Frontend → Deploy to Firebase Hosting
   ```

---

## Koszty i limity

### Gemini API (Google AI Studio)

**Plan darmowy:**
- **Gemini 1.5 Flash:** 1500 zapytań dziennie (RPD)
- **Gemini 1.5 Pro:** 50 zapytań dziennie (RPD)
- **Gemini 2.0 Flash:** 1500 zapytań dziennie (RPD)
- Limit: 15 zapytań na minutę (RPM)

**Uwaga:** Model `gemini-3-pro-image-preview` używany w aplikacji może być eksperymentalny i mieć inne limity. Monitoruj limity w [Google AI Studio Dashboard](https://aistudio.google.com/app/apikey).

**Plan płatny (Google Cloud):**
- Przejdź na [Google Cloud Vertex AI](https://cloud.google.com/vertex-ai/pricing)
- Ceny: ~$0.00025 za 1000 znaków wejścia (dla Gemini 1.5 Flash)
- Generacja obrazów: ceny zależą od modelu

### OpenAI API

**Koszty (aktualne na styczeń 2026):**
- **GPT-4o-mini** (draft generation): ~$0.15 za 1M tokenów wejścia, $0.60 za 1M tokenów wyjścia
- **GPT-Image-1.5** (image generation): ~$0.04 za obraz 1024×1024 w formacie WebP

**Zalecenia:**
1. Ustaw limity budżetowe w [OpenAI Dashboard](https://platform.openai.com/settings/organization/billing/limits)
2. Monitoruj użycie w [Usage Dashboard](https://platform.openai.com/usage)
3. Rozważ implementację rate limiting po stronie aplikacji (np. max 10 generacji obrazów na użytkownika dziennie)

### Supabase

**Edge Functions:**
- Free tier: **500,000 wywołań miesięcznie**
- Pro tier ($25/mies): **2,000,000 wywołań miesięcznie**

Monitoruj użycie w [Supabase Dashboard → Settings → Usage](https://supabase.com/dashboard/project/_/settings/usage).

### Firebase Hosting

**Plan Spark (darmowy):**
- 10 GB transferu miesięcznie
- 360 MB/dzień

**Plan Blaze (pay-as-you-go):**
- $0.15 za GB transferu powyżej limitu

Aplikacja Angular po zbudowaniu (~2-5 MB) mieści się w darmowym limicie dla małego/średniego ruchu.

---

## Podsumowanie kroków wdrożenia

### Konfiguracja jednorazowa (przed pierwszym wdrożeniem z Gemini):

1. ✅ Wygeneruj klucz API Gemini w [Google AI Studio](https://aistudio.google.com/)
2. ✅ Dodaj `GEMINI_API_KEY` do GitHub Secrets
3. ✅ Zaktualizuj workflow `.github/workflows/main-deploy.yml` (dodaj klucz Gemini do kroku `Set Edge Function secrets`)
4. ✅ Commit i push zmiany workflow do gałęzi `main`

### Wdrożenie każdej kolejnej wersji (automatyczne):

1. ✅ Commit i push do gałęzi `main`
2. ✅ GitHub Actions automatycznie uruchamia workflow "Deploy to Production"
3. ✅ Monitoruj status w zakładce Actions
4. ✅ Po zakończeniu (sukces) zweryfikuj działanie funkcji AI w aplikacji

**Czas całkowity:** ~10-15 minut (automatycznie)

---

## Dodatkowe zasoby

### Dokumentacja projektu
- [PRD (Product Requirements Document)](./results/main-project-docs/004%20prd.md)
- [API Plan](./results/main-project-docs/009%20API%20plan.md)
- [Tech Stack](./results/main-project-docs/006%20Tech%20Stack.md)
- [ENV Setup](../ENV_SETUP.md)

### Dokumentacja zewnętrzna
- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Google AI Studio](https://aistudio.google.com/app/apikey)
- [OpenAI API Documentation](https://platform.openai.com/docs)

### Kontakt w przypadku problemów

W przypadku poważnych problemów technicznych:
1. Sprawdź logi Supabase: `supabase functions logs ai --tail`
2. Sprawdź status GitHub Actions w zakładce Actions
3. Skontaktuj się z zespołem DevOps (jeśli dotyczy)

---

**Wersja dokumentu:** 1.0  
**Data ostatniej aktualizacji:** 2026-01-17  
**Autor:** AI Assistant
