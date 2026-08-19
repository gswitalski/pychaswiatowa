# Jednolity model uprawnień — plan wdrożeniowy

## 1. Przegląd

PREM-001 nie wymaga operatora płatności, Google Cloud ani nowych kluczy AI. Wdrożenie to przede wszystkim **migracja PostgreSQL**, **backfill** istniejących kont, **sekret grace** w Edge Functions oraz **redeploy** funkcji `me`, `ai`, `admin` i frontendu.

Kolejność: migracja i backfill na bazie → sekrety → deploy Edge Functions → deploy Angular. Odwrócona kolejność (frontend przed migracją) spowoduje, że `GET /me` nie znajdzie tabeli.

Nie powstają zewnętrzne usługi SaaS. Źródło prawdy zostaje w **Supabase Cloud** (PostgreSQL + Auth).

---

## 2. Krok 1 — Migracja bazy danych

### 2.1. Nowe typy enum

W schemacie `public`:

| Typ | Wartości |
|---|---|
| `subscription_status` | `none`, `trial`, `active`, `past_due`, `canceled` |
| `grant_source` | `none`, `subscription`, `trial`, `admin_override` |

Nazwa pliku migracji (konwencja repozytorium):  
`supabase/migrations/YYYYMMDDHHMMSS_create_account_entitlements.sql`

### 2.2. Tabela `account_entitlements`

Jedna para 1:1 z `auth.users`.

| Kolumna | Typ | Wymagania |
|---|---|---|
| `user_id` | `uuid` PK, FK → `auth.users(id)` ON DELETE CASCADE | Klucz konta |
| `subscription_status` | `subscription_status` NOT NULL DEFAULT `'none'` | Stan cyklu |
| `grant_source` | `grant_source` NOT NULL DEFAULT `'none'` | Źródło Premium |
| `current_period_end` | `timestamptz` NULL | Koniec opłaconego okresu / trialu |
| `grace_period_end` | `timestamptz` NULL | Koniec grace przy `past_due` |
| `trial_used` | `boolean` NOT NULL DEFAULT `false` | Rezerwa pod PREM-005 (jeden trial na konto) |
| `provider_subscription_id` | `text` NULL | Rezerwa pod PREM-006; w PREM-001 zawsze puste |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | Audyt |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | Audyt |

Indeks: PK na `user_id` wystarcza do odczytu sesji. Opcjonalny indeks `(subscription_status)` nie jest wymagany na start (mała kardynalność, brak joba windykacji).

Komentarze SQL (`COMMENT ON TABLE/COLUMN`) opisujące, że ledger kredytów **nie** mieszka w tej tabeli (PREM-002).

### 2.3. Trigger przy rejestracji

Rozszerzyć `public.handle_new_user()` (migracja `20251208120000_add_auto_create_profile_trigger.sql`), aby w tym samym bloku — po insercie `profiles` — wykonać:

```sql
insert into public.account_entitlements (user_id)
values (new.id)
on conflict (user_id) do nothing;
```

Błąd insertu entitlements nie może blokować utworzenia `auth.users` (ten sam wzorzec `exception when others → raise warning`, co przy profilu). Resolver i tak traktuje brak wiersza jako Free.

Trigger `set_default_app_role` (BEFORE INSERT na `auth.users`) **bez zmian** — nadal ustawia `app_role = user`.

### 2.4. RLS

| Operacja | Kto | Polityka |
|---|---|---|
| SELECT | `authenticated` | `user_id = auth.uid()` — użytkownik czyta tylko siebie |
| INSERT / UPDATE / DELETE | klient | **brak** polityk dla `authenticated` / `anon` |
| Wszystkie zapisy | service role, `security definer` RPC | Panel admina, przyszły webhook, backfill |

Włączyć RLS na tabeli. Edge Functions `me` / `ai` / `admin` odczytują i zapisują przez klienta service role (jak zmiana roli dziś), żeby JOIN na liście admina i UPSERT przy `PATCH` nie zależały od JWT ofiary.

Dokumentacja operacyjna: uzupełnić [`docs/deployment/rls-deployment.md`](../../deployment/rls-deployment.md) o `account_entitlements` przy wdrażaniu RLS na środowisku.

### 2.5. RPC zmiany roli (rozszerzenie)

Istniejące RPC z migracji `20260804200000_create_admin_update_user_role_rpc.sql` musi w tej samej transakcji UPSERT-ować entitlements (semantyka z planu API: `premium` → override, `user` → clear override bez kasowania przyszłej subskrypcji, `admin` → tożsamość admina).

Jeśli RPC zostanie rozdzielone na dwa wywołania z Edge Function, trzeba zagwarantować, że nie powstanie stan „rola premium, grant none” albo odwrotnie przy częściowym błędzie.

### 2.6. Regeneracja typów

Po migracji lokalnej: `supabase gen types` (istniejący skrypt projektu) — `database.types.ts` musi zawierać `account_entitlements`.

---

## 3. Krok 2 — Backfill istniejących kont

Migracja **idempotentna**, uruchamiana raz przy `supabase db push` / CI.

### 3.1. Wiersz dla każdego `auth.users`

```sql
insert into public.account_entitlements (user_id)
select id from auth.users
on conflict (user_id) do nothing;
```

### 3.2. Mapowanie ról (rekomendacja produktowa)

| Obecne `raw_app_meta_data.app_role` | Entitlements po backfillu | Uzasadnienie |
|---|---|---|
| `admin` | wiersz default (`none` / `none`); Premium z tożsamości admina | Brak fałszywej subskrypcji |
| `premium` | `grant_source = admin_override`, `subscription_status = none` | Testerzy i ręcznie nadane konta **nie tracą** AI po wdrożeniu |
| `user` / brak / nieznane | default Free | Zgodnie z PREM-001 |

Bez kroku 3.2 każde konto `premium` w JWT stałoby się Free w resolverze (JWT nie przyznaje już Premium). To złamałoby środowisko testowe i ręcznie nadane role z `/admin/users`.

Backfill **nie** ustawia `subscription_status = active` — nie ma operatora płatności.

### 3.3. Środowiska

Ten sam skrypt na lokalnym CLI, staging i produkcji. Przed produkcją: zrzut liczby kont per `app_role` i porównanie po migracji (`premium` count = liczba `admin_override`).

---

## 4. Krok 3 — Sekret `ENTITLEMENTS_GRACE_DAYS`

Nie jest to klucz API. Stała konfiguracyjna dla resolvera (gdy wiersz ma `past_due` bez `grace_period_end`).

| Pole | Wartość |
|---|---|
| Nazwa | `ENTITLEMENTS_GRACE_DAYS` |
| Domyślna | `3` |
| Gdzie | Supabase Edge Function Secrets (dev / staging / prod osobno) |
| Dokumentacja operacyjna | Dodać wiersz do tabeli w [`docs/deployment/secrets-management.md`](../../deployment/secrets-management.md) |

Ustawienie przez CLI (nie commitować wartości w repo, mimo że nie jest sekretem wysokiego ryzyka):

```bash
supabase secrets set ENTITLEMENTS_GRACE_DAYS=3
```

W GitHub Actions: dodać do kroku „Set Edge Function secrets” w istniejącym workflow deploy, analogicznie do `NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE`.

Frontend Angular **nie** potrzebuje tej zmiennej (`src/environments/` bez zmian).

W PREM-001 grace prawie nie wystąpi (brak webhooka `past_due`); sekret jest po to, żeby model i resolver były kompletne przed PREM-006.

---

## 5. Krok 4 — Seed lokalny / testowy

Plik seed (np. `supabase/seeds/` lub rozszerzenie `01_seed_users.sql`) **po** insercie `auth.users` i repair `app_role`:

| Konto (istniejące) | Entitlements |
|---|---|
| `test@pychaswiatowa.pl` (`admin`) | wiersz default; resolver → Premium + admin |
| `test2@pychaswiatowa.pl` (`user`) | Free |

Opcjonalnie trzecie konto seed **tylko lokalnie**: `app_role = premium` + `admin_override` — do E2E guarda i asysty AI bez panelu admina.

Seed nie wstawia fałszywych `provider_subscription_id`.

Kolejność seedów: users → profiles (trigger) → **entitlements backfill/seed**, bo trigger na nowych insertach utworzy wiersz, a stare seedowane konta mogą wymagać `INSERT ... ON CONFLICT` jak w backfillu.

---

## 6. Krok 5 — Deploy aplikacji

### 6.1. Edge Functions

Redeploy co najmniej:

- `me` — nowy kształt `MeDto`,
- `ai` — gating `effective_tier`,
- `admin` — lista i `PATCH` roli.

Wspólny moduł `_shared/entitlements.ts` wchodzi w bundel tych funkcji (istniejący mechanizm `_shared`).

Kolejność na danym środowisku:

1. `supabase db push` (migracja + backfill).
2. `supabase secrets set ENTITLEMENTS_GRACE_DAYS=3` (jeśli jeszcze nie ma).
3. Deploy funkcji (`supabase functions deploy` / GitHub Actions).
4. Smoke: `GET /me` na koncie admina i usera; `GET /admin/users` zawiera nowe pola.

### 6.2. Frontend (Firebase Hosting)

Build i hosting jak dziś. Wdrożyć **po** API, inaczej stary frontend zignoruje `entitlements` (nieszkodliwe), ale nowy frontend na starym API rozjedzie się z `MeDto`.

Nie ma nowych zmiennych w `environment.prod.ts`.

### 6.3. Brak zmian

| Obszar | Status |
|---|---|
| Google OAuth / Cloud Console | Bez zmian |
| OpenAI / Gemini | Bez zmian |
| Clickio / Analytics | Bez zmian |
| Operator płatności (PayU / Stripe itd.) | Świadomie odłożony do PREM-005 |
| Custom Access Token Hook | Nie wdrażać — JWT zostaje cache |

---

## 7. Krok 6 — Weryfikacja po wdrożeniu

| Test | Oczekiwany wynik |
|---|---|
| Nowa rejestracja | Wiersz `account_entitlements` ze statusem `none`; `/me` → Free |
| Konto seed admin | `/me` → `effective_tier: premium`, `capabilities.admin: true` |
| Historyczne `premium` po backfillu | Override; asysta AI działa; `/settings` informuje o nadaniu przez admina |
| `PATCH` roli na `premium` | Override w bazie; lista admina zgodna |
| `PATCH` na `user` (były override) | Free; `POST /ai/recipes/image` → `403 FEATURE_LOCKED` |
| Stary JWT z claimem `premium` przy `grant_source = none` | `/me` i AI jak Free |
| Wejście na `/recipes/new/assist` jako Free | `/forbidden` |
| Gość | Brak wywołań entitlements; publiczne trasy bez zmian |
| RLS | Zalogowany A nie czyta wiersza B przez anon/authenticated client |

Po produkcji: porównać COUNT `account_entitlements` z COUNT `auth.users` (równość).

---

## 8. Bezpieczeństwo — podsumowanie

| Element | Działanie |
|---|---|
| Zapis entitlements | Tylko service role / RPC; klient nie UPDATE-uje tabeli |
| Odczyt | RLS: tylko własny `user_id`; admin lista przez service role |
| JWT | Nie przyznaje Premium; `admin` w JWT nadal chroni `/admin/*` |
| `provider_subscription_id` | Puste; nie eksponować w DTO |
| Grace days | Konfiguracja, nie tajemnica płatnicza; i tak trzymaj w secrets per środowisko |
| Backfill override | Świadome pozostawienie testerów na Premium; na produkcji zweryfikować listę `app_role = premium` przed push |

---

## 9. Lista kontrolna wdrożenia

- [ ] Migracja z enumami i tabelą `account_entitlements` zreviewowana
- [ ] RLS włączony: SELECT własny, brak zapisów dla `authenticated`
- [ ] `handle_new_user` tworzy wiersz entitlements
- [ ] RPC / `PATCH` roli aktualizuje entitlements w jednej operacji
- [ ] Backfill: każdy user ma wiersz; istniejące `premium` → `admin_override`
- [ ] Typy `database.types.ts` wygenerowane
- [ ] `ENTITLEMENTS_GRACE_DAYS=3` w secrets Edge Functions (każde środowisko)
- [ ] Wpis w `docs/deployment/secrets-management.md`
- [ ] Seed lokalny spójny z admin/user
- [ ] Deploy migracji **przed** funkcjami i frontendem
- [ ] Redeploy `me`, `ai`, `admin`
- [ ] Deploy Firebase Hosting
- [ ] Smoke `/me`, lista admina, gating AI, guard `/assist`
- [ ] COUNT entitlements = COUNT users na produkcji
