# API Endpoints Implementation Plan: PS-65 — Egzekwowanie limitów planu dla użytkownika Free

## 1. Przegląd punktu końcowego

Modyfikacja istniejącego endpointu `POST /plan/recipes` (Edge Function `plan`) polegająca na dodaniu weryfikacji limitu pozycji planu dla użytkownika z rolą `user` (Free). Przed wywołaniem istniejącego RPC `add_recipe_to_plan_and_update_shopping_list` handler pobiera `app_role` z JWT claims i — jeśli rola to `user` — sprawdza aktualną liczbę pozycji w `plan_recipes`. Gdy liczba ta jest >= `PLAN_LIMIT_FREE` (env, domyślnie `3`), endpoint zwraca `422` z kodem `PLAN_LIMIT_EXCEEDED_FREE` i strukturą `details` zawierającą obydwa limity oraz link do `/pricing`.

**Zakres zmian:**

| Plik | Zmiana |
|---|---|
| `supabase/functions/_shared/errors.ts` | Dodanie `PLAN_LIMIT_EXCEEDED_FREE` do `ErrorCode` + nowa klasa `PlanLimitExceededFreeError` |
| `supabase/functions/plan/plan.types.ts` | Dodanie stałych `PLAN_LIMIT_FREE` i `PLAN_LIMIT_PREMIUM` |
| `supabase/functions/plan/plan.service.ts` | Dodanie funkcji `checkFreePlanLimit()` + modyfikacja `addRecipeToPlan()` |
| `supabase/functions/plan/plan.handlers.ts` | Przekazanie `appRole` z JWT do `addRecipeToPlan()` |
| `shared/contracts/types.ts` | Dodanie `PlanLimitExceededFreeErrorDto` |

Pozostałe endpointy modułu `plan` (`GET /plan`, `DELETE /plan/recipes/{recipeId}`, `DELETE /plan`) nie wymagają zmian.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** `POST`
- **Struktura URL:** `/functions/v1/plan/recipes`
- **Autoryzacja:** `Authorization: Bearer <JWT>` (wymagane)
- **Parametry:**
    - Wymagane: brak parametrów ścieżki/query
    - Opcjonalne: brak
- **Request Body:**

```json
{
    "recipe_id": 42
}
```

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `recipe_id` | `integer` | ✅ | ID przepisu do dodania do planu |

---

## 3. Wykorzystywane typy

### Istniejące (bez zmian)

```typescript
// shared/contracts/types.ts
type AddRecipeToPlanCommand = { recipe_id: number };

// supabase/functions/plan/plan.types.ts
const AddRecipeToPlanSchema = z.object({ recipe_id: z.number().int().positive() });
```

### Nowe

#### `PlanLimitExceededFreeErrorDto` — `shared/contracts/types.ts`

```typescript
/**
 * Error DTO returned when a Free user exceeds their plan item limit.
 */
export interface PlanLimitExceededFreeErrorDto {
    error: 'PLAN_LIMIT_EXCEEDED_FREE';
    message: string;
    details: {
        free_limit: number;
        premium_limit: 50;
        upgrade_url: '/pricing';
    };
}
```

#### Stałe limitów — `supabase/functions/plan/plan.types.ts`

```typescript
/**
 * Maximum number of plan items for Free users (configurable via env).
 * Defaults to 3 if PLAN_LIMIT_FREE is not set or invalid.
 */
export const PLAN_LIMIT_FREE: number = (() => {
    const raw = Deno.env.get('PLAN_LIMIT_FREE');
    const parsed = parseInt(raw ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
})();

/**
 * Maximum number of plan items for Premium and Admin users (hardcoded product value).
 */
export const PLAN_LIMIT_PREMIUM = 50 as const;
```

#### `PlanLimitExceededFreeError` — `supabase/functions/_shared/errors.ts`

```typescript
// Rozszerzenie ErrorCode:
| 'PLAN_LIMIT_EXCEEDED_FREE'

// Nowa klasa błędu:
export class PlanLimitExceededFreeError extends ApplicationError {
    public readonly details: {
        free_limit: number;
        premium_limit: 50;
        upgrade_url: '/pricing';
    };

    constructor(freeLimit: number) {
        super('PLAN_LIMIT_EXCEEDED_FREE', 'Osiągnięto limit pozycji w Moim planie dla konta Free.');
        this.details = {
            free_limit: freeLimit,
            premium_limit: 50,
            upgrade_url: '/pricing',
        };
    }

    override toJSON(): Record<string, unknown> {
        return {
            error: this.code,
            message: this.message,
            details: this.details,
        };
    }
}
```

> **Uwaga:** `PlanLimitExceededFreeError` używa klucza `"error"` zamiast `"code"` dla zgodności ze specyfikacją PS-65 i wzorcem `AiCreditsExhaustedErrorDto`. Klasa `handleError` w `errors.ts` obsługuje wszystkie podklasy `ApplicationError` przez `instanceof ApplicationError`, więc obsługa błędu działa bez dodatkowych zmian.

---

## 4. Szczegóły odpowiedzi

### Sukces — `201 Created`

```json
{
    "message": "Recipe added to plan successfully."
}
```

> Istniejący format bez zmian.

### Błąd PS-65 — `422 Unprocessable Entity` (`PLAN_LIMIT_EXCEEDED_FREE`)

Zwracany gdy: `app_role === 'user'` AND `COUNT(plan_recipes WHERE user_id = auth.uid()) >= PLAN_LIMIT_FREE`.

```json
{
    "error": "PLAN_LIMIT_EXCEEDED_FREE",
    "message": "Osiągnięto limit pozycji w Moim planie dla konta Free.",
    "details": {
        "free_limit": 3,
        "premium_limit": 50,
        "upgrade_url": "/pricing"
    }
}
```

> Pole `free_limit` odzwierciedla aktualną wartość zmiennej środowiskowej `PLAN_LIMIT_FREE`.

### Pozostałe odpowiedzi (bez zmian)

| Kod HTTP | Sytuacja |
|---|---|
| `401 Unauthorized` | Brak lub nieważny JWT |
| `404 Not Found` | Przepis nie istnieje lub jest soft-deleted |
| `409 Conflict` | Przepis jest już w planie |
| `422 Unprocessable Entity` | Przekroczono limit 50 pozycji (rola `premium`/`admin`) — istniejący kod |
| `500 Internal Server Error` | Nieoczekiwany błąd serwera |

---

## 5. Przepływ danych

```
Client (POST /plan/recipes)
    │
    ▼
[plan/index.ts]
    │  Routing do handlePostPlanRecipes
    ▼
[plan.handlers.ts — handlePostPlanRecipes]
    │  1. getAuthenticatedContext(req) → { client, user }
    │  2. Pobierz app_role z user.user_metadata.app_role (JWT claims)
    │  3. Walidacja body (Zod: AddRecipeToPlanSchema)
    │  4. Wywołaj addRecipeToPlan(client, user.id, recipe_id, appRole)
    ▼
[plan.service.ts — addRecipeToPlan]
    │  5a. Jeśli appRole === 'user':
    │      ├── checkFreePlanLimit(userId) [service role client]
    │      │     └── COUNT plan_recipes WHERE user_id = userId
    │      │     └── count >= PLAN_LIMIT_FREE ?
    │      │           → throw PlanLimitExceededFreeError(PLAN_LIMIT_FREE)
    │  5b. Wywołaj RPC add_recipe_to_plan_and_update_shopping_list (bez zmian)
    │       └── Wewnętrznie: weryfikacja dostępu, INSERT, limit 50, shopping list
    ▼
[plan.handlers.ts]
    │  6. Return 201 Created
    ▼
Client
```

**Interakcje z bazą danych:**

| Operacja | Klient | Tabela / RPC | Warunek |
|---|---|---|---|
| COUNT pozycji planu | service role | `plan_recipes` | `app_role === 'user'` |
| INSERT + shopping list | user context | RPC `add_recipe_to_plan_and_update_shopping_list` | zawsze |

---

## 6. Względy bezpieczeństwa

### Autentykacja i autoryzacja

- JWT jest weryfikowany przez `getAuthenticatedContext(req)` — nieważny lub brak JWT → `401`
- `app_role` pochodzi **wyłącznie** z `user.user_metadata.app_role` (JWT claims Supabase) — **nigdy** z body żądania. Manipulacja przez klienta jest niemożliwa bez podpisanego tokena
- Weryfikacja roli `admin` i `premium` jest negatywna (`appRole === 'user'`): nowe role dodane w przyszłości będą traktowane jak Premium/Admin (bezpieczny domyślny)

### Walidacja danych wejściowych

- `recipe_id`: schema Zod (`z.number().int().positive()`) — bez zmian
- `PLAN_LIMIT_FREE`: odczyt z env przy starcie funkcji, guard `parsed > 0` zapobiega limitu `0` lub ujemnego — domyślnie `3`

### Race condition

- Przy równoczesnych żądaniach COUNT może zwrócić wartość przed faktycznym INSERT → możliwe przekroczenie o 1 pozycję
- Dla limitu 3 ryzyko praktyczne jest minimalne (grandfathering jest celowym zachowaniem)
- Istniejąca transakcyjność RPC zapobiega przekroczeniu twardego limitu 50

### Grandfathering

- Endpoint nie usuwa istniejących pozycji użytkowników, którzy zebrali ich więcej przed PS-65
- Blokada dotyczy wyłącznie nowych wywołań `POST /plan/recipes`

---

## 7. Obsługa błędów

| Warunek | Typ błędu | Kod HTTP | Kod błędu |
|---|---|---|---|
| Brak/nieważny JWT | `ApplicationError` | 401 | `UNAUTHORIZED` |
| Nieprawidłowe JSON body | `ApplicationError` | 400 | `VALIDATION_ERROR` |
| Nieprawidłowe `recipe_id` | `ApplicationError` | 400 | `VALIDATION_ERROR` |
| Free user osiągnął limit | `PlanLimitExceededFreeError` | 422 | `PLAN_LIMIT_EXCEEDED_FREE` |
| Przepis nie istnieje | `ApplicationError` | 404 | `NOT_FOUND` |
| Brak dostępu do przepisu | `ApplicationError` | 403 | `FORBIDDEN` |
| Przepis już w planie | `ApplicationError` | 409 | `CONFLICT` |
| Przekroczono limit 50 (premium/admin) | `ApplicationError` | 422 | `UNPROCESSABLE_ENTITY` |
| Błąd DB / nieoczekiwany | `ApplicationError` | 500 | `INTERNAL_ERROR` |

### Logowanie

```typescript
// Przekroczenie limitu Free — oczekiwany scenariusz biznesowy
logger.warn(`[addRecipeToPlan] Free user ${userId} reached plan limit (${count}/${PLAN_LIMIT_FREE})`);

// Sukces weryfikacji
logger.info(`[checkFreePlanLimit] User ${userId}: ${count}/${PLAN_LIMIT_FREE} items, limit OK`);

// Błąd liczenia (nieoczekiwany)
logger.error(`[checkFreePlanLimit] Failed to count plan items for user ${userId}`, error);
```

---

## 8. Rozważania dotyczące wydajności

- **Dodatkowe zapytanie COUNT** dla roli `user`: 1 proste zapytanie na `plan_recipes` z filtrem `user_id` (indeks PK, O(1)). Narzut pomijalny
- **Wczesny return**: sprawdzenie limitu Free odbywa się **przed** wywołaniem RPC — pozwala uniknąć kosztowniejszej operacji RPC przy przekroczeniu limitu
- **Brak cache**: COUNT pobierany przy każdym żądaniu — niezbędne dla poprawności, koszt minimjalny (tabela `plan_recipes` max 50 wierszy na użytkownika)
- **Odczyt env przy starcie**: stała `PLAN_LIMIT_FREE` obliczana raz przy zimnym starcie funkcji — zero narzutu per-request

---

## 9. Etapy wdrożenia

### Krok 1 — Rozszerzenie `ErrorCode` i nowa klasa błędu

**Plik:** `supabase/functions/_shared/errors.ts`

1. Dodaj `'PLAN_LIMIT_EXCEEDED_FREE'` do union type `ErrorCode`
2. Dodaj wpis w `statusMap`: `PLAN_LIMIT_EXCEEDED_FREE: 422`
3. Dodaj klasę `PlanLimitExceededFreeError extends ApplicationError` z polem `details` i nadpisaniem `toJSON()`:

```typescript
export class PlanLimitExceededFreeError extends ApplicationError {
    public readonly details: {
        free_limit: number;
        premium_limit: 50;
        upgrade_url: '/pricing';
    };

    constructor(freeLimit: number) {
        super(
            'PLAN_LIMIT_EXCEEDED_FREE',
            'Osiągnięto limit pozycji w Moim planie dla konta Free.'
        );
        this.details = {
            free_limit: freeLimit,
            premium_limit: 50,
            upgrade_url: '/pricing',
        };
    }

    override toJSON(): Record<string, unknown> {
        return {
            error: this.code,
            message: this.message,
            details: this.details,
        };
    }
}
```

---

### Krok 2 — Stałe limitów w `plan.types.ts`

**Plik:** `supabase/functions/plan/plan.types.ts`

Dodaj na początku pliku (po imporcie Zod):

```typescript
/**
 * Maximum number of plan items for Free users (app_role = 'user').
 * Read from PLAN_LIMIT_FREE env variable; defaults to 3 if not set or invalid.
 */
export const PLAN_LIMIT_FREE: number = (() => {
    const raw = Deno.env.get('PLAN_LIMIT_FREE');
    const parsed = parseInt(raw ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
})();

/**
 * Maximum number of plan items for Premium and Admin users.
 * Hardcoded product value matching UI display on /pricing page.
 */
export const PLAN_LIMIT_PREMIUM = 50 as const;
```

---

### Krok 3 — Nowa funkcja pomocnicza `checkFreePlanLimit` w `plan.service.ts`

**Plik:** `supabase/functions/plan/plan.service.ts`

1. Zaimportuj `PlanLimitExceededFreeError` z `../_shared/errors.ts`
2. Zaimportuj `PLAN_LIMIT_FREE, PLAN_LIMIT_PREMIUM` z `./plan.types.ts`
3. Dodaj nową funkcję przed `addRecipeToPlan`:

```typescript
/**
 * Checks if a Free user (app_role = 'user') has reached their plan item limit.
 *
 * Business rules:
 * - Only called for app_role === 'user'
 * - Uses service role client to bypass RLS and get accurate count
 * - Grandfathering: does NOT remove existing over-limit items; only blocks new adds
 *
 * @param userId - The ID of the authenticated user
 * @throws PlanLimitExceededFreeError when count >= PLAN_LIMIT_FREE
 * @throws ApplicationError('INTERNAL_ERROR') on database failure
 */
async function checkFreePlanLimit(userId: string): Promise<void> {
    const supabase = createServiceRoleClient();

    const { count, error } = await supabase
        .from('plan_recipes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (error) {
        logger.error(
            `[checkFreePlanLimit] Failed to count plan items for user ${userId}`,
            error
        );
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to check plan limit');
    }

    const currentCount = count ?? 0;

    logger.info(
        `[checkFreePlanLimit] User ${userId}: ${currentCount}/${PLAN_LIMIT_FREE} items`
    );

    if (currentCount >= PLAN_LIMIT_FREE) {
        logger.warn(
            `[checkFreePlanLimit] Free user ${userId} reached plan limit (${currentCount}/${PLAN_LIMIT_FREE})`
        );
        throw new PlanLimitExceededFreeError(PLAN_LIMIT_FREE);
    }
}
```

---

### Krok 4 — Modyfikacja `addRecipeToPlan` w `plan.service.ts`

Zmień sygnaturę funkcji `addRecipeToPlan` na przyjmującą `appRole`:

```typescript
export async function addRecipeToPlan(
    client: TypedSupabaseClient,
    userId: string,
    recipeId: number,
    appRole: string   // ← NOWY parametr
): Promise<void> {

    // PS-65: Weryfikacja limitu Free (przed istniejącą weryfikacją limitu 50)
    if (appRole === 'user') {
        await checkFreePlanLimit(userId);
    }

    // Istniejąca logika bez zmian — RPC z weryfikacją limitu 50 dla premium/admin
    const { data, error } = await client.rpc(
        'add_recipe_to_plan_and_update_shopping_list',
        { p_recipe_id: recipeId }
    );

    // ... dalszy istniejący kod bez zmian
}
```

---

### Krok 5 — Modyfikacja `handlePostPlanRecipes` w `plan.handlers.ts`

1. Zaimportuj `AppRole` lub użyj `string` dla `appRole` (rola z JWT)
2. Pobierz `app_role` z JWT claims i przekaż do serwisu:

```typescript
export async function handlePostPlanRecipes(req: Request): Promise<Response> {
    // 1. Authenticate user
    const { client, user } = await getAuthenticatedContext(req);

    // PS-65: Pobierz app_role z JWT claims (nigdy z body!)
    const appRole = (user.user_metadata?.app_role as string) ?? 'user';

    logger.info(
        `[handlePostPlanRecipes] User ${user.id} (role: ${appRole}) adding recipe to plan`
    );

    // 2. Parse and validate request body (bez zmian)
    let body: unknown;
    try {
        body = await req.json();
    } catch (_error) {
        throw new ApplicationError('VALIDATION_ERROR', 'Invalid JSON in request body');
    }

    const validationResult = AddRecipeToPlanSchema.safeParse(body);
    if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new ApplicationError('VALIDATION_ERROR', `recipe_id: ${firstError.message}`);
    }

    const { recipe_id } = validationResult.data;

    // 3. Call service (PS-65: przekazuje appRole)
    await addRecipeToPlan(client, user.id, recipe_id, appRole);

    logger.info(
        `[handlePostPlanRecipes] Recipe ${recipe_id} added to plan for user ${user.id}`
    );

    // 4. Return success response (bez zmian)
    return new Response(
        JSON.stringify({ message: 'Recipe added to plan successfully.' }),
        {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
```

---

### Krok 6 — Nowe DTO w `shared/contracts/types.ts`

W sekcji `// #region --- Plan (My Plan) ---` dodaj przed `AddRecipeToPlanCommand`:

```typescript
/**
 * Error DTO returned when a Free user (app_role = 'user') exceeds their plan item limit.
 * Returned with HTTP 422 and error code PLAN_LIMIT_EXCEEDED_FREE.
 */
export interface PlanLimitExceededFreeErrorDto {
    error: 'PLAN_LIMIT_EXCEEDED_FREE';
    message: string;
    details: {
        /** Current Free plan limit (from PLAN_LIMIT_FREE env variable). */
        free_limit: number;
        /** Premium plan limit (hardcoded: 50). */
        premium_limit: 50;
        /** URL to the pricing page. */
        upgrade_url: '/pricing';
    };
}
```

---

### Krok 7 — Konfiguracja zmiennej środowiskowej

**Lokalne środowisko** (`supabase/.env.local` lub Supabase CLI secrets):

```bash
PLAN_LIMIT_FREE=3
```

**Produkcja / dev** — ustaw secret przez Supabase Dashboard lub CLI:

```bash
supabase secrets set PLAN_LIMIT_FREE=3
```

> Zmiana wartości nie wymaga redeploymentu kodu — funkcja odczytuje env przy zimnym starcie (cold start). Restart funkcji jest wymagany przy zmianie wartości na działającym środowisku.

---

### Krok 8 — Testy

#### Scenariusze jednostkowe (`plan.service.spec.ts` / Vitest)

| Scenariusz | Oczekiwany wynik |
|---|---|
| `checkFreePlanLimit`: count = 0 → limit = 3 | brak błędu |
| `checkFreePlanLimit`: count = 2 → limit = 3 | brak błędu |
| `checkFreePlanLimit`: count = 3 → limit = 3 | rzuca `PlanLimitExceededFreeError` z `details.free_limit = 3` |
| `checkFreePlanLimit`: count = 5 → limit = 3 (grandfathering) | rzuca `PlanLimitExceededFreeError` |
| `checkFreePlanLimit`: błąd DB | rzuca `ApplicationError('INTERNAL_ERROR')` |
| `addRecipeToPlan`: appRole = `'user'`, limit OK | wywołuje RPC, brak błędu |
| `addRecipeToPlan`: appRole = `'premium'` | nie wywołuje `checkFreePlanLimit`, wywołuje RPC |
| `addRecipeToPlan`: appRole = `'admin'` | nie wywołuje `checkFreePlanLimit`, wywołuje RPC |
| `PLAN_LIMIT_FREE` env = `'abc'` | używa domyślnego `3` |
| `PLAN_LIMIT_FREE` env = `'0'` | używa domyślnego `3` |
| `PLAN_LIMIT_FREE` env = `'10'` | używa `10` |

