# API Endpoints Implementation Plan: `POST /internal/workers/normalized-ingredients/run`

## 1. Przegląd punktu końcowego

Endpoint uruchamia **wewnętrznego workera** odpowiedzialnego za asynchroniczne wyliczanie „składników znormalizowanych” dla przepisów (funkcjonalność backend-only w MVP).

- **Cel**: przetworzyć kolejkę `normalized_ingredients_jobs` i dla wybranych zadań:
    - pobrać aktualne `recipes.ingredients` (JSONB),
    - wywołać logikę AI normalizacji (jak w `POST /ai/recipes/normalized-ingredients`),
    - zapisać wynik do `recipe_normalized_ingredients`,
    - zaktualizować `recipes.normalized_ingredients_status` / `recipes.normalized_ingredients_updated_at`,
    - zarządzić retry/backoff i finalne `FAILED`.
- **Intended caller**: Supabase Scheduler (cron co minutę).
- **Charakter**: internal-only (nie wywoływany przez frontend).

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/internal/workers/normalized-ingredients/run`
    - Rekomendacja implementacyjna w Supabase: Edge Function o nazwie `internal`, a ścieżka routingu: `/workers/normalized-ingredients/run`.
    - Realny URL (Supabase): `/functions/v1/internal/workers/normalized-ingredients/run`
- **Parametry**:
    - **Wymagane**:
        - nagłówek `x-internal-worker-secret`: sekret uruchomieniowy workera (wartość z env `INTERNAL_WORKER_SECRET`)
    - **Opcjonalne**: brak (w kontrakcie MVP)
- **Request Body**: brak (`Content-Length: 0`)
- **Konfiguracja środowiskowa (env)**:
    - **Wymagane**:
        - `INTERNAL_WORKER_SECRET` — sekret do autoryzacji internal endpointu
        - `NORMALIZED_INGREDIENTS_WORKER_RUN_EVERY_MINUTES` — „efektywny” interwał uruchomienia (cron jest co minutę, ale worker może no-op)
    - **Rekomendowane** (dla kontroli obciążenia, nie część kontraktu API):
        - `NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE` (np. 10–50)
        - `NORMALIZED_INGREDIENTS_WORKER_MAX_RUN_MS` (np. 20_000–50_000)

## 3. Wykorzystywane typy

### DTO/Modele istniejące (repo)

- `NormalizedIngredientDto`, `NormalizedIngredientUnit` — z `shared/contracts/types.ts` (format danych wynikowych)
- `AiNormalizedIngredientsRequestDto`, `AiNormalizedIngredientsResponseDto` — z `shared/contracts/types.ts` (kontrakt AI normalizacji)
- `NormalizedIngredientsStatus` — z `shared/contracts/types.ts` (status na `recipes`)

### DTO nowe (rekomendacja)

Ponieważ endpoint jest internal-only, typ może być lokalny dla Edge Function. Dla spójności można dodać do `shared/contracts/types.ts` (opcjonalnie):

- `NormalizedIngredientsWorkerRunResponseDto`:
    - `processed: number`
    - `succeeded: number`
    - `failed: number`
    - `skipped: number`

## 4. Szczegóły odpowiedzi

- **200 OK** (worker uruchomiony; zawsze zwraca podsumowanie)

Przykład payload:

```json
{
    "processed": 10,
    "succeeded": 7,
    "failed": 3,
    "skipped": 0
}
```

- **401 Unauthorized** (brak/niepoprawny `x-internal-worker-secret`)

```json
{
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
}
```

- **500 Internal Server Error** (nieoczekiwany błąd w workerze, np. błąd DB)

```json
{
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
}
```

## 5. Przepływ danych

### 5.1. Zasoby bazodanowe (kluczowe)

- `recipes`
    - `ingredients` (JSONB)
    - `normalized_ingredients_status` (`PENDING|READY|FAILED`)
    - `normalized_ingredients_updated_at` (timestamptz)
    - **soft delete**: wszystkie operacje muszą respektować `deleted_at IS NULL`
- `normalized_ingredients_jobs`
    - deduplikacja: unikalny indeks po `recipe_id` (1 aktywny job na przepis)
    - retry: `attempts`, `last_error` + (rekomendowane) `next_run_at`, statusy `RETRY`
- `recipe_normalized_ingredients`
    - `recipe_id` (PK)
    - `items` (JSONB array `{ amount, unit, name }`)
    - `updated_at`

### 5.2. Worker run (high-level)

1. **Autoryzacja internal-only**: sprawdzenie `x-internal-worker-secret`.
2. **Gating interwału**: jeśli `NORMALIZED_INGREDIENTS_WORKER_RUN_EVERY_MINUTES > 1`, worker może zwrócić 200 z `processed=0` (no-op), jeśli od ostatniego realnego run nie minął interwał.
3. **Claim jobów (atomowo, bez wyścigów)**:
    - wybrać joby `status IN (PENDING, RETRY)` oraz `next_run_at <= now()` (lub ekwiwalent w obecnym schemacie)
    - zastosować mechanizm bezpiecznej konkurencji (np. `FOR UPDATE SKIP LOCKED`) w transakcji
4. **Dla każdego joba**:
    - pobrać bieżący stan przepisu (`recipes.ingredients`, opcjonalnie `recipes.updated_at`)
    - zbudować wejście do normalizacji (tylko elementy `type="item"`, ignorować `header`)
    - wywołać logikę normalizacji (ta sama co w `ai`):
        - preferowane: wydzielenie wspólnej funkcji (np. `functions/_shared/normalized-ingredients.ts`) używanej przez `ai` i workera
    - zapisać wynik:
        - upsert do `recipe_normalized_ingredients`
        - update `recipes`: `normalized_ingredients_status='READY'`, `normalized_ingredients_updated_at=now()`
    - oznaczyć job jako `DONE`
5. **Błąd w trakcie**:
    - jeśli `attempts < 5`: `status='RETRY'`, wyliczyć `next_run_at` zgodnie z backoff i zapisać `last_error`
    - jeśli `attempts >= 5`: `status='FAILED'` i update `recipes.normalized_ingredients_status='FAILED'`
6. Zwrócić podsumowanie `{processed, succeeded, failed, skipped}`.

### 5.3. Retry/backoff (MVP)

Polityka z API planu:
- max attempts: **5**
- backoff: **1m, 5m, 30m, 2h, 12h** (+ jitter)

Rekomendacja:
- przechowywać `next_run_at` w `normalized_ingredients_jobs`
- jitter: losowe ±10–30% dla rozproszenia obciążenia

## 6. Względy bezpieczeństwa

- **Internal-only**:
    - wymagany nagłówek `x-internal-worker-secret`
    - sekret trzymany w env (`INTERNAL_WORKER_SECRET`), nigdy w kodzie
- **Service role / DB access**:
    - worker potrzebuje uprawnień do:
        - odczytu `recipes` niezależnie od usera,
        - update `recipes.normalized_ingredients_*`,
        - insert/update `recipe_normalized_ingredients`,
        - update `normalized_ingredients_jobs`
    - rekomendacja: wykonywać operacje DB w kontekście `service_role` (zgodnie z istniejącymi policy „Service role can manage ...”).
- **Ochrona przed DoS / kosztem AI**:
    - batch size + limit czasu runa (env)
    - ograniczenie liczby zadań per run (np. 10–50)
    - „skip” gdy brak zadań gotowych do uruchomienia
- **Brak wycieku danych**:
    - endpoint nie zwraca danych przepisów ani szczegółów błędów (tylko agregaty)

## 7. Obsługa błędów

### 7.1. Scenariusze błędów i kody statusu

- **401 Unauthorized**
    - brak/niezgodny `x-internal-worker-secret`
- **400 Bad Request**
    - nie dotyczy w MVP (brak body/parametrów); opcjonalnie, jeśli w przyszłości dojdą parametry testowe
- **404 Not Found**
    - nie dotyczy typowo (endpoint internal), ale może zostać użyty dla „nieobsługiwanej ścieżki” w routerze `internal`
- **500 Internal Server Error**
    - błąd bazy danych (RPC, transakcje)
    - błąd integracji AI (np. nieobsłużony wyjątek)

### 7.2. Rejestrowanie błędów (observability)

- **W DB**: `normalized_ingredients_jobs.last_error` (już istnieje) + `attempts`
- **W logach**: `logger.error/warn` z kontekstem `job_id`, `recipe_id`, `attempts`
- **Tabela błędów**: w obecnym schemacie brak dedykowanej tabeli; na MVP wystarcza `last_error` + logi. (Opcjonalnie w przyszłości: `worker_errors` z historią).

## 8. Rozważania dotyczące wydajności

- **Claim batch**:
    - pojedynczy „claim” powinien pobrać N jobów atomowo, zamiast N osobnych query (mniej round-tripów)
    - preferowane RPC w Postgres do „claimowania” (łatwiej użyć `FOR UPDATE SKIP LOCKED`)
- **Przetwarzanie**:
    - przetwarzanie sekwencyjne w obrębie runa jest OK na MVP (prostsze, mniej ryzyka rate limitów AI)
    - opcjonalna mała równoległość (np. 2–3) dopiero po pomiarach i limitach
- **Idempotencja zapisu wyników**:
    - `recipe_normalized_ingredients` ma `recipe_id` jako PK → upsert jest naturalnie idempotentny

## 9. Kroki implementacji

1. **Edge Function routing**
    - utworzyć katalog `supabase/functions/internal/`
    - `index.ts`: tylko CORS (jeśli potrzebne), routing i global error handler
    - `internal.handlers.ts`: router ścieżek internal (w tym `POST /workers/normalized-ingredients/run`)
    - `normalized-ingredients-worker.service.ts`: logika workera (claim, process, retry, update DB)

2. **Autoryzacja internal-only**
    - w handlerze dodać guard:
        - odczytać `x-internal-worker-secret`
        - porównać z env `INTERNAL_WORKER_SECRET`
        - w razie braku/niezgodności zwrócić `401`

3. **Gating interwału uruchomienia**
    - dodać w DB prosty stan workera (rekomendacja):
        - tabela `internal_worker_state` z rekordem `key='normalized-ingredients'`, `last_run_at`
        - RPC `should_run_worker(p_key, p_every_minutes)` zwracający boolean + aktualizujący `last_run_at` atomowo
    - alternatywnie (mniej dokładne): brak gatingu i poleganie na `next_run_at` w jobach

4. **Dostosowanie schematu kolejki do retry/backoff (jeśli wymagamy 1:1 kontraktu z API planu)**
    - migracja: dodać do `normalized_ingredients_jobs`:
        - `next_run_at timestamptz not null default now()`
        - (opcjonalnie) `locked_at`, `locked_by`, `source_recipe_updated_at`
    - zmienić constraint `status` na: `PENDING|RUNNING|RETRY|DONE|FAILED`
    - dodać/zmienić indeks: `(status, next_run_at)` dla `status IN ('PENDING','RETRY')`
    - zaktualizować RPC `enqueue_normalized_ingredients_refresh` aby ustawiało:
        - `status='PENDING'`, `attempts=0`, `last_error=NULL`, `next_run_at=now()`
        - (opcjonalnie) `source_recipe_updated_at = recipes.updated_at`

5. **RPC do claimowania jobów (rekomendacja)**
    - dodać RPC `claim_normalized_ingredients_jobs(p_limit int)`:
        - SELECT + `FOR UPDATE SKIP LOCKED`
        - UPDATE status na `RUNNING` i inkrement attempts
        - RETURN lista jobów do przetworzenia
    - dodać RPC do zakończenia joba:
        - `complete_normalized_ingredients_job(p_job_id, p_status, p_last_error, p_next_run_at)`
        - lub update bezpośrednio (mniej preferowane)

6. **Implementacja przetwarzania joba**
    - pobrać `recipes.ingredients` dla `recipe_id` (upewnić się, że `deleted_at IS NULL`; jeśli nie, oznaczyć job jako `DONE`/`FAILED` i policzyć jako `skipped`)
    - zbudować payload do normalizacji:
        - odfiltrować `header`, zachować `item`
        - jeśli brak `item` → traktować jako błąd walidacji i finalnie `FAILED` (lub `skipped`), zgodnie z polityką
    - wywołać logikę normalizacji (wspólny moduł z `ai`)
    - zapisać do `recipe_normalized_ingredients` i zaktualizować `recipes` statusy

7. **Retry/backoff + jitter**
    - przy błędzie (np. AI 429, błąd walidacji LLM, błąd sieci):
        - ustalić `next_run_at` według harmonogramu + jitter
        - `status='RETRY'` jeśli są próby
        - `status='FAILED'` i `recipes.normalized_ingredients_status='FAILED'` po 5 próbach

8. **Odpowiedź endpointu**
    - zwrócić `200` z liczbami `{processed, succeeded, failed, skipped}`
    - `processed = succeeded + failed + skipped`

9. **Testy i weryfikacja (manual smoke)**
    - 1) utworzyć/zmodyfikować przepis → upewnić się, że powstaje job `PENDING`
    - 2) uruchomić endpoint workera z poprawnym secretem:
        - job przechodzi do `DONE`
        - `recipes.normalized_ingredients_status='READY'`
        - `recipe_normalized_ingredients.items` wypełnione
    - 3) zasymulować błąd AI → sprawdzić `RETRY`, `next_run_at`, `attempts`
    - 4) po 5 próbach → `FAILED` + `recipes.normalized_ingredients_status='FAILED'`

