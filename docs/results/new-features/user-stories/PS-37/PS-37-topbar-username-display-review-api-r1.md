# PS-37 — Review API (runda 1)

**Status review:** `BEZ_REVIEW`
**Status etapu API:** `WYMAGA_WERYFIKACJI` (nie `PASS`)
**Data:** 2026-11-10 · **Gałąź:** `PS-37` · **Baza porównania:** `HEAD` = `e3fa764`

## Powód braku review

PS-37 jest zmianą wyłącznie frontendową. Nie zmieniono Edge Functions, migracji, RLS,
RPC ani `shared/contracts/types.ts`, więc nie ma diffu API do przeglądu w zakresach
`api-db`, `api-code` i `api-tests`. Wniosek opiera się na strażniku zakresu poniżej.
`BEZ_REVIEW` traci ważność, jeśli strażnik zwróci niepusty wynik.

## Strażnik zakresu

| Komenda | Wynik | Status |
|---|---|---|
| `git diff --stat HEAD -- supabase shared/contracts .github` | pusty | `PASS` |
| `git ls-files --others --exclude-standard -- supabase shared/contracts .github` | pusty | `PASS` |
| `git status --short` | tylko pliki `docs/**` dotyczące PS-37 (untracked) | `PASS` |

**Uwaga dla planu API (sekcja 8.2):** polecenie `git diff --stat origin/main -- …` zwraca
niepusty wynik (15 plików, m.in. migracja PS-31), bo gałąź `PS-37` jest o commity przed
`origin/main` (`merge-base` = `origin/main` = `f870b94`). To zmiany sprzed PS-37, a nie
odstępstwo. Do kontroli PS-37 używaj `HEAD` (lub commita sprzed implementacji widoków) jako
bazy. Po zacommitowaniu zmian PS-37 porównuj z commitem `e3fa764`.

## Preflight środowiska

| Narzędzie / zasób | Wynik | Status |
|---|---|---|
| `supabase` CLI | 2.121.0 (scoop; dostępna nowsza v3.1.0) | `PASS` |
| `docker` | demon odpowiada (Server 29.8.0) | `PASS` |
| `deno` | brak w `PATH` | `WYMAGA_WERYFIKACJI` |
| Porty 54331 / 54332 / 54333 / 54334 | nasłuchują (lokalny Supabase działa) | `PASS` |
| `.env.local` (użytkownik testowy) | brak pliku | `WYMAGA_WERYFIKACJI` |

## Weryfikacja kontraktu (plan API, sekcja 7)

| # | Wynik | Status |
|---|---|---|
| V1 | `MeDto`: `id: string`, `username: string` (`types.ts:723–725`) | `PASS` |
| V2 | `ProfileSettingsDto`: `id: string`, `username: string` (`types.ts:560–563`) | `PASS` |
| V3, V4 | zweryfikowane analizą kodu w planie API (kod bez zmian) | `PASS` (analiza kodu) |
| V5 | zapis profilu tylko `PUT` (`src/app/core/services/profile-settings-api.service.ts:48`); `PATCH` nie występuje | `PASS` |
| V6 | wymaga kodu PS-37 (po implementacji widoków) | `NIE_WYKONANO` |
| V7 | strażnik względem `HEAD` pusty (patrz wyżej); ponowić po implementacji widoków | `PASS` (stan bieżący) |
| S1–S9 | smoke lokalny `GET /me` / `PUT /profile` | `NIE_WYKONANO` — brak `.env.local` z `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` |
| Testy Deno `me` / `profile` | | `NIE_WYKONANO` — brak `deno` lokalnie; zostaje bramka CI `validate-backend` |

## Co nie jest pokryte

- Zachowanie uruchomieniowe `GET /me` (S1–S4) i `PUT /profile` (S5–S9). Kontrakt potwierdzono
  wyłącznie analizą statyczną.
- Testy Deno dla niezmienionych funkcji `me` i `profile`. Brak zmian zmniejsza ryzyko, ale nie
  zastępuje uruchomienia.
- Luka w testach backendu (brak asercji `username` w `PUT /profile` i fallbacku `''` w `/me`)
  jest świadomie poza zakresem PS-37 (plan API, R8).

## Checklista etapu API

- [x] Zakres: brak zmian w `supabase/`, `shared/contracts/`, `.github/` (strażnik względem `HEAD`)
- [x] V1, V2, V5 — `PASS`
- [ ] V6 — po implementacji widoków
- [ ] V7 — ponowić po implementacji widoków
- [ ] S1–S9 — `NIE_WYKONANO` (brak użytkownika testowego)
- [ ] Deno `me` / `profile` — `NIE_WYKONANO` (brak `deno`); bramka CI `validate-backend`

## Decyzja

Etap API nie wymaga kodu. Można przejść do implementacji widoków, ale statusy `S1–S9`
i `deno test` pozostają `WYMAGA_WERYFIKACJI` i trafią do summary. Funkcja nie jest uznana
za gotową do czasu uzupełnienia lub jawnej akceptacji tych luk.
