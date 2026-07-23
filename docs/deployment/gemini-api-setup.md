# Konfiguracja Gemini API – PychaŚwiatowa

## Przegląd

Aplikacja wykorzystuje **Gemini API** (Google) do generowania obrazów przepisów w trybie **"z referencją zdjęcia"** (image-to-image). Gdy przepis ma już istniejące zdjęcie, system używa Gemini zamiast OpenAI, aby wygenerować nowy obraz na podstawie referencji.

**Model:** `gemini-3-pro-image-preview`
**Tryb:** `with_reference` (image-to-image)

OpenAI nadal obsługuje:
- Generowanie draftów przepisów (GPT-4o-mini)
- Generowanie obrazów bez referencji – tryb `recipe_only` (GPT-Image-1.5)

---

## Konfiguracja jednorazowa

### Krok 1: Uzyskaj klucz API Gemini

1. Przejdź do [Google AI Studio](https://aistudio.google.com/)
2. Zaloguj się kontem Google
3. Kliknij **"Get API key"** → sekcja **API keys**
4. Utwórz nowy klucz lub użyj istniejącego
5. Skopiuj klucz (format: `AIza...`)

**Uwaga:** Klucz jest darmowy w określonych limitach (patrz sekcja [Koszty i limity](#koszty-i-limity)).

### Krok 2: Dodaj klucz do GitHub Secrets

1. GitHub → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Name: `GEMINI_API_KEY`
4. Secret: wklej klucz `AIza...`
5. **Add secret**

> Szczegóły zarządzania sekretami: [secrets-management.md](./secrets-management.md)

### Krok 3: Zaktualizuj workflow (jeśli jeszcze nie zaktualizowany)

W pliku `.github/workflows/main-deploy.yml` upewnij się, że krok "Set Edge Function secrets" zawiera `GEMINI_API_KEY`:

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

### Krok 4: Commit i push

```bash
git add .github/workflows/main-deploy.yml
git commit -m "ci: add Gemini API key to deployment workflow"
git push origin main
```

Pipeline automatycznie wdroży zmiany i ustawi sekret w Supabase.

---

## Weryfikacja po wdrożeniu

### 1. Sprawdź sekrety w Supabase

```bash
supabase link --project-ref <PROJECT_ID>
supabase secrets list
```

Oczekiwany wynik:
```
APP_PUBLIC_URL
OPENAI_API_KEY
GEMINI_API_KEY  ← powinien być widoczny
```

### 2. Test w aplikacji (użytkownik premium)

**Scenariusz A: Generowanie bez referencji (OpenAI)**
1. Otwórz edycję przepisu **bez zdjęcia**
2. Kliknij przycisk **AI** obok pola zdjęcia
3. System wybiera tryb: "Generuj z przepisu"
4. Kliknij **"Generuj"** → poczekaj ~30-60s
5. ✅ Nowe zdjęcie wygenerowane

**Scenariusz B: Generowanie z referencją (Gemini)**
1. Otwórz edycję przepisu **z istniejącym zdjęciem**
2. Kliknij przycisk **AI** obok pola zdjęcia
3. System wybiera tryb: "Generuj z referencją zdjęcia"
4. Kliknij **"Generuj"** → poczekaj ~60-90s
5. ✅ Nowe zdjęcie wygenerowane (inna kompozycja niż referencja)

### 3. Test przez API (curl)

```bash
export JWT_TOKEN="eyJhbGc..."  # Token z DevTools → Application → Local Storage
export SUPABASE_URL="https://twoj-project.supabase.co"

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

Oczekiwana odpowiedź:
```json
{
  "image": {
    "mime_type": "image/webp",
    "data_base64": "UklGR..."
  },
  "meta": {
    "mode": "recipe_only",
    "style_contract": { ... }
  }
}
```

### 4. Sprawdź logi Edge Functions

```bash
supabase functions logs ai --limit 50
```

Szukaj:
- ✅ `[INFO] Generating image with Gemini (image-to-image)`
- ✅ `[INFO] Gemini API payload`
- ✅ `[INFO] Recipe image generated successfully (Gemini)`

Nie powinno być:
- ❌ `Gemini API key not configured`
- ❌ `Gemini API rate limit exceeded`

---

## Koszty i limity

### Gemini API (Google AI Studio) – plan darmowy

| Model | Limit dzienny (RPD) | Limit minutowy (RPM) |
|-------|---------------------|---------------------|
| Gemini 1.5 Flash | 1500 zapytań | 15 / min |
| Gemini 1.5 Pro | 50 zapytań | 2 / min |
| Gemini 2.0 Flash | 1500 zapytań | 15 / min |

**Uwaga:** Model `gemini-3-pro-image-preview` (używany w aplikacji) może mieć inne limity – monitoruj w [Google AI Studio Dashboard](https://aistudio.google.com/app/apikey).

### Gemini API – plan płatny (Google Cloud Vertex AI)

- [Cennik Vertex AI](https://cloud.google.com/vertex-ai/pricing)
- ~$0.00025 za 1000 znaków wejścia (Gemini 1.5 Flash)
- Generacja obrazów: ceny zależą od modelu

### OpenAI API (dla porównania)

| Usługa | Koszt |
|--------|-------|
| GPT-4o-mini (draft generation) | ~$0.15 / 1M tokenów IN, $0.60 / 1M tokenów OUT |
| GPT-Image-1.5 (image generation) | ~$0.04 / obraz 1024×1024 WebP |

**Zalecenia:**
- Ustaw limity budżetowe w [OpenAI Dashboard](https://platform.openai.com/settings/organization/billing/limits)
- Monitoruj użycie w [Usage Dashboard](https://platform.openai.com/usage)
- Rozważ rate limiting po stronie aplikacji (np. max 10 generacji / użytkownik / dzień)

---

## Troubleshooting

### `Gemini API key not configured`

```json
{"error": "Gemini AI service is not configured"}
```

**Rozwiązanie:**
1. Sprawdź GitHub Secrets → czy `GEMINI_API_KEY` istnieje
2. Sprawdź workflow → czy krok `Set Edge Function secrets` zawiera `GEMINI_API_KEY`
3. Re-run workflow: GitHub → Actions → Re-run all jobs
4. (Fallback) Ustaw ręcznie:
   ```bash
   supabase secrets set GEMINI_API_KEY=AIza...
   ```

### `Gemini API rate limit exceeded`

```json
{"error": "Gemini AI service rate limit exceeded. Please try again later."}
```

**Rozwiązanie:**
1. Sprawdź aktualny limit w [Google AI Studio Dashboard](https://aistudio.google.com/app/apikey)
2. Poczekaj do następnego dnia (limit się resetuje)
3. (Opcjonalnie) Przejdź na płatny plan Google Cloud
4. (Opcjonalnie) Zmień model w kodzie na szybszy (np. `gemini-2.0-flash-exp`)

### `Gemini API timeout`

```json
{"error": "Gemini AI service request timed out"}
```

**Rozwiązanie:**
1. Gemini ma timeout 90s (3x dłuższy niż OpenAI)
2. Sprawdź logi: `supabase functions logs ai --tail`
3. Jeśli timeout częsty → zwiększ `GEMINI_API_TIMEOUT_MS` w `ai.service.ts`
4. Lub zmień model na szybszy

---

## Checklista weryfikacyjna

### Przed wdrożeniem
- [ ] Klucz API Gemini uzyskany z Google AI Studio
- [ ] `GEMINI_API_KEY` dodany do GitHub Secrets
- [ ] Workflow `.github/workflows/main-deploy.yml` zaktualizowany
- [ ] (Opcjonalnie) Limity budżetowe ustawione w Google Cloud

### Po wdrożeniu
- [ ] `GEMINI_API_KEY` widoczny w `supabase secrets list`
- [ ] Test: generowanie obrazu bez referencji (OpenAI) – ✅ działa
- [ ] Test: generowanie obrazu z referencją (Gemini) – ✅ działa
- [ ] Brak błędów w logach Edge Functions
- [ ] Test regresji: draft przepisu, wyszukiwanie, CRUD przepisów

### Monitoring (7 dni)
- [ ] Użycie API Gemini (Google AI Studio Dashboard)
- [ ] Koszty OpenAI (OpenAI Usage Dashboard)
- [ ] Wywołania Edge Functions (Supabase Dashboard)

---

**Powiązane dokumenty:**
- [Zarządzanie sekretami](./secrets-management.md) – pełna lista sekretów
- [CI/CD Pipeline](./ci-cd-pipeline.md) – jak działa automatyczne wdrożenie
- [Konfiguracja środowiska](../configuration/environment-setup.md) – konfiguracja zmiennych środowiskowych lokalnie

---

**Ostatnia aktualizacja:** 2026-07-21
