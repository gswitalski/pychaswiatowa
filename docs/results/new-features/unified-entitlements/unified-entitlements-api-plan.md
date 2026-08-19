# Jednolity model uprawnień — plan API

## 1. Przegląd zmian

Warstwa HTTP pozostaje przy **Supabase Edge Functions**. Źródłem prawdy jest tabela `account_entitlements` oraz wspólny resolver. Klient nie odczytuje entitlements bezpośrednio z JWT ani z tabeli — wyłącznie przez API.

| Operacja | Typ | Zmiana |
|---|---|---|
| `GET /me` | Istniejący endpoint | Rozszerzenie odpowiedzi o obiekt `entitlements` (bootstrap App Shell). |
| `GET /entitlements` | Nowy endpoint (opcjonalny alias) | Ten sam payload `entitlements` co w `/me`, bez pól profilu. |
| `GET /admin/users` | Istniejący endpoint | Dodane pola statusu subskrypcji, grantu i `effective_tier`. |
| `PATCH /admin/users/{userId}/role` | Istniejący endpoint | Atomowy zapis `app_role` **oraz** wiersza entitlements (override / clear). |
| `POST /ai/recipes/draft` | Istniejący endpoint | Gating po `effective_tier`, nie wyłącznie po JWT `app_role`. |
| `POST /ai/recipes/image` | Istniejący endpoint | Jak wyżej. |
| Resolver `_shared/entitlements.ts` | Nowy moduł | Jedna funkcja wyliczania uprawnień dla `me`, `ai`, `admin`. |

Autoryzacja: prywatne endpointy wymagają `Authorization: Bearer <token>`. Gość nie wywołuje resolvera.

---

## 2. Model danych (kontrakt)

### 2.1. Typy

| Typ | Wartości |
|---|---|
| `AppRole` | `user` \| `premium` \| `admin` (bez zmian) |
| `EffectiveTier` | `free` \| `premium` |
| `SubscriptionStatus` | `none` \| `trial` \| `active` \| `past_due` \| `canceled` |
| `GrantSource` | `none` \| `subscription` \| `trial` \| `admin_override` |
| `CreditPoolCode` | `import_text_url` \| `import_image` \| `image_generate` |

### 2.2. Obiekt `EntitlementsDto`

```json
{
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
```

| Pole | Typ | Opis |
|---|---|---|
| `app_role` | `AppRole` | Tożsamość z `raw_app_meta_data` (cache JWT). |
| `effective_tier` | `EffectiveTier` | Wynik resolvera — to pole UI i backendu używają do gatingu Premium. |
| `subscription_status` | `SubscriptionStatus` | Stan cyklu rozliczeniowego; `none` gdy brak subskrypcji i trialu. |
| `grant_source` | `GrantSource` | Dlaczego konto ma (albo nie ma) Premium. |
| `current_period_end` | `string \| null` | ISO-8601; koniec opłaconego okresu / trialu. |
| `grace_period_end` | `string \| null` | ISO-8601; wypełnione przy `past_due`. |
| `credits.*.remaining` | `number` | W PREM-001 zawsze `0`. |
| `credits.*.limit` | `number` | W PREM-001 zawsze `0`. |
| `credits.*.reset_at` | `string \| null` | W PREM-001 zawsze `null`. |
| `capabilities.ai_assist` | `boolean` | `true` gdy `effective_tier = premium`. |
| `capabilities.ai_image` | `boolean` | `true` gdy `effective_tier = premium`. |
| `capabilities.ads_disabled` | `boolean` | `true` gdy `effective_tier = premium`. |
| `capabilities.admin` | `boolean` | `true` wyłącznie gdy `app_role = admin`. |

Nazwy pól snake_case, spójne z istniejącymi DTO (`MeDto`, `AdminUserListItemDto`).

### 2.3. Przykłady odpowiedzi entitlements

Konto Free (nowa rejestracja):

```json
{
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
```

Konto z JWT `premium` bez grantu (stary token, wygasła subskrypcja) — serwer zwraca Free:

```json
{
    "app_role": "premium",
    "effective_tier": "free",
    "subscription_status": "canceled",
    "grant_source": "none",
    "current_period_end": "2026-07-01T00:00:00.000Z",
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
```

Admin (bez subskrypcji):

```json
{
    "app_role": "admin",
    "effective_tier": "premium",
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
        "ai_assist": true,
        "ai_image": true,
        "ads_disabled": true,
        "admin": true
    }
}
```

Override nadany przez admina:

```json
{
    "app_role": "premium",
    "effective_tier": "premium",
    "subscription_status": "none",
    "grant_source": "admin_override",
    "current_period_end": null,
    "grace_period_end": null,
    "credits": {
        "import_text_url": { "remaining": 0, "limit": 0, "reset_at": null },
        "import_image": { "remaining": 0, "limit": 0, "reset_at": null },
        "image_generate": { "remaining": 0, "limit": 0, "reset_at": null }
    },
    "capabilities": {
        "ai_assist": true,
        "ai_image": true,
        "ads_disabled": true,
        "admin": false
    }
}
```

`past_due` w trakcie grace:

```json
{
    "app_role": "premium",
    "effective_tier": "premium",
    "subscription_status": "past_due",
    "grant_source": "subscription",
    "current_period_end": "2026-08-19T00:00:00.000Z",
    "grace_period_end": "2026-08-22T00:00:00.000Z",
    "credits": {
        "import_text_url": { "remaining": 0, "limit": 0, "reset_at": null },
        "import_image": { "remaining": 0, "limit": 0, "reset_at": null },
        "image_generate": { "remaining": 0, "limit": 0, "reset_at": null }
    },
    "capabilities": {
        "ai_assist": true,
        "ai_image": true,
        "ads_disabled": true,
        "admin": false
    }
}
```

---

## 3. Zmieniony endpoint: `GET /me`

**Metoda:** `GET`  
**URL:** `/me`  
**Typ:** Edge Function `me`  
**Istniejący obszar:** `supabase/functions/me/`  
**Dostęp:** zalogowany użytkownik (JWT)

### 3.1. Żądanie

Brak parametrów i body. Nagłówek `Authorization: Bearer <access_token>`.

### 3.2. Odpowiedź `200 OK`

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

Pole `app_role` na korzeniu `MeDto` zostaje dla kompatybilności wstecznej (Topbar, `adminRoleMatchGuard`). Źródłem gatingu Premium jest `entitlements.effective_tier`, nie korzeniowe `app_role`.

### 3.3. Przebieg po stronie serwera

1. Walidacja JWT (`supabase/functions/_shared/auth.ts`) — jak dziś.
2. Odczyt profilu (`id`, `username`) z `profiles` — jak dziś.
3. Wywołanie `resolveEntitlements(userId, jwtAppRole)` z `_shared/entitlements.ts`:
    - odczyt wiersza `account_entitlements` (service role lub RPC),
    - jeśli wiersza brak — traktuj jak `subscription_status = none`, `grant_source = none` (i zaloguj warning; trigger powinien zawsze tworzyć wiersz),
    - wylicz `effective_tier` i `capabilities` według algorytmu z wymagań.
4. Zwróć `MeDto` z zagnieżdżonym `entitlements`.
5. **Nie** ufaj `jwtAppRole === 'premium'` przy ustawianiu `effective_tier`.

### 3.4. Kody błędów

| Kod | Warunek | Kod błędu |
|---|---|---|
| `200 OK` | Profil i entitlements zwrócone. | — |
| `401 Unauthorized` | Brak / nieważny JWT. | `UNAUTHORIZED` |
| `404 Not Found` | Brak wiersza w `profiles`. | `NOT_FOUND` |
| `500 Internal Server Error` | Błąd bazy lub resolvera. | `INTERNAL_ERROR` |

Brak wiersza `account_entitlements` nie powinien kończyć się 500 dla użytkownika — fallback Free + log.

---

## 4. Nowy endpoint (opcjonalny alias): `GET /entitlements`

**Metoda:** `GET`  
**URL:** `/entitlements`  
**Dostęp:** zalogowany użytkownik  
**Cel:** odświeżenie uprawnień bez pełnego profilu (np. po powrocie z tła).

### Odpowiedź `200 OK`

Ten sam obiekt `EntitlementsDto` co pole `entitlements` w `/me` (bez opakowania).

Implementacja: ta sama funkcja resolvera. Może być zrealizowana jako osobna Edge Function albo dodatkowa trasa przy `me`. Jeśli koszt utrzymania dwóch funkcji jest zbędny, **wystarczy `GET /me`** — alias nie jest kryterium akceptacji PREM-001.

| Kod | Warunek |
|---|---|
| `200 OK` | Entitlements wyliczone. |
| `401 Unauthorized` | Brak JWT. |
| `500` | Błąd resolvera (z fallbackiem Free tam, gdzie to bezpieczne). |

---

## 5. Zmieniony endpoint: `GET /admin/users`

**Metoda:** `GET`  
**URL:** `/admin/users`  
**Dostęp:** tylko `admin`  
**Istniejący obszar:** `supabase/functions/admin/`

Parametry paginacji i sortowania bez zmian (`page`, `page_size`, `sort_by`, `sort_dir`). Sortowanie po nowym `subscription_status` **nie** jest wymagane w PREM-001.

### 5.1. Rozszerzenie `AdminUserListItemDto`

Istniejące pola (`id`, `login`, `username`, `role`, `created_at`, `last_sign_in_at`, `recipes_count`) pozostają. Dodane:

| Pole | Typ | Opis |
|---|---|---|
| `subscription_status` | `SubscriptionStatus` | Stan z `account_entitlements`. |
| `grant_source` | `GrantSource` | Źródło grantu. |
| `current_period_end` | `string \| null` | Koniec okresu. |
| `effective_tier` | `EffectiveTier` | Wynik resolvera (ten sam algorytm). |

Przykładowy wiersz:

```json
{
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
```

Lista wykonuje JOIN / batch-odczyt `account_entitlements` w kontekście service role. Nie wolno zwracać `raw_app_meta_data`, tokenów operatora ani przyszłych `provider_subscription_id` w PREM-001 (kolumna może istnieć w bazie jako `null`, ale nie wchodzi do DTO listy).

Kody błędów bez zmian: `401`, `403 ADMIN_ROLE_REQUIRED`.

---

## 6. Zmieniony endpoint: `PATCH /admin/users/{userId}/role`

**Metoda:** `PATCH`  
**URL:** `/admin/users/{userId}/role`  
**Dostęp:** tylko `admin`  
**Body:** bez zmian — `{ "app_role": "user" | "premium" | "admin" }`

### 6.1. Dodatkowa semantyka entitlements

Istniejące zabezpieczenia (samomodyfikacja, ostatni admin, walidacja UUID) pozostają. Po udanej zmianie `raw_app_meta_data.app_role` backend **w tej samej operacji** aktualizuje `account_entitlements`:

| Nowa `app_role` | Działanie na entitlements |
|---|---|
| `premium` | `grant_source = admin_override`. `subscription_status` **nie** jest ustawiane na `active`. Daty okresu bez zmian (zwykle `null`). |
| `user` | Jeśli `grant_source` było `admin_override` → ustaw `none`. Jeśli `grant_source` to `subscription` lub `trial` — **nie kasuj** subskrypcji; `effective_tier` dalej wynika z dat i statusu. `app_role` w JWT/metadata = `user`. |
| `admin` | `app_role = admin`. Wiersz entitlements musi istnieć (status może zostać `none`). Override nie jest wymagany — Premium wynika z tożsamości admina. |

Odpowiedź `200 OK` zwraca `user: AdminUserListItemDto` już z nowymi polami entitlements (ten sam kształt co lista).

### 6.2. Przebieg (rozszerzony)

Kroki 1–6 jak w istniejącym planie edycji ról (JWT admin, Zod, zakaz self-change, ochrona ostatniego admina, 404).

7. W jednej transakcji / RPC:
    - aktualizacja `app_role` w `auth.users` (jak dziś `admin.updateUserById` albo istniejące RPC `admin_update_user_role`),
    - UPSERT `account_entitlements` według tabeli powyżej.
8. Odczyt zmapowanego użytkownika (rola + entitlements) i zwrot `200`.

Rozjazd metadata vs entitlements jest błędem implementacji — klient nie składa dwóch osobnych zapisów.

Kody błędów bez zmian (`400`, `401`, `403`, `404`, `409`, `500`).

---

## 7. Wspólny resolver

**Nowy plik:** `supabase/functions/_shared/entitlements.ts`

```typescript
function resolveEntitlements(
    userId: string,
    appRole: AppRole,
    row: AccountEntitlementsRow | null,
    now: Date,
    graceDays: number
): EntitlementsDto
```

Zasady:

- Jedyna implementacja algorytmu z dokumentu wymagań (sekcja 4.1).
- `ai.handlers.ts` **zastępuje** warunek `jwtPayload.app_role === 'user'` wywołaniem resolvera: odmowa gdy `effective_tier !== 'premium'`.
- Dostęp do `/admin/*` nadal: `jwtPayload.app_role !== 'admin'` → `403 ADMIN_ROLE_REQUIRED`. Resolver nie otwiera panelu admina.
- Testy jednostkowe resolvera pokrywają: admin bez subskrypcji, override, trial w terminie, trial po dacie, `active`, `past_due` w grace i po grace, `canceled` przed i po `current_period_end`, JWT `premium` + brak grantu → Free, brak wiersza → Free.

Konfiguracja grace: zmienna środowiskowa Edge Functions `ENTITLEMENTS_GRACE_DAYS` (domyślnie `3`). Resolver używa zapisane `grace_period_end` z wiersza, jeśli jest niepuste; w przeciwnym razie może wyliczyć `current_period_end + graceDays` wyłącznie gdy status to `past_due` (PREM-006 będzie zapisywać datę przy wejściu w windykację).

---

## 8. Zmienione endpointy AI

**Istniejący obszar:** `supabase/functions/ai/ai.handlers.ts`

Dziś:

```
jeśli jwtPayload.app_role === 'user' → 403
```

Docelowo:

1. Walidacja JWT (sesja wymagana) — bez zmian.
2. `resolveEntitlements(...)`.
3. Jeśli `effective_tier !== 'premium'` → `403 Forbidden` z kodem `FEATURE_LOCKED`.
4. Rate limit i reszta logiki — bez zmian.
5. **Nie** zwracać `402` ani `NO_CREDITS` w PREM-001 (pule są zerowe w kontrakcie, ale ledger nie działa).

Treść błędu (istniejący format Edge Functions), przykładowo:

```json
{
    "error": {
        "code": "FEATURE_LOCKED",
        "message": "Ta funkcja wymaga planu Premium."
    }
}
```

To samo dla `POST /ai/recipes/draft` i `POST /ai/recipes/image`. Import Markdown (`POST /recipes/import`) pozostaje dostępny dla każdego zalogowanego — bez zmian.

---

## 9. Zmiany w kontraktach i kliencie

| Obszar | Planowana zmiana |
|---|---|
| `shared/contracts/types.ts` | Dodać `EffectiveTier`, `SubscriptionStatus`, `GrantSource`, `CreditPoolDto`, `EntitlementsDto`; rozszerzyć `MeDto` o `entitlements`; rozszerzyć `AdminUserListItemDto`. |
| `supabase/functions/_shared/entitlements.ts` | Nowy resolver + typy Zod. |
| `supabase/functions/me/me.service.ts` | Dołączyć entitlements do odpowiedzi; nie przekazywać JWT role jako `effective_tier`. |
| `supabase/functions/admin/admin.service.ts` | JOIN entitlements na liście; UPSERT przy zmianie roli. |
| `supabase/functions/ai/ai.handlers.ts` | Gating po resolverze. |
| `src/app/core/services/` | Serwis entitlements zasilany z `/me`; `AuthService` może nadal trzymać `appRole` z JWT jako tożsamość admina. |
| `src/app/core/guards/premium-role-match.guard.ts` | Czyta `effective_tier` / `capabilities.ai_assist` z serwisu entitlements. |

---

## 10. Testy API

1. Resolver: macierz status × grant × `app_role` × daty (w tym JWT `premium` + Free).
2. `GET /me`: `401` bez tokenu; `200` z pełnym `entitlements`; brak wiersza entitlements → Free, nie 500.
3. `GET /admin/users`: `403` dla `user` i `premium`; `200` dla admina z nowymi polami.
4. `PATCH .../role`: `premium` → `admin_override`; `user` przy override → Free; `user` przy przyszłym `subscription` + ważnej dacie nie kasuje subskrypcji; `409` self-change i last admin.
5. `POST /ai/recipes/image` i `draft`: `403 FEATURE_LOCKED` dla Free (także ze starym JWT `premium`); `200`/`201` dla admina i override; brak `NO_CREDITS`.
6. Kontrakt TypeScript: `MeDto.entitlements` wymagane — test kompilacji / fixture zgodne z `shared/contracts/types.ts`.
