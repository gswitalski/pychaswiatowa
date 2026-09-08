# API Endpoints Implementation Plan: Jednolity model uprawnień

## 1. Przegląd punktów końcowych

### 1.1. Cel

Implementacja PREM-001 ma wprowadzić jedno serwerowe źródło prawdy o dostępie konta do funkcji Premium. Źródłem danych będzie tabela `public.account_entitlements`, a jedyną implementacją reguł biznesowych — współdzielony resolver `supabase/functions/_shared/entitlements.ts`.

JWT nadal dostarcza tożsamość `app_role`, w szczególności rolę `admin`, ale claim `premium` nie może samodzielnie przyznać funkcji Premium. Każdy chroniony endpoint AI musi ponownie pobrać stan konta i wyliczyć `effective_tier`.

### 1.2. Zakres HTTP

| Endpoint | Rodzaj zmiany | Cel |
|---|---|---|
| `GET /me` | rozszerzenie | Zwrócenie profilu wraz z kompletnym `EntitlementsDto` podczas bootstrapu aplikacji. |
| `GET /admin/users` | rozszerzenie | Dodanie efektywnego tieru, statusu subskrypcji, źródła grantu i daty końca okresu do każdego wiersza. |
| `PATCH /admin/users/{userId}/role` | rozszerzenie | Atomowa zmiana `app_role` i odpowiedniego admin override w entitlements. |
| `POST /ai/recipes/draft` | zmiana autoryzacji | Zastąpienie gatingu po claimie JWT gatingiem po `effective_tier`. |
| `POST /ai/recipes/image` | zmiana autoryzacji | Zastąpienie gatingu po claimie JWT gatingiem po `effective_tier`. |

`GET /entitlements` jest opcjonalnym aliasem opisanym w planie API, ale nie jest kryterium akceptacji PREM-001. W tej iteracji nie należy go implementować: `GET /me` zapewnia wymagany bootstrap, a pominięcie aliasu ogranicza liczbę funkcji i powierzchnię API. W razie późniejszej potrzeby odświeżania samych uprawnień endpoint ma zwracać bezpośrednio ten sam `EntitlementsDto` i korzystać z tego samego resolvera.

### 1.3. Reguły wyliczania

Resolver stosuje reguły w podanej kolejności:

1. `app_role = admin` daje `effective_tier = premium`, `capabilities.admin = true` i wszystkie funkcje Premium niezależnie od stanu subskrypcji.
2. `grant_source = admin_override` daje Premium.
3. `subscription_status = trial` lub `active` daje Premium, gdy `current_period_end` istnieje i `now < current_period_end`.
4. `subscription_status = past_due` daje Premium, gdy `now < grace_period_end`.
5. Jeśli dla `past_due` nie zapisano `grace_period_end`, resolver może użyć `current_period_end + ENTITLEMENTS_GRACE_DAYS`; wartość domyślna to 3 dni.
6. `subscription_status = canceled` daje Premium, gdy `now < current_period_end`.
7. Każdy inny stan daje `effective_tier = free`, również dla JWT z `app_role = premium`.

Porównania czasu muszą używać jednej wartości `now` przekazanej do resolvera, aby wynik nie zmienił się w trakcie pojedynczego żądania. Granica okresu jest wyłączna: dokładnie w `current_period_end` lub `grace_period_end` grant jest już nieważny.

## 2. Szczegóły żądań

Wszystkie endpointy wymagają `Authorization: Bearer <access_token>`. Edge Function najpierw weryfikuje token przez Supabase `getUser()`, a dopiero później używa zwalidowanych claimów. Nagłówka i tokenu nie wolno logować.

### 2.1. `GET /me`

- Metoda: `GET`
- Ścieżka Edge Function: `/functions/v1/me`
- Parametry ścieżki: brak
- Parametry query: brak
- Body: brak
- Wymagane dane: poprawny JWT zalogowanego użytkownika
- Opcjonalne dane: brak

Handler pozostaje w `supabase/functions/me/me.handlers.ts`. Powinien przekazać do serwisu zweryfikowane `user.id` oraz `jwtPayload.app_role`. Niezgodność `user.id` z `jwtPayload.sub` ma skutkować `ApplicationError('UNAUTHORIZED', ...)`, a nie ogólnym błędem.

### 2.2. `GET /admin/users`

- Metoda: `GET`
- Ścieżka: `/functions/v1/admin/users`
- Parametry ścieżki: brak
- Body: brak
- Wymagane dane: poprawny JWT z tożsamością `app_role = admin`
- Opcjonalne parametry query:
  - `page`: dodatnia liczba całkowita, domyślnie `1`
  - `page_size`: liczba całkowita `1..100`, domyślnie `25`
  - `sort_by`: `created_at | login | last_sign_in_at | recipes_count`, domyślnie `created_at`
  - `sort_dir`: `asc | desc`, domyślnie `desc`

Nowe pola entitlements nie zmieniają dozwolonych sortowań. `subscription_status` i `effective_tier` nie wchodzą do `AdminUsersSortBy` w PREM-001.

### 2.3. `PATCH /admin/users/{userId}/role`

- Metoda: `PATCH`
- Ścieżka: `/functions/v1/admin/users/{userId}/role`
- Wymagany parametr ścieżki:
  - `userId`: poprawny UUID istniejącego, nieusuniętego konta
- Wymagany body:

```json
{
    "app_role": "premium"
}
```

- `app_role`: dokładnie `user | premium | admin`
- Opcjonalne pola: brak; schemat Zod powinien być `.strict()`, aby odrzucić przypadkowe pola sterujące entitlements
- Wymagane dane uwierzytelniające: poprawny JWT z `app_role = admin`

Obowiązują istniejące reguły: zakaz zmiany własnej roli i zakaz degradacji ostatniego administratora.

### 2.4. `POST /ai/recipes/draft`

Kontrakt wejściowy `AiRecipeDraftRequestDto` pozostaje bez zmian:

- wariant tekstowy:
  - wymagane: `source = text`, `text`, `output_format = pycha_recipe_draft_v1`
  - opcjonalne: `language`
- wariant obrazu:
  - wymagane: `source = image`, `image.mime_type`, `image.data_base64`, `output_format = pycha_recipe_draft_v1`
  - opcjonalne: `language`

Istniejące walidacje Zod, MIME, base64 i rozmiaru obrazu pozostają. Przed parsowaniem kosztownego payloadu i przed wywołaniem dostawcy AI należy wyliczyć entitlements i odrzucić konto Free.

### 2.5. `POST /ai/recipes/image`

Kontrakt wejściowy `AiRecipeImageRequestDto` pozostaje bez zmian:

- wymagane: `recipe`, `output`, `output_format = pycha_recipe_image_v1`
- opcjonalne: `prompt_hint`, `language`, `mode`, `reference_image` oraz opcjonalne pola wewnątrz `recipe`

Istniejące walidacje rozmiaru payloadu, schematu Zod, dostępu do przepisu, obrazu referencyjnego i rate limitu pozostają. Gating entitlements powinien nastąpić bezpośrednio po uwierzytelnieniu, zanim backend pobierze plik ze Storage lub wykona kosztowne operacje AI.

## 3. Wykorzystywane typy i modele

### 3.1. Wspólne kontrakty

W `shared/contracts/types.ts` należy dodać:

```typescript
export type EffectiveTier = 'free' | 'premium';
export type SubscriptionStatus = 'none' | 'trial' | 'active' | 'past_due' | 'canceled';
export type GrantSource = 'none' | 'subscription' | 'trial' | 'admin_override';
export type CreditPoolCode = 'import_text_url' | 'import_image' | 'image_generate';

export interface CreditPoolDto {
    remaining: number;
    limit: number;
    reset_at: string | null;
}

export interface EntitlementsDto {
    app_role: AppRole;
    effective_tier: EffectiveTier;
    subscription_status: SubscriptionStatus;
    grant_source: GrantSource;
    current_period_end: string | null;
    grace_period_end: string | null;
    credits: Record<CreditPoolCode, CreditPoolDto>;
    capabilities: {
        ai_assist: boolean;
        ai_image: boolean;
        ads_disabled: boolean;
        admin: boolean;
    };
}
```

Pule kredytów w PREM-001 zawsze zwracają `{ remaining: 0, limit: 0, reset_at: null }`. Nie należy na ich podstawie odmawiać żądania ani zwracać `NO_CREDITS`.

Istniejące DTO należy rozszerzyć:

- `MeDto`: wymagane pole `entitlements: EntitlementsDto`; korzeniowe `app_role` pozostaje dla kompatybilności.
- `AdminUserListItemDto`: wymagane pola `subscription_status`, `grant_source`, `current_period_end`, `effective_tier`.
- `GetAdminUsersResponseDto` i `UpdateAdminUserRoleResponseDto`: zmiana pośrednia przez rozszerzony `AdminUserListItemDto`.

`UpdateAdminUserRoleCommand`, `AiRecipeDraftRequestDto` i `AiRecipeImageRequestDto` nie zmieniają kształtu.

### 3.2. Typy backendowe

W `supabase/functions/_shared/entitlements.ts` należy zdefiniować lub zaimportować:

- `AccountEntitlementsRow` z wygenerowanego `database.types.ts`;
- walidowane enumy Zod odpowiadające wartościom bazy;
- `ResolveEntitlementsParams` z nazwanymi polami: `userId`, `appRole`, `row`, `now`, `graceDays`;
- czystą funkcję `resolveEntitlements(params): EntitlementsDto`;
- funkcję odczytu, np. `getEntitlementsForUser({ userId, appRole })`, która używa klienta service role, mapuje wiersz i deleguje obliczenia do czystego resolvera.

Nie należy duplikować interfejsu `MeDto` w `me.service.ts` ani DTO admina w kilku warstwach, jeśli konfiguracja importów Deno pozwala użyć `shared/contracts/types.ts`. Jeżeli lokalne typy są wymagane przez bundler Edge Functions, muszą być strukturalnie zgodne i objęte testem kontraktowym.

### 3.3. Model danych

Migracja `supabase/migrations/YYYYMMDDHHMMSS_create_account_entitlements.sql` tworzy:

- enum `public.subscription_status`: `none`, `trial`, `active`, `past_due`, `canceled`;
- enum `public.grant_source`: `none`, `subscription`, `trial`, `admin_override`;
- tabelę `public.account_entitlements`:
  - `user_id uuid primary key references auth.users(id) on delete cascade`;
  - `subscription_status public.subscription_status not null default 'none'`;
  - `grant_source public.grant_source not null default 'none'`;
  - `current_period_end timestamptz null`;
  - `grace_period_end timestamptz null`;
  - `trial_used boolean not null default false`;
  - `provider_subscription_id text null`;
  - `created_at timestamptz not null default now()`;
  - `updated_at timestamptz not null default now()`.

Należy dodać trigger `updated_at`, komentarze SQL i ograniczenia spójności, które nie blokują przyszłych webhooków. Minimum: `grace_period_end` ma znaczenie tylko dla `past_due`, a `provider_subscription_id` nie jest eksponowany w żadnym DTO PREM-001.

Po migracji trzeba zregenerować `shared/types/database.types.ts` oraz `supabase/functions/_shared/database.types.ts` zgodnie z istniejącymi skryptami projektu.

## 4. Szczegóły odpowiedzi

### 4.1. `GET /me`

`200 OK`:

```json
{
    "id": "c553b8d1-3dbb-488f-b610-97eb6f95d357",
    "username": "ania",
    "app_role": "user",
    "entitlements": {
        "app_role": "user",
        "effective_tier": "free",
        "subscription_status": "none",
        "grant_source": "none",
        "current_period_end": null,
        "grace_period_end": null,
        "credits": {
            "import_text_url": { "remaining": 0, "limit": 0, "reset_at": null },
            "import_image": { "remaining": 0, "limit": 0, "reset_at": null },
            "image_generate": { "remaining": 0, "limit": 0, "reset_at": null }
        },
        "capabilities": {
            "ai_assist": false,
            "ai_image": false,
            "ads_disabled": false,
            "admin": false
        }
    }
}
```

Kody: `200`, `401`, `404`, `405`, `500`.

Brak wiersza `account_entitlements` daje poprawny `200` z fallbackiem Free oraz log `warn`; nie jest błędem klienta ani `500`.

### 4.2. `GET /admin/users`

`200 OK` zachowuje obecną otoczkę `data`, `pagination`, `sorting`. Każdy element `data` otrzymuje:

```json
{
    "subscription_status": "none",
    "grant_source": "admin_override",
    "current_period_end": null,
    "effective_tier": "premium"
}
```

Kody: `200`, `400`, `401`, `403`, `405`, `500`.

Brak entitlements pojedynczego konta na liście powinien być mapowany do Free i zalogowany jako warning. Endpoint nie może ujawniać `raw_app_meta_data`, `trial_used`, `provider_subscription_id`, tokenów ani danych operatora płatności.

### 4.3. `PATCH /admin/users/{userId}/role`

`200 OK`:

```json
{
    "user": {
        "id": "7c8966c3-bc93-4bda-bcd1-bdcfd2af7b99",
        "login": "ania@example.com",
        "username": "ania",
        "role": "premium",
        "created_at": "2026-04-10T12:00:00.000Z",
        "last_sign_in_at": "2026-08-18T10:00:00.000Z",
        "recipes_count": 12,
        "subscription_status": "none",
        "grant_source": "admin_override",
        "current_period_end": null,
        "effective_tier": "premium"
    }
}
```

Kody: `200`, `400`, `401`, `403`, `404`, `405`, `409`, `500`.

Endpoint aktualizuje istniejący zasób, dlatego poprawnym kodem sukcesu jest `200`, nie `201`.

### 4.4. Endpointy AI

Kształty odpowiedzi sukcesu nie zmieniają się. Oba endpointy nadal zwracają `200`, ponieważ generują odpowiedź, ale nie tworzą trwałego zasobu REST.

Konto bez Premium otrzymuje `403 Forbidden` w istniejącym płaskim formacie błędów:

```json
{
    "code": "FEATURE_LOCKED",
    "message": "Ta funkcja wymaga planu Premium."
}
```

Należy ujednolicić przykład z planu API z faktycznym projektem: `handleError()` zwraca obecnie `{ code, message }`, więc nie wprowadzać wyłącznie dla tego błędu zagnieżdżenia `{ error: ... }`.

Pozostałe istniejące kody (`400`, `401`, `404`, `413`, `422`, `429`, `500`) pozostają. PREM-001 nie wprowadza `402` ani `NO_CREDITS`.

## 5. Przepływ danych

### 5.1. Migracja, trigger i backfill

1. Utworzyć enumy, tabelę, RLS i politykę SELECT własnego wiersza.
2. Nie tworzyć polityk INSERT/UPDATE/DELETE dla `anon` ani `authenticated`; zapis jest dostępny tylko dla service role i kontrolowanych RPC.
3. Rozszerzyć `public.handle_new_user()`, aby tworzył domyślny wiersz entitlements przez `INSERT ... ON CONFLICT DO NOTHING`.
4. Backfillować wiersz dla każdego `auth.users`.
5. Dla historycznego `app_role = premium` ustawić `grant_source = admin_override` i pozostawić `subscription_status = none`.
6. Dla `admin`, `user`, braku roli lub wartości nieznanej pozostawić domyślne `none/none`.
7. Backfill musi być idempotentny i działać w tej samej migracji przed wdrożeniem nowych Edge Functions.

### 5.2. Wspólny resolver

1. `getEntitlementsForUser` pobiera wyłącznie wymagane kolumny przez service role.
2. Błąd zapytania do bazy powoduje `ApplicationError('INTERNAL_ERROR', ...)`.
3. Brak wiersza jest rozróżniany od błędu bazy i daje syntetyczny stan Free.
4. Wartości enumów i timestampów są mapowane defensywnie; niespójny wiersz nie może przyznać Premium.
5. `resolveEntitlements` oblicza tier i capabilities bez I/O.
6. `credits` budowane są przez jedną stałą/fabrykę, aby wszystkie trzy pule były zawsze obecne.
7. Resolver nie zapisuje automatycznie stanu wygasłego. Wylicza aktualny wynik na podstawie czasu, dzięki czemu nie wymaga crona.

### 5.3. `GET /me`

1. Handler sprawdza nagłówek, claimy, podpis tokenu i zgodność `sub`.
2. `me.service.ts` pobiera profil przez uwierzytelnionego klienta.
3. Serwis pobiera wiersz entitlements przez współdzielony odczyt.
4. Resolver dostaje rolę JWT jako tożsamość, ale grant Premium ustala z wiersza.
5. Serwis zwraca `MeDto` z korzeniowym `app_role` oraz `entitlements`.

Profil i entitlements można pobrać równolegle po zakończeniu uwierzytelnienia. Błąd profilu nadal daje `404`; brak samego wiersza entitlements daje fallback Free.

### 5.4. `GET /admin/users`

1. `requireAdminContext()` zachowuje kontrolę `app_role = admin`.
2. Zod waliduje parametry query.
3. `admin_get_users_page` zostaje rozszerzone o LEFT JOIN do `account_entitlements` i zwraca surowe pola potrzebne do wyliczenia tieru.
4. Zapytanie nadal agreguje liczbę przepisów raz i zachowuje stabilne sortowanie/paginację.
5. `admin.service.ts` mapuje każdy wiersz przez tę samą czystą funkcję `resolveEntitlements`.
6. DTO listy otrzymuje tylko cztery zatwierdzone pola entitlements.

Nie wykonywać osobnego zapytania na użytkownika. Preferowana jest jedna rozszerzona funkcja RPC, aby uniknąć N+1.

### 5.5. `PATCH /admin/users/{userId}/role`

Rozszerzyć najnowszą wersję RPC `public.admin_update_user_role`, zachowując `SECURITY DEFINER`, `search_path = public`, `row_security = off`, allowlistę ról, advisory lock, self-change i last-admin guard.

W jednej transakcji:

1. Zablokować i odczytać konto docelowe.
2. Zmienić `auth.users.raw_app_meta_data.app_role`.
3. Wykonać UPSERT `account_entitlements`:
   - `premium`: ustawić `grant_source = admin_override`; nie zmieniać statusu ani dat subskrypcji;
   - `user`: zmienić grant na `none` tylko wtedy, gdy obecnie jest `admin_override`; zachować `subscription`, `trial`, statusy i daty;
   - `admin`: zapewnić istnienie wiersza; usunąć pozostały `admin_override`, ponieważ Premium wynika z tożsamości admina, ale nie kasować przyszłej subskrypcji/trialu.
4. Zwrócić rozszerzony wiersz wraz z danymi do wyliczenia entitlements.
5. W serwisie zmapować odpowiedź przez resolver i zwrócić aktualny `AdminUserListItemDto`.

Każdy wyjątek cofa obie zmiany. Nie wolno zastąpić RPC dwoma niezależnymi wywołaniami Edge Function.

### 5.6. Endpointy AI

1. Zweryfikować JWT i zgodność `user.id` z `sub`.
2. Pobrać i rozwiązać entitlements.
3. Gdy odpowiednia capability jest `false`, zwrócić `403 FEATURE_LOCKED`:
   - draft: `capabilities.ai_assist`;
   - image: `capabilities.ai_image`.
4. Dopiero potem parsować duży payload, pobierać obraz, wykonywać rate limiting i wywoływać dostawcę AI.
5. Zachować wszystkie dalsze walidacje i odpowiedzi endpointów.

Wydzielić pomocnik, np. `requirePremiumCapability({ userId, appRole, capability })`, aby draft i image nie powielały odczytu oraz mapowania błędu. Pomocnik ma korzystać z resolvera, nie z samego claimu.

## 6. Względy bezpieczeństwa

1. **Weryfikacja JWT:** odkodowanie claimów nie jest weryfikacją podpisu. Każdy handler musi najpierw lub równolegle użyć `getAuthenticatedContext()` i porównać `user.id` z `sub`.
2. **Rozdział tożsamości i dostępu:** tylko `app_role = admin` otwiera `/admin/*`; `effective_tier = premium` nie daje praw administracyjnych.
3. **Brak zaufania do JWT Premium:** `app_role = premium` bez ważnego grantu zawsze daje Free.
4. **RLS:** użytkownik może SELECT tylko własnego `account_entitlements`; nie może sam nadać sobie override ani modyfikować dat.
5. **Service role:** klucz pozostaje wyłącznie po stronie Edge Functions. Nie wolno umieszczać go w odpowiedzi, logach ani frontendzie.
6. **RPC administracyjne:** execute tylko dla `service_role`; funkcja ma stały `search_path`, waliduje enum i nie interpoluje sortowania ani identyfikatorów do dynamicznego SQL.
7. **Minimalizacja danych:** lista admina nie zwraca metadanych auth, `provider_subscription_id` ani `trial_used`.
8. **Fail closed:** niepoprawne enumy, timestampy i błędy bazy nie mogą przypadkowo dać Premium. Fallback Free jest dozwolony wyłącznie dla jednoznacznego braku wiersza, nie dla awarii zapytania.
9. **Brak eskalacji przez body:** `PATCH` przyjmuje tylko `app_role`; klient nie może przesłać `grant_source`, statusu ani dat.
10. **Ochrona kosztów:** gating AI następuje przed pobraniem Storage i wywołaniem modeli. Istniejący rate limit pozostaje dodatkową warstwą.
11. **Logi:** nie zapisywać JWT, e-maili, base64 obrazów, pełnych promptów, identyfikatorów operatora ani danych subskrypcji. Dopuszczalne są UUID użytkownika, kod operacji, rola, wynik tieru, status HTTP i czas wykonania.
12. **CORS i metody:** zachować obsługę OPTIONS i ograniczyć `Allow` do faktycznie wspieranych metod.

## 7. Obsługa błędów

### 7.1. Macierz błędów

| Status | Kod | Warunek |
|---|---|---|
| `400` | `VALIDATION_ERROR` | Niepoprawny UUID, query, JSON lub `app_role`; istniejące błędy walidacji AI. |
| `401` | `UNAUTHORIZED` | Brak, zły format, nieważny lub wygasły JWT; brak wymaganych claimów; rozbieżność `sub`. |
| `403` | `ADMIN_ROLE_REQUIRED` lub `FORBIDDEN` | Konto nie jest adminem przy `/admin/*`. |
| `403` | `FEATURE_LOCKED` | `effective_tier`/capability nie pozwala na wskazaną funkcję AI. |
| `404` | `NOT_FOUND` | Brak profilu w `/me` albo brak konta docelowego w `PATCH`; istniejące błędy zasobów AI. |
| `409` | `CONFLICT` | Próba zmiany własnej roli lub degradacji ostatniego admina. |
| `405` | `METHOD_NOT_ALLOWED` | Nieobsługiwana metoda; odpowiedź zawiera nagłówek `Allow`. |
| `413` | `PAYLOAD_TOO_LARGE` | Istniejące limity payloadu/obrazu AI. |
| `422` | `UNPROCESSABLE_ENTITY` | Istniejące semantycznie nieprzetwarzalne dane AI. |
| `429` | `TOO_MANY_REQUESTS` | Istniejący rate limit AI, wraz z `Retry-After`. |
| `500` | `INTERNAL_ERROR` | Awaria bazy, RPC, mapowania lub resolvera. |

Nie dodawać `402 NO_CREDITS` w PREM-001.

### 7.2. Logowanie i tabela błędów

Projekt nie posiada tabeli błędów ani wymagania jej utworzenia. Błędy należy rejestrować przez istniejący strukturalny `logger` w logach Supabase Edge Functions:

- `info`: rozpoczęcie i pomyślne zakończenie operacji z czasem wykonania;
- `warn`: brak wiersza entitlements, odmowa Premium, walidacja, self-change, last-admin, nieznane wartości mapowane do bezpiecznego stanu;
- `error`: błędy zapytań, RPC, niespójny zwrot z bazy i nieoczekiwane wyjątki.

Kontekst powinien zawierać `userId` lub `targetUserId`, nazwę endpointu, kod błędu i bezpieczne metadane. Nie należy tworzyć tabeli `error_logs` w ramach PREM-001. Jeśli później powstanie trwały audyt, historia zmian grantów wymaga osobnego modelu i ticketu.

`ErrorCode` w `supabase/functions/_shared/errors.ts` należy rozszerzyć o `FEATURE_LOCKED` mapowane na `403`. Dla kompatybilności admina można zachować `FORBIDDEN` jako kod HTTP warstwy ogólnej albo jawnie dodać `ADMIN_ROLE_REQUIRED`; wybór musi być spójny między implementacją, testami i klientem.

## 8. Wydajność

1. Odczyt sesji korzysta z PK `account_entitlements(user_id)` i wymaga jednego wiersza; dodatkowy indeks nie jest potrzebny.
2. Resolver pozostaje czystą operacją O(1), bez dodatkowych zapytań.
3. `GET /admin/users` używa jednego LEFT JOIN/RPC, bez N+1. Wyliczenie tieru dla maksymalnie 100 rekordów w TypeScript jest pomijalne.
4. Zapytania pobierają tylko potrzebne kolumny; `provider_subscription_id` i pola audytowe nie trafiają do listy.
5. Nie cache'ować wyniku Premium między żądaniami Edge Functions. Poprawność wygasania okresu jest ważniejsza niż oszczędność pojedynczego odczytu po PK.
6. W obrębie jednego żądania resolver jest wywoływany raz. Wynik można przekazywać dalej do handlera i serwisu.
7. Gating AI przed dekodowaniem base64, pobraniem Storage i wywołaniem modelu ogranicza CPU, transfer i koszty.
8. Brak cronów do wygaszania: tier jest liczony względem czasu żądania.
9. Po wdrożeniu obserwować czas `GET /me`, `GET /admin/users` i odsetek fallbacków brakującego wiersza. Fallback powinien być sytuacją wyjątkową po backfillu.

## 9. Etapy wdrożenia

1. **Dodać migrację modelu danych.**
   - Utworzyć enumy, tabelę, komentarze, trigger `updated_at`, RLS i politykę SELECT własnego wiersza.
   - Rozszerzyć `handle_new_user()` o idempotentny insert.
   - Dodać backfill wszystkich kont i mapowanie historycznego `premium` na `admin_override`.
   - Zweryfikować, że liczba wierszy entitlements równa się liczbie aktywnych kont.

2. **Rozszerzyć RPC administracyjne.**
   - Zaktualizować najnowszą definicję `admin_get_users_page`.
   - Zaktualizować najnowszą definicję `admin_update_user_role`, zachowując poprawkę niejednoznacznych kolumn z migracji `20260804210000`.
   - Zapewnić atomowość metadata i entitlements.
   - Ograniczyć `EXECUTE` do `service_role`.

3. **Regenerować typy bazy.**
   - Zaktualizować oba używane pliki `database.types.ts`.
   - Sprawdzić typ enumów i nullable timestampów.

4. **Rozszerzyć kontrakty API.**
   - Dodać typy entitlements i pul kredytów w `shared/contracts/types.ts`.
   - Rozszerzyć `MeDto` i `AdminUserListItemDto`.
   - Zaktualizować lokalne typy Edge Functions i fixture testowe.

5. **Zaimplementować współdzielony resolver.**
   - Utworzyć `supabase/functions/_shared/entitlements.ts`.
   - Oddzielić odczyt wiersza od czystego wyliczenia.
   - Bezpiecznie parsować `ENTITLEMENTS_GRACE_DAYS`; brak, NaN, wartość ujemna lub nierozsądnie duża ma dawać domyślne `3`.
   - Dodać fabrykę zerowych pul i capabilities.

6. **Dodać testy jednostkowe resolvera.**
   - Admin bez subskrypcji.
   - Admin z dowolnym niespójnym statusem.
   - Override.
   - Trial i active przed oraz dokładnie na/po końcu.
   - Past due z zapisanym grace przed oraz na/po końcu.
   - Past due bez grace i fallback konfiguracji.
   - Canceled przed oraz na/po końcu.
   - JWT premium bez grantu.
   - Brak wiersza.
   - Niepoprawne daty i wartości konfiguracji.

7. **Rozszerzyć `GET /me`.**
   - Zmienić `me.service.ts`, aby zwracał `EntitlementsDto`.
   - Użyć service role tylko do entitlements, zachowując obecny odczyt profilu.
   - Zmienić mismatch `sub` na `401`.
   - Dodać testy `200`, `401`, `404`, awarii bazy i fallbacku Free.

8. **Rozszerzyć listę admina.**
   - Dodać pola do RPC row, mapperów i DTO w `admin.types.ts`/`admin.service.ts`.
   - Wyliczać `effective_tier` wspólnym resolverem.
   - Dodać testy autoryzacji, query, paginacji, brakującego wiersza i braku N+1.

9. **Rozszerzyć zmianę roli.**
   - Zastosować semantykę `premium`, `user`, `admin` w RPC.
   - Zwrócić rozszerzony wiersz.
   - Dodać testy atomowości, self-change, last-admin, 404 i zachowania przyszłej subskrypcji/trialu przy zmianie na `user`.

10. **Zmienić gating AI.**
    - Zastąpić oba warunki `jwtPayload.app_role === 'user'`.
    - Współdzielić helper capability.
    - Zwracać `403 FEATURE_LOCKED`.
    - Zachować obecne walidacje, rate limit i statusy sukcesu.
    - Dodać przypadki: Free, stary JWT premium bez grantu, override, ważna subskrypcja, admin i brak `NO_CREDITS`.

11. **Dodać testy integracyjne bazy i API.**
    - RLS: użytkownik A nie czyta ani nie modyfikuje wiersza B.
    - Trigger rejestracji tworzy dokładnie jeden wiersz.
    - Backfill jest idempotentny.
    - RPC cofa oba zapisy po błędzie.
    - Odpowiedzi są zgodne z `shared/contracts/types.ts`.

12. **Skonfigurować i wdrożyć.**
    - Ustawić `ENTITLEMENTS_GRACE_DAYS=3` per środowisko.
    - Wdrożyć migrację i backfill przed kodem funkcji.
    - Redeploy funkcji `me`, `admin`, `ai`.
    - Dopiero potem wdrożyć frontend korzystający z nowego wymaganego pola `MeDto.entitlements`.

13. **Wykonać smoke testy po wdrożeniu.**
    - Nowy user: `/me` zwraca Free.
    - Admin: `/me` zwraca Premium i `capabilities.admin = true`.
    - Historyczne premium: override i dostęp AI.
    - PATCH premium/user: natychmiast spójny wiersz listy i odpowiedni gating AI.
    - JWT premium bez grantu: `403 FEATURE_LOCKED`.
    - `GET /admin/users`: pola obecne, brak danych wrażliwych.
    - COUNT entitlements odpowiada COUNT użytkowników.

14. **Kryterium ukończenia.**
    - Wszystkie ścieżki premium backendu korzystają z jednego resolvera.
    - Żaden endpoint AI nie przyznaje dostępu wyłącznie na podstawie JWT `premium`.
    - Zmiana roli i override jest atomowa.
    - Kontrakty, migracje, testy oraz logi są spójne, a opcjonalny `GET /entitlements` pozostaje świadomie poza zakresem PREM-001.
