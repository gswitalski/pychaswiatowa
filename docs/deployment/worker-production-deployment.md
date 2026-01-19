# Instrukcja Wdrożenia Workera Normalized Ingredients na Produkcję

## Spis treści
1. [Wymagania wstępne](#wymagania-wstępne)
2. [Krok 1: Wdrożenie migracji bazy danych](#krok-1-wdrożenie-migracji-bazy-danych)
3. [Krok 2: Wdrożenie Edge Function](#krok-2-wdrożenie-edge-function)
4. [Krok 3: Konfiguracja sekretów](#krok-3-konfiguracja-sekretów)
5. [Krok 4: Konfiguracja Supabase Cron](#krok-4-konfiguracja-supabase-cron)
6. [Krok 5: Testowanie](#krok-5-testowanie)
7. [Krok 6: Monitoring](#krok-6-monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Wymagania wstępne

✅ Upewnij się, że posiadasz:
- Dostęp do Supabase Dashboard projektu produkcyjnego
- Uprawnienia do wdrażania funkcji i wykonywania SQL
- Klucz API OpenAI (dla normalizacji składników)
- Zainstalowane Supabase CLI (wersja 1.x lub nowsza)
- Połączenie z projektem produkcyjnym: `supabase link --project-ref twoj-projekt-ref`

---

## Krok 1: Wdrożenie migracji bazy danych

### 1.1. Sprawdź status migracji

```bash
# Sprawdź które migracje są już zastosowane na produkcji
supabase db remote list
```

### 1.2. Zastosuj nowe migracje

Worker wymaga następujących migracji (w kolejności):

1. `20260118120000_add_normalized_ingredients_to_recipes.sql`
2. `20260118120100_create_normalized_ingredients_jobs_table.sql`
3. `20260118120200_create_enqueue_normalized_ingredients_refresh_rpc.sql`
4. `20260118120300_update_recipe_details_view_for_normalized_ingredients.sql`
5. `20260118120400_update_create_recipe_with_tags_for_normalized_ingredients.sql`
6. `20260118120500_update_update_recipe_with_tags_for_normalized_ingredients.sql`
7. **`20260118150000_add_retry_fields_to_normalized_ingredients_jobs.sql`** ← Nowa
8. **`20260118150100_create_claim_normalized_ingredients_jobs_rpc.sql`** ← Nowa

```bash
# Zastosuj wszystkie oczekujące migracje
supabase db push
```

### 1.3. Weryfikacja

Zaloguj się do Supabase Dashboard → SQL Editor i uruchom:

```sql
-- Sprawdź czy tabela jobów ma nowe pola
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'normalized_ingredients_jobs';

-- Powinieneś zobaczyć kolumnę: next_run_at (timestamp with time zone)

-- Sprawdź czy RPC istnieje
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'claim_normalized_ingredients_jobs';
```

---

## Krok 2: Wdrożenie Edge Function

### 2.1. Przygotowanie

Upewnij się, że masz wszystkie pliki workera:

```
supabase/functions/internal/
├── index.ts
├── internal.handlers.ts
└── normalized-ingredients-worker.service.ts
```

Oraz wspólny moduł:

```
supabase/functions/_shared/
└── normalized-ingredients.ts
```

### 2.2. Deploy funkcji

```bash
# Wdróż tylko funkcję internal
supabase functions deploy internal

# Lub wdróż wszystkie funkcje
supabase functions deploy
```

### 2.3. Weryfikacja

Po wdrożeniu powinieneś zobaczyć:

```
Deployed Function internal
URL: https://twoj-projekt.supabase.co/functions/v1/internal
```

---

## Krok 3: Konfiguracja sekretów

### 3.1. Generowanie bezpiecznego sekretu workera

W PowerShell lub terminalu (Linux/Mac):

**PowerShell:**
```powershell
# Generuj losowy sekret (32 bajty)
$bytes = New-Object Byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

**Bash/Linux/Mac:**
```bash
openssl rand -base64 32
```

Zapisz wygenerowany sekret - będziesz go potrzebować w następnych krokach.

### 3.2. Dodanie sekretów w Supabase Dashboard

1. Przejdź do **Project Settings** → **Edge Functions**
2. Kliknij zakładkę **Secrets**
3. Dodaj następujące sekrety:

| Nazwa sekretu | Wartość | Opis |
|---------------|---------|------|
| `INTERNAL_WORKER_SECRET` | `[wygenerowany sekret]` | Sekret do autoryzacji workera |
| `OPENAI_API_KEY` | `sk-proj-...` | Klucz API OpenAI |
| `NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE` | `10` | (Opcjonalne) Liczba jobów per run |

4. Kliknij **Save**

### 3.3. Restart funkcji

Po dodaniu sekretów, funkcje muszą się zrestartować (zwykle automatycznie w ciągu minuty).

---

## Krok 4: Konfiguracja Supabase Cron

### 4.1. Włącz rozszerzenie pg_cron (jeśli nie jest włączone)

W Supabase Dashboard → **Database** → **Extensions**:
1. Znajdź `pg_cron`
2. Kliknij **Enable**

### 4.2. Utwórz funkcję pomocniczą do przechowywania sekretu

Przejdź do **SQL Editor** i wykonaj:

```sql
-- Funkcja do bezpiecznego przechowywania sekretu workera
CREATE OR REPLACE FUNCTION get_internal_worker_secret()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- UWAGA: Zamień 'TWOJ-SEKRET-TUTAJ' na rzeczywisty sekret!
    -- To samo co w Edge Functions Secrets
    RETURN 'TWOJ-SEKRET-TUTAJ';
END;
$$;

-- Uprawnienia tylko dla postgres (cron)
REVOKE ALL ON FUNCTION get_internal_worker_secret() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_internal_worker_secret() TO postgres;
```

**⚠️ WAŻNE**: Zamień `'TWOJ-SEKRET-TUTAJ'` na ten sam sekret co w `INTERNAL_WORKER_SECRET`!

### 4.3. Utwórz Cron Job

W **SQL Editor** wykonaj:

```sql
-- Utwórz cron job uruchamiający worker co minutę
SELECT cron.schedule(
    'normalized-ingredients-worker',
    '* * * * *',  -- Co minutę
    $$
    SELECT
        net.http_post(
            url := 'https://TWOJ-PROJEKT.supabase.co/functions/v1/internal/workers/normalized-ingredients/run',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-internal-worker-secret', get_internal_worker_secret()
            ),
            timeout_milliseconds := 55000
        ) AS request_id;
    $$
);
```

**⚠️ WAŻNE**: Zamień `TWOJ-PROJEKT` na rzeczywisty ref projektu!

### 4.4. Weryfikacja cron job

```sql
-- Sprawdź czy job został utworzony
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    nodename
FROM cron.job
WHERE jobname = 'normalized-ingredients-worker';
```

Powinieneś zobaczyć 1 wiersz z `active = true`.

---

## Krok 5: Testowanie

### 5.1. Test ręczny workera

Możesz przetestować workera ręcznie przed uruchomieniem crona:

**PowerShell:**
```powershell
$secret = "TWOJ-SEKRET-TUTAJ"
$url = "https://TWOJ-PROJEKT.supabase.co/functions/v1/internal/workers/normalized-ingredients/run"

Invoke-RestMethod -Uri $url `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "x-internal-worker-secret" = $secret
  }
```

**curl:**
```bash
curl -X POST \
  https://TWOJ-PROJEKT.supabase.co/functions/v1/internal/workers/normalized-ingredients/run \
  -H "Content-Type: application/json" \
  -H "x-internal-worker-secret: TWOJ-SEKRET-TUTAJ"
```

**Oczekiwana odpowiedź:**
```json
{
  "processed": 0,
  "succeeded": 0,
  "failed": 0,
  "skipped": 0
}
```

### 5.2. Test z prawdziwym jobem

1. **Utwórz lub edytuj przepis** (przez aplikację frontendową)
2. **Wywołaj endpoint refresh** (automatycznie przez PUT /recipes/{id}):
   ```
   POST /recipes/{id}/normalized-ingredients/refresh
   ```
3. **Sprawdź czy job został utworzony:**

```sql
SELECT 
    id,
    recipe_id,
    status,
    attempts,
    next_run_at,
    created_at
FROM normalized_ingredients_jobs
ORDER BY created_at DESC
LIMIT 5;
```

4. **Poczekaj 1-2 minuty** (cron uruchomi workera)

5. **Sprawdź wynik:**

```sql
-- Sprawdź status joba
SELECT 
    id,
    recipe_id,
    status,
    attempts,
    last_error
FROM normalized_ingredients_jobs
WHERE recipe_id = <TWOJE_RECIPE_ID>;

-- Sprawdź znormalizowane składniki
SELECT 
    recipe_id,
    items,
    updated_at
FROM recipe_normalized_ingredients
WHERE recipe_id = <TWOJE_RECIPE_ID>;

-- Sprawdź status na przepisie
SELECT 
    id,
    name,
    normalized_ingredients_status,
    normalized_ingredients_updated_at
FROM recipes
WHERE id = <TWOJE_RECIPE_ID>;
```

---

## Krok 6: Monitoring

### 6.1. Monitorowanie logów funkcji

W Supabase Dashboard → **Edge Functions** → **internal** → **Logs**

Szukaj:
- ✅ `"Starting normalized ingredients worker run"`
- ✅ `"Jobs claimed: N"`
- ✅ `"Worker run completed"`
- ❌ Błędy: `"Worker handler error"`, `"Job processing failed"`

### 6.2. Monitorowanie kolejki jobów

Regularnie sprawdzaj:

```sql
-- Statystyki kolejki
SELECT 
    status,
    COUNT(*) as count,
    AVG(attempts) as avg_attempts,
    MAX(attempts) as max_attempts
FROM normalized_ingredients_jobs
GROUP BY status;

-- Joby "utknięte" (RUNNING > 5 minut)
SELECT 
    id,
    recipe_id,
    status,
    attempts,
    updated_at,
    AGE(now(), updated_at) as stuck_for
FROM normalized_ingredients_jobs
WHERE status = 'RUNNING'
  AND updated_at < now() - interval '5 minutes';

-- Joby FAILED (do analizy)
SELECT 
    id,
    recipe_id,
    attempts,
    last_error,
    updated_at
FROM normalized_ingredients_jobs
WHERE status = 'FAILED'
ORDER BY updated_at DESC
LIMIT 10;
```

### 6.3. Historia uruchomień crona

```sql
-- Ostatnie 20 uruchomień crona
SELECT 
    runid,
    jobid,
    status,
    return_message,
    start_time,
    end_time,
    (end_time - start_time) as duration
FROM cron.job_run_details
WHERE jobid = (
    SELECT jobid 
    FROM cron.job 
    WHERE jobname = 'normalized-ingredients-worker'
)
ORDER BY start_time DESC
LIMIT 20;
```

### 6.4. Alerty (opcjonalne)

Możesz skonfigurować alerty dla:
- **Duża liczba jobów FAILED** (> 10)
- **Cron nie uruchomił się** (brak wywołań > 5 minut)
- **Błędy w logach funkcji** (rate > 10%)

---

## Troubleshooting

### Problem: Worker zwraca 401 Unauthorized

**Przyczyna**: Nieprawidłowy sekret w cron job lub funkcji pomocniczej.

**Rozwiązanie:**
1. Sprawdź czy `get_internal_worker_secret()` zwraca poprawny sekret:
   ```sql
   SELECT get_internal_worker_secret(); -- Tylko postgres może to wywołać
   ```
2. Sprawdź czy `INTERNAL_WORKER_SECRET` w Edge Functions Secrets jest identyczny
3. Zrestartuj funkcję (zmień dowolny sekret i zapisz, potem przywróć)

---

### Problem: Cron nie uruchamia workera

**Przyczyna**: Cron job nieaktywny lub błędny URL.

**Rozwiązanie:**
1. Sprawdź status crona:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'normalized-ingredients-worker';
   ```
2. Sprawdź logi:
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'normalized-ingredients-worker')
   ORDER BY start_time DESC LIMIT 5;
   ```
3. Jeśli `status = 'failed'`, sprawdź `return_message`
4. Zweryfikuj URL w definicji crona (czy ma właściwy project-ref)

---

### Problem: Joby pozostają w statusie PENDING

**Przyczyna**: Worker nie działa lub błąd w RPC `claim_normalized_ingredients_jobs`.

**Rozwiązanie:**
1. Sprawdź logi funkcji w Dashboard (czy worker się uruchamia)
2. Przetestuj ręczne wywołanie workera (punkt 5.1)
3. Sprawdź czy RPC działa:
   ```sql
   SELECT * FROM claim_normalized_ingredients_jobs(1);
   ```
4. Jeśli RPC zwraca błąd, sprawdź czy migracja `20260118150100` została zastosowana

---

### Problem: Wszystkie joby kończą się FAILED

**Przyczyna**: Błąd OpenAI API (nieprawidłowy klucz, brak kredytów, rate limit).

**Rozwiązanie:**
1. Sprawdź logi funkcji - szukaj `"OpenAI API error"`
2. Zweryfikuj klucz OpenAI:
   - Dashboard OpenAI → API Keys
   - Sprawdź czy klucz nie wygasł
   - Sprawdź limity usage: https://platform.openai.com/usage
3. Sprawdź `last_error` w tabeli jobów:
   ```sql
   SELECT recipe_id, last_error, attempts 
   FROM normalized_ingredients_jobs 
   WHERE status IN ('FAILED', 'RETRY');
   ```

---

### Problem: Worker timeout (brak odpowiedzi po 55s)

**Przyczyna**: Zbyt duży batch size lub wolne API OpenAI.

**Rozwiązanie:**
1. Zmniejsz `NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE` do 5-10
2. Zwiększ timeout w cronie do 55000ms (już ustawione)
3. Sprawdź logi - czy niektóre joby się przetwarzają (succeeded > 0)

---

### Problem: Joby "utknięte" w statusie RUNNING

**Przyczyna**: Worker przerwany podczas przetwarzania (crash, timeout).

**Rozwiązanie:**

```sql
-- Ręcznie zresetuj joby RUNNING starsze niż 10 minut
UPDATE normalized_ingredients_jobs
SET 
    status = 'RETRY',
    next_run_at = now(),
    updated_at = now()
WHERE status = 'RUNNING'
  AND updated_at < now() - interval '10 minutes';
```

---

## Dezaktywacja workera (jeśli potrzeba)

Jeśli musisz tymczasowo wyłączyć workera:

```sql
-- Wyłącz cron job
SELECT cron.unschedule('normalized-ingredients-worker');

-- Lub tylko dezaktywuj (bez usuwania)
UPDATE cron.job 
SET active = false 
WHERE jobname = 'normalized-ingredients-worker';
```

Aby ponownie włączyć:

```sql
-- Reaktywuj
UPDATE cron.job 
SET active = true 
WHERE jobname = 'normalized-ingredients-worker';
```

---

## Podsumowanie checklist wdrożenia

- [ ] Migracje bazy danych zastosowane
- [ ] Funkcja RPC `claim_normalized_ingredients_jobs` istnieje
- [ ] Edge Function `internal` wdrożona
- [ ] Sekrety skonfigurowane (INTERNAL_WORKER_SECRET, OPENAI_API_KEY)
- [ ] Funkcja `get_internal_worker_secret()` utworzona
- [ ] Cron job utworzony i aktywny
- [ ] Test ręczny workera przeszedł pomyślnie
- [ ] Test z prawdziwym jobem zakończony sukcesem
- [ ] Monitoring skonfigurowany

---

## Kontakt i wsparcie

W razie problemów:
1. Sprawdź logi funkcji w Dashboard
2. Sprawdź tabelę `normalized_ingredients_jobs`
3. Sprawdź historię crona: `cron.job_run_details`
4. Zobacz sekcję [Troubleshooting](#troubleshooting) powyżej

---

**Ostatnia aktualizacja**: 2026-01-18  
**Wersja dokumentu**: 1.0
