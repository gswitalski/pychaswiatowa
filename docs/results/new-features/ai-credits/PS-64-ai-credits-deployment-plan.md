# PS-64: Model danych i egzekwowanie limitów kredytów AI — Plan wdrożenia

> **User Story:** PS-64 — Model danych i egzekwowanie limitów kredytów AI
> **Data:** wrzesień 2026
> **Środowisko docelowe:** Firebase Hosting (frontend) + Supabase Cloud (backend)

---

## 1. Podsumowanie

PS-64 wymaga zmian zarówno w bazie danych (migracja), jak i w warstwie Edge Functions oraz frontendu. Kolejność kroków jest ważna — migracja DB musi poprzedzać deploy Edge Functions, które z niej korzystają.

| Obszar | Wymagane działanie |
|---|---|
| Baza danych (PostgreSQL) | Migracja: nowy enum, nowa tabela, triggery, RLS |
| Supabase Edge Functions | Aktualizacja `ai` function + nowe endpointy (credits, internal worker) |
| Supabase Cron | Nowe zadanie cykliczne: monthly reset kredytów |
| Zmienne środowiskowe | Nowe klucze konfigurujące limity kredytów |
| Frontend (Angular) | Deploy zaktualizowanej aplikacji po implementacji UI |
| Istniejący dane | Jednorazowe seedowanie kredytów dla aktywnych użytkowników |

---

## 2. Krok 1 — Zmienne środowiskowe (Edge Functions Secrets)

**Typ:** Konfiguracja Supabase (Secrets)

Przed deployem Edge Functions dodać w panelu Supabase (`Project Settings → Edge Functions → Secrets`) lub przez CLI:

```bash
supabase secrets set AI_DRAFT_CREDITS_FREE=3
supabase secrets set AI_DRAFT_CREDITS_PREMIUM=20
supabase secrets set AI_IMAGE_CREDITS_PREMIUM=5
supabase secrets set AI_CREDITS_WARN_THRESHOLD_PERCENT=25
supabase secrets set AI_CREDITS_INTERNAL_CRON_SECRET=<losowy-secret-min-32-znaki>
```

| Zmienna | Wartość domyślna | Opis |
|---|---|---|
| `AI_DRAFT_CREDITS_FREE` | `3` | Limit kredytów draft dla użytkownika Free (lifetime) |
| `AI_DRAFT_CREDITS_PREMIUM` | `20` | Limit kredytów draft dla Premium (miesięczny) |
| `AI_IMAGE_CREDITS_PREMIUM` | `5` | Limit kredytów image dla Premium (miesięczny) |
| `AI_CREDITS_WARN_THRESHOLD_PERCENT` | `25` | Próg ostrzeżenia w UI (% pozostałych kredytów) |
| `AI_CREDITS_INTERNAL_CRON_SECRET` | — | Sekret autoryzujący endpoint workera monthly reset |

> **Uwaga:** Wartości kredytów są konfigurowalne przez zmienne środowiskowe, aby umożliwić zmianę limitów bez redeploymentu kodu (np. przy promocjach lub testach A/B).

---

## 3. Krok 2 — Migracja bazy danych

**Typ:** Supabase Migration (SQL)

Plik migracji: `supabase/migrations/<timestamp>_add_user_ai_credits.sql`

### 3.1. Nowy enum

```sql
CREATE TYPE ai_credit_limit_type AS ENUM ('lifetime', 'monthly');
```

### 3.2. Nowa tabela `user_ai_credits`

```sql
CREATE TABLE public.user_ai_credits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Kredyty na draft (asysta AI z tekstu lub obrazu)
    draft_credits_total smallint NOT NULL DEFAULT 3 CHECK (draft_credits_total >= 0),
    draft_credits_used  smallint NOT NULL DEFAULT 0  CHECK (draft_credits_used >= 0),

    -- Kredyty na generowanie zdjęcia AI
    image_credits_total smallint NOT NULL DEFAULT 0 CHECK (image_credits_total >= 0),
    image_credits_used  smallint NOT NULL DEFAULT 0  CHECK (image_credits_used >= 0),

    -- Typ limitu
    limit_type ai_credit_limit_type NOT NULL DEFAULT 'lifetime',

    -- Data następnego resetu (NULL dla Free/lifetime)
    next_reset_at timestamptz,

    -- Metadane
    credits_activated_at timestamptz NOT NULL DEFAULT now(),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT user_ai_credits_user_unique UNIQUE (user_id),
    CONSTRAINT draft_used_lte_total CHECK (draft_credits_used <= draft_credits_total),
    CONSTRAINT image_used_lte_total CHECK (image_credits_used <= image_credits_total)
);

COMMENT ON TABLE public.user_ai_credits IS
    'Przechowuje pule kredytów AI per użytkownik. Jeden wiersz na konto.';
```

### 3.3. Indeksy

```sql
-- Indeks dla monthly reset workera (szybkie wyszukiwanie kont do resetu)
CREATE INDEX idx_user_ai_credits_monthly_reset
    ON public.user_ai_credits (limit_type, next_reset_at)
    WHERE limit_type = 'monthly';
```

### 3.4. Trigger `updated_at`

```sql
CREATE TRIGGER set_user_ai_credits_updated_at
    BEFORE UPDATE ON public.user_ai_credits
    FOR EACH ROW
    EXECUTE FUNCTION moddatetime(updated_at);
```

> Funkcja `moddatetime` jest wbudowana w Supabase. Jeśli nie jest dostępna w projekcie, użyć istniejącej funkcji `handle_updated_at()` stosowanej dla innych tabel.

### 3.5. Trigger: inicjalizacja kredytów przy rejestracji

```sql
CREATE OR REPLACE FUNCTION public.initialize_user_ai_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_ai_credits (user_id, draft_credits_total, limit_type)
    VALUES (NEW.id, 3, 'lifetime')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_init_credits
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.initialize_user_ai_credits();
```

> Trigger uruchamiany przy każdej nowej rejestracji (e-mail, Google OAuth). Tworzy rekord z domyślnymi kredytami Free (3 draft, 0 image, lifetime).

### 3.6. RLS — włączenie i polityki

```sql
ALTER TABLE public.user_ai_credits ENABLE ROW LEVEL SECURITY;

-- Użytkownik widzi tylko swoje kredyty
CREATE POLICY "user_ai_credits_select_own"
    ON public.user_ai_credits
    FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT i UPDATE wyłącznie przez service role (Edge Functions)
-- Brak polityk dla INSERT/UPDATE/DELETE = blokada dla użytkowników
```

---

## 4. Krok 3 — Jednorazowe seedowanie istniejących użytkowników

**Typ:** Jednorazowa migracja danych (SQL)

Po wdrożeniu tabeli należy zainicjować kredyty dla **wszystkich aktywnych użytkowników**, którzy zarejestrowali się przed wdrożeniem PS-64 (trigger działa tylko dla nowych).

```sql
-- Seedowanie kredytów dla istniejących użytkowników Free
INSERT INTO public.user_ai_credits (user_id, draft_credits_total, limit_type)
SELECT
    id,
    3,
    'lifetime'::ai_credit_limit_type
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_ai_credits)
  AND raw_app_meta_data->>'app_role' = 'user';

-- Seedowanie kredytów dla istniejących użytkowników Premium
INSERT INTO public.user_ai_credits (
    user_id,
    draft_credits_total,
    image_credits_total,
    limit_type,
    next_reset_at,
    credits_activated_at
)
SELECT
    id,
    20,
    5,
    'monthly'::ai_credit_limit_type,
    now() + INTERVAL '1 month',
    now()
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_ai_credits)
  AND raw_app_meta_data->>'app_role' = 'premium';
```

> **Uwaga:** Istniejący użytkownicy `premium` (przypisani przez admina przed startem checkout) otrzymają pełną pulę miesięczną z datą resetu = `now() + 1 miesiąc`. Kredyty `draft_credits_used` i `image_credits_used` startują od 0, gdyż system nie śledził dotąd zużycia.
>
> Po wdrożeniu prawdziwego checkout (PS-62), webhook płatności nadpisze `next_reset_at` datą pierwszej płatności.

---

## 5. Krok 4 — Aktualizacja handlera zmiany roli (Edge Function `admin`)

**Typ:** Zmiana kodu Edge Function

Endpoint `PATCH /admin/users/{userId}/role` (istniejący) zmienia rolę użytkownika. Po wdrożeniu PS-64 musi dodatkowo zaktualizować tabelę `user_ai_credits` przy zmianie roli.

**Logika do dodania w istniejącym handlerze:**

```
Gdy rola zmieniana na 'premium':
  → UPSERT user_ai_credits SET
      draft_credits_total  = AI_DRAFT_CREDITS_PREMIUM (env),
      draft_credits_used   = 0,
      image_credits_total  = AI_IMAGE_CREDITS_PREMIUM (env),
      image_credits_used   = 0,
      limit_type           = 'monthly',
      next_reset_at        = now() + INTERVAL '1 month',
      credits_activated_at = now()

Gdy rola zmieniana z 'premium' na 'user':
  → UPSERT user_ai_credits SET
      draft_credits_total  = AI_DRAFT_CREDITS_FREE (env),
      draft_credits_used   = 0,   -- reset przy downgrade
      image_credits_total  = 0,
      image_credits_used   = 0,
      limit_type           = 'lifetime',
      next_reset_at        = NULL,
      credits_activated_at = now()
```

> Downgrade z Premium do Free resetuje liczniki (`draft_credits_used = 0`) — użytkownik odzyskuje limit lifetime startując od zera. Alternatywą byłoby zachowanie zużytych kredytów, ale to komplikuje logikę. Decyzja: **reset przy downgrade**.

---

## 6. Krok 5 — Nowe i zmodyfikowane Edge Functions

**Typ:** Deploy Supabase Edge Functions

Zmiany do wdrożenia w ramach funkcji `ai`:

| Funkcja | Zmiana |
|---|---|
| `supabase/functions/ai/index.ts` | Dodanie routingu dla `GET /ai/credits` |
| `supabase/functions/ai/handlers/draft.ts` | Integracja helpera `checkAndDeductCredits` |
| `supabase/functions/ai/handlers/image.ts` | Integracja helpera `checkAndDeductCredits` |
| `supabase/functions/ai/credits.ts` | Nowy handler `GET /ai/credits` |
| `supabase/functions/ai/helpers/credits.ts` | Nowy helper `checkAndDeductCredits` |

Nowe funkcje:

| Funkcja | Opis |
|---|---|
| `supabase/functions/internal/ai-credits-reset/index.ts` | Worker monthly reset kredytów |
| `supabase/functions/admin/handlers/user-credits.ts` | Handler `PATCH /admin/users/{id}/ai-credits` |

**Deploy komenda:**

```bash
supabase functions deploy ai
supabase functions deploy internal
supabase functions deploy admin
```

---

## 7. Krok 6 — Konfiguracja Supabase Cron (monthly reset)

**Typ:** Konfiguracja Supabase (Cron Jobs)

W panelu Supabase (`Database → Cron Jobs`) lub przez SQL dodać nowe zadanie cykliczne:

```sql
SELECT cron.schedule(
    'ai-credits-monthly-reset',           -- nazwa joba
    '0 2 * * *',                          -- codziennie o 02:00 UTC
    $$
    SELECT net.http_post(
        url     := 'https://<project-ref>.supabase.co/functions/v1/internal/ai-credits-reset',
        headers := '{"Content-Type": "application/json", "x-cron-secret": "<AI_CREDITS_INTERNAL_CRON_SECRET>"}'::jsonb,
        body    := '{}'::jsonb
    );
    $$
);
```

> **Częstotliwość:** Codziennie o 02:00 UTC. Worker sprawdza `next_reset_at <= now()` i resetuje tylko konta z przekroczoną datą — bezpieczne uruchamianie codziennie zamiast raz w miesiącu (obsługuje różne daty aktywacji różnych kont).
>
> **Sekret:** `AI_CREDITS_INTERNAL_CRON_SECRET` ustawiony w kroku 2. Chroni endpoint przed wywołaniem przez nieuprawnione podmioty.

---

## 8. Krok 7 — Weryfikacja i wdrożenie frontendu

**Typ:** QA + deploy Firebase Hosting

Przed wdrożeniem produkcyjnym sprawdzić:

- [ ] `GET /ai/credits` zwraca poprawny stan dla roli `user` (3/0 draft/image, lifetime)
- [ ] `GET /ai/credits` zwraca poprawny stan dla roli `premium` (20/5, monthly, data resetu)
- [ ] `GET /ai/credits` zwraca `unlimited` dla roli `admin`
- [ ] `POST /ai/recipes/draft` dla `user` z 0 kredytami zwraca `402 AI_CREDITS_EXHAUSTED`
- [ ] `POST /ai/recipes/draft` dla `admin` z 0 kredytami przechodzi bez blokady
- [ ] Kredyt odejmowany po sukcesie AI (nie przed), nie po błędzie AI
- [ ] Worker `monthly-reset` resetuje `draft_credits_used = 0` i `image_credits_used = 0` dla Premium z przeterminowanym `next_reset_at`
- [ ] RLS blokuje odczyt kredytów innego użytkownika (test z innym JWT)
- [ ] Zmiana roli z `user` na `premium` w adminie aktualizuje `user_ai_credits`
- [ ] Wskaźnik kredytów wyświetla się poprawnie na stronie asysty AI
- [ ] Dialog `AiCreditsExhaustedDialog` otwiera się po kliknięciu wyczerpanego wskaźnika
- [ ] Sekcja kredytów w ustawieniach (`/settings`) wyświetla poprawne wartości
- [ ] Strona asysty blokuje przycisk „Generuj draft" przy 0 kredytach

**Deploy frontendu:**

```bash
ng build --configuration=production
firebase deploy --only hosting
```

---

## 9. Czego NIE robi PS-64

| Element | Historyjka |
|---|---|
| Checkout i webhook płatności (nadpisanie `next_reset_at`) | PS-62 (checkout) |
| Strona cennika z widocznym limitem AI dla Free | PS-63 (zrealizowana) |
| Pakiety kredytów (add-on do dokupienia) | Przyszłe historyjki |
| Import z URL/zdjęcia (nowe typy kredytów) | Przyszłe historyjki |
| Maile lifecycle (koniec kredytów, reset) | Przyszłe historyjki |
| Priorytet jobów AI dla Premium (osobna kolejka) | Przyszłe historyjki |

---

## 10. Zależności

| Zależność | Status | Uwaga |
|---|---|---|
| Tabela `auth.users` (Supabase Auth) | ✅ Istniejąca | Trigger `on_auth_user_created_init_credits` doczepiony do tej tabeli |
| Funkcja `moddatetime` (Supabase built-in) | ✅ Wbudowana | Weryfikacja dostępności przed uruchomieniem migracji |
| Edge Function `ai` (istniejąca) | ✅ Istniejąca | Wymaga modyfikacji handlerów draft i image |
| Edge Function `admin` (istniejąca) | ✅ Istniejąca | Wymaga modyfikacji handlera zmiany roli |
| Supabase Cron (`pg_cron`) | ✅ Dostępny w Supabase Cloud | Weryfikacja dostępności w projekcie przed konfiguracją |
| `AI_CREDITS_INTERNAL_CRON_SECRET` | ❌ Do ustawienia | Krok 2 — Secrets |
| Tabela `user_ai_credits` | ❌ Do utworzenia | Krok 3 — Migracja |

---

## 11. Ryzyka i mitygacje

| Ryzyko | Prawdopodobieństwo | Mitygacja |
|---|---|---|
| Race condition: dwa równoczesne wywołania AI wyczerpują kredyty bez `SELECT FOR UPDATE` | Średnie | Obowiązkowe `SELECT FOR UPDATE` w helperze `checkAndDeductCredits` |
| Seedowanie pomija użytkowników z niestandardową rolą | Niskie | SQL seedowania sprawdza `raw_app_meta_data->>'app_role'`; weryfikacja po seedowaniu: `SELECT COUNT(*) FROM auth.users WHERE id NOT IN (SELECT user_id FROM user_ai_credits)` |
| Cron monthly reset nie uruchamia się (awaria Supabase Cron) | Niskie | Worker jest idempotentny — przy następnym uruchomieniu zresetuje zaległe konta; monitoring w panelu Supabase |
| Użytkownicy premium ze starą datą `next_reset_at` resetują się zbyt szybko po seedowaniu | Niskie | Seedowanie ustawia `next_reset_at = now() + 1 miesiąc`; dopiero checkout nadpisze datą płatności |
| Downgrade premium → user kasuje historię zużycia | Niskie (akceptowalne) | Decyzja projektowa: reset przy downgrade; alternatywnie logować zużycie w osobnej tabeli historii (poza zakresem PS-64) |
| Deploy Edge Functions bez wcześniejszej migracji DB | Wysokie (blokujące) | Obowiązkowa kolejność: migracja → secrets → deploy functions → cron |
