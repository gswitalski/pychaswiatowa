# API Endpoints Implementation Plan: PS-37 — Wyświetlanie nazwy użytkownika w topbarze

> **Historyjka:** `docs/results/new-features/user-stories/PS-37/PS-37-topbar-username-display-user-story.md`
> **Specyfikacja API:** `docs/results/new-features/user-stories/PS-37/PS-37-topbar-username-display-api-plan.md`
> **Powiązane plany:** `PS-37-topbar-username-display-ui-plan.md`, `PS-37-topbar-username-display-deployment-plan.md`
> **Plan widoków (implementacja):** `docs/results/impl-plans/views/PS-37-topbar-username-display-view-implementation-plan.md` (osobny artefakt)
> **Runda planowania:** 1
> **Stan kodu zweryfikowany:** 10 listopada 2026 (analiza kodu; testy i komendy — `NIE_WYKONANO`, patrz sekcja 9)

---

## 1. Werdykt: brak zmian w warstwie serwerowej

PS-37 jest zmianą **wyłącznie frontendową**. Ten plan **jednoznacznie potwierdza**, że nie powstają:

| Element | Decyzja |
|---|---|
| Nowa Edge Function / nowy endpoint | **Brak** |
| Zmiana kodu istniejących funkcji `me`, `profile` (handlery, serwisy, typy Zod, router) | **Brak** |
| Migracje SQL (`supabase/migrations/**`), RPC, widoki, triggery, seed | **Brak** |
| Polityki RLS | **Brak zmian** |
| `shared/contracts/types.ts` (oraz `shared/contracts/*`) | **Brak zmian** |
| `_shared/database.types.ts`, `shared/types/database.types.ts` | **Bez regeneracji** |
| Sekrety, zmienne środowiskowe, `main-deploy.yml`, `config.toml` | **Brak** |
| Nowe testy backendowe (Deno) | **Brak** (istniejące uruchamiane tylko jako regresja — sekcja 8) |

Wykorzystywane są wyłącznie dwa **istniejące** endpointy:

| Rola w PS-37 | Endpoint | Funkcja Edge | Typ zmiany | Pola konsumowane przez frontend |
|---|---|---|---|---|
| Bootstrap nazwy (po logowaniu / odświeżeniu sesji / `ensureLoaded`/`refresh` subskrypcji) | `GET /me` | `me` | **Bez zmian** | `MeDto.id`, `MeDto.username` |
| Aktualizacja nazwy po zapisie w Ustawieniach i na `/auth/complete-profile` | `PUT /profile` | `profile` | **Bez zmian** | `ProfileSettingsDto.id`, `ProfileSettingsDto.username` (z **odpowiedzi** 200) |

Nie dochodzi żadne dodatkowe wywołanie sieciowe: zapis profilu **nie** wywołuje ponownie `GET /me` (wymaganie niefunkcjonalne historyjki, scenariusz 10).

> Metoda zapisu to **wyłącznie `PUT`**. `PATCH /profile` nie istnieje (router `profile` zwraca `405` z `Allow: GET, PUT, OPTIONS`) — brzmienie „`PUT`/`PATCH`" w scenariuszach 10–11 historyjki wymaga korekty (UI plan N4), bez wpływu na kod.

---

## 2. Ustalenia z weryfikacji kodu (potwierdzenia i korekty względem planu API)

Weryfikacja wykonana przez analizę kodu (nie przez uruchomienie). Wszystkie pozycje poniżej to dowody, że zakres „bez zmian" jest prawdziwy.

| # | Fakt | Dowód | Status |
|---|---|---|---|
| 1 | `GET /me` zwraca `id` i `username` w każdej odpowiedzi 200 | `supabase/functions/me/me.service.ts`: `PROFILE_SELECT_COLUMNS = 'id, username'`; obiekt wynikowy `{ id: profileData.id, username: profileData.username ?? '', … }` | `PASS` (analiza kodu) |
| 2 | Brak lub `NULL` w `profiles.username` ⇒ `username: ''` (a **nie** `null`/brak pola). Dotyczy użytkowników Google OAuth przed uzupełnieniem profilu | `me.service.ts` (`?? ''`); migracja `20260805220000_allow_google_oauth_profiles.sql` (`case when v_is_google_oauth then null else v_username end`) | `PASS` (analiza kodu) |
| 3 | `GET /me` zwraca `404` (`NOT_FOUND`, „Profile not found") przy braku wiersza w `profiles` | `me.service.ts` (`PGRST116` oraz pusty `data`) | `PASS` (analiza kodu) — frontend traktuje jak każdy błąd `/me` (brak nazwy) |
| 4 | `MeDto` w kontrakcie ma `id: string; username: string` (nie opcjonalne) | `shared/contracts/types.ts` ~l. 723–733; lokalna kopia `MeDto` w `me.service.ts` jest zgodna | `PASS` (analiza kodu) |
| 5 | `PUT /profile` zwraca `ProfileSettingsDto` zbudowane z **wiersza DB po `UPDATE … RETURNING`** (`.update().select(COLUMNS).single()`), więc `id` i `username` w odpowiedzi to wartości **zapisane** (po `trim()`), nie echo żądania | `profile.service.ts` `updateProfileSettings`: `normalizedUsername = payload.username.trim()`, `username: profileRow.username ?? ''`, `id: profileRow.id` | `PASS` (analiza kodu) |
| 6 | `ProfileSettingsDto` w kontrakcie ma `id: string; username: string` | `shared/contracts/types.ts` ~l. 560–567 | `PASS` (analiza kodu) |
| 7 | `id` w obu odpowiedziach to **`auth.uid()` z JWT** (zapytania filtrowane `.eq('id', userId)`, `userId = user.id` z `getAuthenticatedContext`); w `GET /me` dodatkowo `user.id === jwtPayload.sub` albo `401` | `me.handlers.ts`, `profile.handlers.ts` | `PASS` (analiza kodu) — to podstawa ochrony `dto.id === aktywny użytkownik` w `CurrentUserStateService` |
| 8 | Frontend woła API wyłącznie przez `supabase.functions.invoke('me' \| 'profile', …)` (zgodnie z `frontend.mdc`) | `me-api.service.ts`, `profile-settings-api.service.ts` | `PASS` (analiza kodu) |
| 9 | **Korekta planu API (sekcja 3):** lista kodów `PUT /profile` jako „200/401/409/422/500" jest niepełna. Faktycznie: `400` (niepoprawny JSON, niezgodność ze schematem Zod, w tym `username` krótszy niż 3 / dłuższy niż 50 po `trim`), `401`, `404` (brak profilu), `409` (`23505` — zajęta nazwa; indeks `idx_profiles_username_lower` — **bez rozróżniania wielkości liter**), `422` (nieobsługiwana wersja tekstu zgody marketingowej), `500` | `profile.handlers.ts` (`400` z `errors[]`), `profile.service.ts`, `errors.ts` (mapa kodów) | `PASS` (analiza kodu) — wszystkie traktowane przez PS-37 jednakowo: **brak wywołania `applyProfile`** |
| 10 | **Korekta planu API (sekcja 3):** komentarz „bez białych znaków" nie dotyczy `PUT /profile`. Schemat `updateProfileSettingsSchema` to `z.string().trim().min(3).max(50)` — **wewnętrzne spacje są dozwolone**; regex `^\S+$` istnieje tylko w `GET /profile/username-available`. Nazwa w topbarze może więc zawierać spacje wewnątrz | `profile.types.ts` | `PASS` (analiza kodu) — wpływ: UI musi działać z nazwą wielowyrazową (`white-space: nowrap` + wielokropek w planie UI już to obsługuje; test z nazwą ze spacją wewnątrz — sekcja 8) |
| 11 | **Obserwacja (poza zakresem PS-37):** `ProfileSettingsApiService.mapError` odczytuje `error.status`, a błąd `FunctionsHttpError` z `supabase-js` niesie status w `error.context.status` (tak robi `MeApiService.mapError`). Realny `409` może więc docierać do `ProfileSettingsFacade` jako `500`/generyczny komunikat. Istniejący spec symuluje błąd z polem `status`, więc tego nie wykrywa | `profile-settings-api.service.ts` `mapError`, `me-api.service.ts` `mapError`, `profile-settings-api.service.spec.ts` | `WYMAGA_WERYFIKACJI` (wpływ na PS-37: **żaden** — topbar zmienia się tylko po sukcesie `PUT`; ewentualna poprawa komunikatu `409` to osobne zgłoszenie) |
| 12 | Istniejące testy Deno **nie** asercjonują `username` w odpowiedzi `PUT /profile` ani fallbacku `''` w `/me` (`me.service.test.ts` ustawia tylko mock `{ id, username: 'jan' }`) | `me.service.test.ts` l. 19; `profile.service.test.ts` (dotyczy `checkUsernameAvailable`) | `PASS` (analiza kodu) — luka w pokryciu backendu jest **świadomie niezamykana** w PS-37 (brak zmian backendu); gwarancję kontraktu daje weryfikacja z sekcji 7 oraz typowanie fixtur frontendu (sekcja 8.3) |

---

## 3. Lista plików

### 3.1 Pliki backendowe i kontraktowe — wszystkie **BEZ ZMIAN**

| Plik / katalog | Zmiana |
|---|---|
| `supabase/functions/me/{index,me.handlers,me.service}.ts`, `me.service.test.ts` | Bez zmian |
| `supabase/functions/profile/{index,profile.handlers,profile.service,profile.types}.ts` i testy | Bez zmian |
| `supabase/functions/_shared/**` | Bez zmian |
| `supabase/migrations/**`, `supabase/config.toml`, `supabase/seed*` | Bez zmian |
| `shared/contracts/types.ts`, `shared/contracts/marketing-consent.ts` | Bez zmian |
| `.github/workflows/main-deploy.yml` | Bez zmian |

Strażnik zakresu (wymagany przed merge'em, wynik zapisać jawnie `PASS`/`FAIL`):

```powershell
git diff --stat origin/main -- supabase shared/contracts .github
```

Oczekiwane: **pusty wynik**. Niepusty = wyjście poza zakres PS-37.

### 3.2 Pliki frontendowe powiązane z konsumpcją API (szczegóły w planie widoków)

Wymienione tu wyłącznie dlatego, że są punktami styku z endpointami; implementacja i testy — wg `PS-37-…-view-implementation-plan.md` oraz sekcji 4.3 planu API:

| Plik | Styk z API |
|---|---|
| `src/app/core/services/current-user-state.service.ts` (+ `.spec.ts`) — **NOWY** | Stan nazwy; przyjmuje `Pick<MeDto,'id'\|'username'>` i `Pick<ProfileSettingsDto,'id'\|'username'>` |
| `src/app/core/services/auth.service.ts` (+ `.spec.ts`) | `switchUser`, `applyMe` po `GET /me` (za guardem `expectedUserId`) |
| `src/app/core/services/subscription-state.service.ts` (+ `.spec.ts`) | forward `applyMe` w gałęzi sukcesu `ensureLoaded`/`refresh` |
| `src/app/pages/settings/services/profile-settings.facade.ts` (+ `.spec.ts`) | `applyProfile` w `next` zapisu `PUT /profile` |
| `src/app/pages/auth/complete-profile/complete-profile-page.component.ts` (+ nowy `.spec.ts`) | zachowanie odpowiedzi `PUT /profile`, `applyProfile` przed `markComplete()` i nawigacją |

**Bez zmian:** `MeApiService`, `ProfileSettingsApiService`, `ProfileCompletionService`, `AiCreditsService` (żadnych zmian sygnatur ani mapowania błędów).

---

## 4. Endpointy — kontrakt konsumowany przez PS-37

### A. `GET /me` (istniejący, bez zmian)

- **Metoda / URL:** `GET /functions/v1/me` (frontend: `supabase.functions.invoke('me', { method: 'GET' })`)
- **Autoryzacja:** `Authorization: Bearer <JWT>` (wymagane). **Role:** `user`, `premium`, `admin` — wszystkie dozwolone; rola z claimu `app_role` (`extractAndValidateAppRole`). PS-37 nie różnicuje zachowania ze względu na rolę.
- **Parametry / body:** brak
- **Odpowiedź 200 (`MeDto`) — pola istotne dla PS-37:**

```json
{ "id": "<uuid użytkownika z JWT>", "username": "Kasia_Gotuje", "app_role": "user", "...": "..." }
```

- **Gwarancje wymagane przez PS-37:** `id` zawsze obecne i równe `sub` JWT; `username` zawsze `string` (może być `''`).

| Kod | Czy występuje | Zachowanie wymagane od frontendu PS-37 |
|---|---|---|
| 200 | Tak | `currentUserState.applyMe(me)` (tylko jeśli `me.id` = aktywny użytkownik) |
| 201 / 204 | Nie | — |
| 400 | Nie (brak parametrów) | — |
| 401 | Tak (brak/niepoprawny JWT, niezgodność `sub`) | Brak zmiany stanu nazwy; obsługa sesji jak dotychczas (przypadek brzegowy 16) |
| 402 / 403 | Nie | — |
| 404 | Tak (brak wiersza `profiles`) | Jak 401: brak zmiany stanu, `console.error` w `AuthService` jak dotąd |
| 405 | Tak (metoda ≠ `GET`/`OPTIONS`) | Nie dotyczy (frontend używa `GET`) |
| 409 / 422 | Nie | — |
| 500 | Tak | Brak zmiany stanu; **bez** czyszczenia wcześniej znanej nazwy (przypadek 14) i bez toastów (scenariusz 8) |

### B. `PUT /profile` (istniejący, bez zmian)

- **Metoda / URL:** `PUT /functions/v1/profile` (frontend: `ProfileSettingsApiService.updateProfileSettings`)
- **Autoryzacja:** `Authorization: Bearer <JWT>` (wymagane), role `user` / `premium` / `admin`; `userId` wyłącznie z JWT (nie z body).
- **Body (`UpdateProfileSettingsCommand`):** `{ username, marketing_consent, marketing_consent_text_version }` — pełny payload (PS-37 **nie** wprowadza zapisu częściowego).
- **Odpowiedź 200 (`ProfileSettingsDto`) — pola istotne dla PS-37:** `id` (= `auth.uid()`), `username` (zapisana wartość po `trim`).

| Kod | Czy występuje | Zachowanie wymagane od frontendu PS-37 |
|---|---|---|
| 200 | Tak | `currentUserState.applyProfile(profile)` (nazwa z **odpowiedzi**, nie z formularza) — tylko w `next` fasady oraz po sukcesie na `/auth/complete-profile` |
| 201 / 204 | Nie | — |
| 400 | Tak (zły JSON, naruszenie schematu Zod, `username` poza 3–50 po `trim`) | **Brak** `applyProfile`; komunikat jak dotąd w formularzu |
| 401 | Tak | **Brak** `applyProfile`; `/auth/complete-profile`: snackbar + `/login` jak dotąd |
| 402 / 403 | Nie | — |
| 404 | Tak (brak profilu) | **Brak** `applyProfile` |
| 409 | Tak (nazwa zajęta, indeks `lower(username)`) | **Brak** `applyProfile` (scenariusz 11, przypadek 15) |
| 422 | Tak (nieobsługiwana wersja tekstu zgody) | **Brak** `applyProfile` |
| 500 | Tak | **Brak** `applyProfile` |

Pozostałe trasy funkcji `profile` (`GET /profile`, `GET /profile/username-available`, `POST /profile/change-password`) — **poza zakresem PS-37**, bez zmian i bez udziału w zasilaniu nazwy.

---

## 5. DTO, walidacja Zod, migracje, RLS/RPC

| Obszar | Decyzja |
|---|---|
| DTO / Command | **Brak nowych**; używane: `MeDto`, `ProfileSettingsDto`, `UpdateProfileSettingsCommand` (bez zmian) |
| Walidacja Zod (backend) | **Bez zmian** — `updateProfileSettingsSchema`: `username: z.string().trim().min(3).max(50)`, `marketing_consent: z.boolean()`, `marketing_consent_text_version: z.string().trim().min(1)` |
| Walidacja po stronie serwisu | **Bez zmian** — `trim` + zakres 3–50 (`VALIDATION_ERROR` → `400`), wersja zgody przez RPC `supported_marketing_consent_text_versions` (`422`) |
| Migracje | **Brak** |
| RLS | **Brak zmian.** `GET /me` i `GET/PUT /profile` działają na kliencie użytkownika (RLS `profiles` dla `auth.uid() = id`); PS-37 nie dodaje żadnego nowego odczytu danych |
| RPC / widoki / triggery | **Brak** |
| Bezpośredni odczyt tabel z frontendu | **Zabroniony** (`frontend.mdc`) — PS-37 go nie wprowadza |
| Dane wrażliwe | Nazwa użytkownika nie trafia do `localStorage`/`sessionStorage`/cookies ani do nowych logów frontendu; po stronie backendu `me.service.ts` loguje `username` na poziomie `info` (**istniejące zachowanie**, bez zmian w PS-37) |

---

## 6. Integracja stanu z odpowiedziami API (kontrakt dla implementera widoków)

Reguły wynikające z gwarancji backendu (sekcja 2, poz. 1, 2, 5, 7) — **źródłem prawdy jest plan API sekcja 4**, tu tylko odwołanie do mapowania odpowiedź → akcja:

| Zdarzenie | Odpowiedź | Akcja na stanie | Uzasadnienie |
|---|---|---|---|
| `GET /me` 200 | `{ id, username }` | `applyMe` jeśli `id` = aktywny; `''` ⇒ `displayName === null` | `username: ''` to prawda dla konta OAuth bez nazwy |
| `GET /me` błąd (401/404/500/sieć) | — | **brak akcji** (nie czyścić) | przypadki 14, 16; scenariusz 8 |
| `PUT /profile` 200 | `{ id, username }` | `applyProfile` jeśli `id` = aktywny | `username` po `trim` z DB |
| `PUT /profile` 400/401/404/409/422/500 | — | **brak akcji** | scenariusz 11 |
| `switchUser(null \| inny id)` (logout / zmiana konta) | — | czyszczenie | scenariusz 13 |
| `TOKEN_REFRESHED` (ten sam `userId`) | — | `switchUser` no-op | scenariusz 12 / przypadek 13 |

Typowanie wejścia `applyMe`/`applyProfile` jako `Pick<MeDto,'id'|'username'>` / `Pick<ProfileSettingsDto,'id'|'username'>` (import z `shared/contracts/types`) sprawia, że **zmiana lub usunięcie** `id`/`username` w kontrakcie przerwie kompilację frontendu (`npm run build`) — jest to automatyczna siatka bezpieczeństwa dla założenia „kontrakt bez zmian".

---

## 7. Lista kontrolna weryfikacji kontraktu (co dokładnie zweryfikować)

Wszystkie pozycje poniżej to **weryfikacje tylko do odczytu / smoke**; żadna nie wymaga zmiany kodu backendu.

### 7.1 Weryfikacja statyczna (kod)

| # | Co sprawdzić | Oczekiwany wynik | Status |
|---|---|---|---|
| V1 | `MeDto` (`shared/contracts/types.ts`) zawiera `id: string` i `username: string` (nie opcjonalne) | Zgodne | `PASS` (analiza kodu, 10.11.2026) |
| V2 | `ProfileSettingsDto` zawiera `id: string` i `username: string` | Zgodne | `PASS` (analiza kodu) |
| V3 | `getMeProfile` zwraca `id` i `username` na ścieżce sukcesu (`username ?? ''`) | Zgodne | `PASS` (analiza kodu) |
| V4 | `updateProfileSettings` (service) zwraca `id` i `username` z wiersza DB po `trim` | Zgodne | `PASS` (analiza kodu) |
| V5 | Frontend ma tylko `PUT` dla zapisu profilu (`ProfileSettingsApiService.updateProfileSettings` → `method: 'PUT'`) | Zgodne; `PATCH` nie występuje | `PASS` (analiza kodu) |
| V6 | Brak odwołań `supabase.from(` w nowym/zmienianym kodzie PS-37 | `rg "supabase\.from\(" src/app/core/services/current-user-state.service.ts src/app/layout/main-layout/components/topbar` ⇒ brak trafień | `NIE_WYKONANO` (do wykonania po implementacji) |
| V7 | Zakres zmian: `git diff --stat origin/main -- supabase shared/contracts .github` | Pusty | `NIE_WYKONANO` (po implementacji) |

### 7.2 Weryfikacja uruchomieniowa (lokalnie, smoke) — `NIE_WYKONANO`

Środowisko: lokalny Supabase (`http://localhost:54331/functions/v1/…`), użytkownik testowy z `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` z `.env.local`. **Nie zapisywać tokenów ani haseł w repo, dokumentach ani logach.**

| # | Scenariusz | Oczekiwany wynik | Status |
|---|---|---|---|
| S1 | `GET /me` z JWT roli `user` | `200`; ciało zawiera `id` (UUID = `sub` JWT) i `username` (niepusty string) | `NIE_WYKONANO` |
| S2 | `GET /me` z JWT roli `admin` | `200`; `id` i `username` obecne (rola nie zmienia tych pól) | `NIE_WYKONANO` |
| S3 | `GET /me` z JWT konta Google OAuth przed uzupełnieniem profilu (lub konta z `profiles.username = NULL` w lokalnej bazie) | `200`; `username === ""` (string, nie `null`/brak pola) | `NIE_WYKONANO` |
| S4 | `GET /me` bez `Authorization` | `401` | `NIE_WYKONANO` |
| S5 | `PUT /profile` z poprawnym body i `username` z dopisanymi spacjami (`"  <aktualna nazwa>  "`) | `200`; `id` = `sub`; `username` **przycięty** (równy aktualnej nazwie) — potwierdza, że `applyProfile` dostaje wartość po `trim` | `NIE_WYKONANO` |
| S6 | `PUT /profile` z nazwą zajętą przez innego użytkownika (także w innej wielkości liter) | `409` | `NIE_WYKONANO` |
| S7 | `PUT /profile` z `username` o 2 znakach i o 51 znakach | `400` | `NIE_WYKONANO` |
| S8 | `PUT /profile` bez JWT | `401` | `NIE_WYKONANO` |
| S9 | `PUT /profile` z nazwą zawierającą wewnętrzną spację (np. `Jan Kowalski`) | `200`, spacja zachowana (potwierdza ustalenie 10) | `NIE_WYKONANO` |

Przykładowa sekwencja (PowerShell; wartości sekretne pobrać ze środowiska, **nie wklejać do dokumentów**):

```powershell
# $anonKey — klucz anon z `supabase status` / .env.local; $env:TEST_USER_EMAIL, $env:TEST_USER_PASSWORD — z .env.local
$base = 'http://localhost:54331'
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/v1/token?grant_type=password" `
    -Headers @{ apikey = $anonKey } -ContentType 'application/json' `
    -Body (@{ email = $env:TEST_USER_EMAIL; password = $env:TEST_USER_PASSWORD } | ConvertTo-Json)
$h = @{ Authorization = "Bearer $($login.access_token)"; apikey = $anonKey }

# S1: GET /me
$me = Invoke-RestMethod -Uri "$base/functions/v1/me" -Headers $h
$me | Select-Object id, username, app_role

# S5: PUT /profile z tą samą nazwą i dopisanymi spacjami (pozostałe pola — bieżące wartości z GET /profile)
$p = Invoke-RestMethod -Uri "$base/functions/v1/profile" -Headers $h
$body = @{
    username = "  $($p.username)  "
    marketing_consent = $p.marketing_consent
    marketing_consent_text_version = $p.marketing_consent_text_version
} | ConvertTo-Json
$put = Invoke-RestMethod -Method Put -Uri "$base/functions/v1/profile" -Headers $h `
    -ContentType 'application/json' -Body $body
$put | Select-Object id, username   # oczekiwane: id = $me.id, username bez spacji
```

Uwagi do sekwencji: (1) `PUT /profile` nadpisuje `marketing_consent_updated_at` — wykonywać wyłącznie na lokalnej bazie; (2) jeśli `marketing_consent_text_version` w profilu jest `null`, użyć stałej `MARKETING_CONSENT_TEXT_VERSION` z `shared/contracts/marketing-consent.ts` (pole jest wymagane przez schemat); (3) kody błędów (S4, S6–S8) sprawdzać przez `Invoke-WebRequest -SkipHttpErrorCheck`.

---

## 8. Testy i komendy weryfikacji

### 8.1 Backend (tylko regresja — brak nowych testów)

Istniejące testy Deno dla `me` i `profile` mają przejść bez zmian (potwierdzają, że nic nie zostało naruszone):

```powershell
deno test --allow-all supabase/functions/me supabase/functions/profile
deno test --allow-all supabase/functions   # pełny zestaw, jak w CI (main-deploy.yml, job validate-backend)
```

| Komenda | Oczekiwany wynik | Status |
|---|---|---|
| `deno test --allow-all supabase/functions/me supabase/functions/profile` | wszystkie testy `ok` | `NIE_WYKONANO` (dostępność `deno` lokalnie — `WYMAGA_WERYFIKACJI`; w razie braku zostaje bramka CI `validate-backend`) |

### 8.2 Zakres zmian (strażnik)

```powershell
git diff --stat origin/main -- supabase shared/contracts .github   # oczekiwane: pusty
git diff --name-only origin/main | rg "^(supabase|shared/contracts)/"   # oczekiwane: brak trafień
```

Status: `NIE_WYKONANO` (po implementacji).

### 8.3 Testy frontendowe dotyczące kontraktu API (Vitest) — wymagania dla fixtur

Zakres testów opisuje plan widoków (UI plan sekcja 7). Z perspektywy API obowiązują dodatkowo:

1. **Fixtury `MeDto` / `ProfileSettingsDto`** w nowych i zmienianych specach (`auth.service.spec.ts`, `subscription-state.service.spec.ts`, `profile-settings.facade.spec.ts`, `complete-profile-page.component.spec.ts`, `current-user-state.service.spec.ts`) zawierają **jawnie** `id` i `username` i są typowane typami z `shared/contracts/types` (nie `as any`), aby zmiana kontraktu łamała kompilację specu.
2. **Mapowanie odpowiedź → akcja** (sekcja 6) pokryte przypadkami: `applyMe` z `username: ''` ⇒ `displayName === null`; `applyProfile` z nazwą po `trim`; błąd `getMe` (status 401/404/500) ⇒ brak `applyMe` i nazwa przetrwa; `updateProfileSettings` błąd (400/401/404/409/422/500) ⇒ brak `applyProfile`; spóźniona odpowiedź z innym `id` ⇒ ignorowana.
3. **Brak dodatkowego `GET /me` po zapisie profilu:** spec fasady/strony asercjonuje, że `MeApiService.getMe` **nie** został wywołany po sukcesie `updateProfileSettings`.
4. **Brak regresji API:** istniejące `profile-settings-api.service.spec.ts` i speki `MeApiService` (jeśli istnieją) przechodzą bez zmian — PS-37 nie modyfikuje tych serwisów.

### 8.4 Komendy końcowe (bramki przed merge'em)

```powershell
npm run lint
npm run test:run
npm run build
```

| Komenda | Status |
|---|---|
| `npm run lint` | `NIE_WYKONANO` |
| `npm run test:run` | `NIE_WYKONANO` |
| `npm run build` | `NIE_WYKONANO` |

Wyniki przed zamknięciem historyjki muszą być zapisane jawnie jako `PASS`/`FAIL` (`NIE_WYKONANO` nie jest równoważne z `PASS`).

---

## 9. Ryzyka, uwagi i otwarte punkty

| # | Temat | Ocena | Decyzja |
|---|---|---|---|
| R1 | `username: ''` z `/me` dla OAuth przed uzupełnieniem profilu | Poprawne i oczekiwane | Frontend: `''`/białe znaki ⇒ brak nazwy (`displayName === null`) |
| R2 | Nazwa z wewnętrznymi spacjami (ustalenie 10) | Dozwolone przez `PUT /profile` | Test UI z nazwą wielowyrazową; brak zmian walidacji (poza zakresem PS-37) |
| R3 | Mapowanie błędów `PUT /profile` (ustalenie 11: `error.status` vs `error.context.status`) | Preexistujące, możliwe niedopasowanie komunikatu `409` | **Poza zakresem**; PS-37 nie zależy od kodu błędu (brak `applyProfile` przy każdym błędzie). Zgłosić jako osobne zadanie po potwierdzeniu `WYMAGA_WERYFIKACJI` |
| R4 | Wyścig tego samego użytkownika (stary `GET /me` po udanym `PUT /profile`) | Wąskie okno, poza historyjką | Ryzyko akceptowane (plan API 7.3); stan zbiega po F5 / kolejnym `/me` |
| R5 | Rozjazd frontendowych fixtur z kontraktem | Niskie | Typowanie fixtur + `Pick<…>` w `CurrentUserStateService` (sekcje 6, 8.3) |
| R6 | `main-deploy.yml` bez filtrów ścieżek (redeploy funkcji i `db push` po każdym pushu do `main`) | Oczekiwane; no-op dla PS-37 | Bez działań (deployment plan, sekcja 1) |
| R7 | Log backendu `info` z `username` w `me.service.ts` | Preexistujące | Poza zakresem PS-37 |
| R8 | Luka w testach backendu (brak asercji `username` w `PUT /profile` i fallbacku `''` w `/me`) | Niskie ryzyko, bo kod bez zmian | **Świadomie nie zamykana** w PS-37; ewentualne uzupełnienie jako osobne zadanie techniczne |

---

## 10. Review API i kryteria ukończenia (etap API)

- **Review API:** brak zmian API/DB/kontraktów ⇒ artefakt `PS-37-topbar-username-display-review-api-r{R}.md` **nie jest wymagany**; status: **`BEZ_REVIEW`** — powód: „brak zmian w Edge Functions, migracjach, RLS i `shared/contracts/types.ts`; weryfikacja strażnikiem `git diff --stat` (sekcja 8.2)". Warunek: strażnik z 8.2 zwraca pusty wynik (`PASS`) — w przeciwnym razie `BEZ_REVIEW` traci ważność i wymagany jest review API.
- **Kryteria ukończenia etapu API:**
    - [ ] V6 i V7 wykonane z wynikiem `PASS` (po implementacji widoków)
    - [ ] Strażnik zakresu (8.2) — `PASS`
    - [ ] Smoke S1–S9 (7.2) wykonane lokalnie lub jawnie oznaczone `NIE_WYKONANO` z powodem
    - [ ] Testy Deno `me`/`profile` (8.1) — `PASS` lub bramka CI `validate-backend` — `PASS`
    - [ ] Fixtury frontendu typowane kontraktem (8.3 pkt 1)
- **Kolejny krok:** implementacja widoków wg `PS-37-topbar-username-display-view-implementation-plan.md` (`CurrentUserStateService` jako pierwszy, następnie integracje 1–5 z planu API sekcja 4.3, na końcu `TopbarComponent`).
- **Dokumentacja po wdrożeniu:** `docs/results/project-summary.md` — sekcja 5 (Endpointy API) **bez zmian**; wpis o PS-37 tylko w sekcji 0 i 6 (etap summary, po akceptacji review widoków).
