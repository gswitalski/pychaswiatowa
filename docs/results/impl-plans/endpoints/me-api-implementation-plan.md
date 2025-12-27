# API Endpoints Implementation Plan: GET /me

<analysis>
## 1) Kluczowe punkty specyfikacji API
- Endpoint **`GET /me`** zwraca minimalne dane tożsamości dla **zalogowanego** użytkownika, potrzebne do bootstrapu App Shell.
- Response zawiera: **`id`**, **`username`**, oraz **`app_role`**.
- **RBAC (przygotowanie):** access token JWT musi zawierać custom claim **`app_role`** o wartościach: `user | premium | admin`.
- **Domyślna rola:** `user` ustawiana po stronie serwera/bazy; klient nie może jej wysyłać ani zmieniać w procesie signup.

## 2) Parametry wymagane i opcjonalne
- **Metoda:** `GET`
- **Ścieżka:** `/me` (Supabase Edge Function: `/functions/v1/me`)
- **Nagłówki:**
  - Wymagane:
    - `Authorization: Bearer <JWT>`
  - Opcjonalne:
    - `Accept: application/json`
- **Query params:** brak
- **Request body:** brak

## 3) Niezbędne typy DTO i Command Modele
- **DTO (response):** brak dedykowanego typu w `shared/contracts/types.ts` dla `GET /me` (w API Plan jest payload: `{ id, username, app_role }`).
  - Rekomendacja: dodać wspólny kontrakt np. `MeDto` w `shared/contracts/types.ts` (lub w typach funkcji backendowych, jeśli frontend nie ma konsumować bezpośrednio).
- **Command modele:** brak (endpoint tylko do odczytu).

## 4) Wyodrębnienie logiki do service
- Edge Function `supabase/functions/me/` powinna być zgodna z zasadami:
  - `index.ts`: routing + top-level error handling
  - `me.handlers.ts`: walidacja (nagłówki), formatowanie odpowiedzi
  - `me.service.ts`: odczyt danych profilu z bazy + odczyt `app_role` z JWT
- Logika serwisu:
  - Weryfikacja JWT i ekstrakcja `userId` oraz `app_role` (claim).
  - Pobranie `profiles.username` dla `userId`.
  - Złożenie DTO i zwrot.

## 5) Walidacja danych wejściowych (Zod)
- Walidacja wejścia ogranicza się do:
  - Obecności i formatu nagłówka `Authorization` (prefiks `Bearer `).
  - Poprawnej weryfikacji JWT (podpis, ważność).
  - Obecności claim `app_role` oraz że jest jednym z: `user | premium | admin`.
- Endpoint nie przyjmuje body/query, więc brak walidacji payloadu.

## 6) Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)
- W dostarczonych materiałach nie ma specyfikacji tabeli błędów.
- Rekomendacja MVP: **logowanie do stdout** (Supabase logs) na poziomach:
  - `info`: wywołanie endpointu, `userId` (bez tokena)
  - `warn`: błędy walidacji/401
  - `error`: błędy nieoczekiwane/500
- Jeśli w projekcie istnieje tabela/log collector, można dodać opcjonalne zapisywanie `requestId`, `userId`, `path`, `errorCode` (bez danych wrażliwych).

## 7) Potencjalne zagrożenia bezpieczeństwa
- **Token leakage**: nie logować pełnego JWT, nagłówków auth ani danych sesji.
- **Privilege escalation**: `app_role` musi pochodzić wyłącznie z JWT generowanego przez Supabase; klient nie może ustawiać roli w signup.
- **Brak/niepoprawny claim**: jeżeli `app_role` nie istnieje lub ma inną wartość, zwrócić 401 (token niespełnia wymagań aplikacji) albo 500 (jeśli to błąd konfiguracji) — rekomendacja: 401 + jasny komunikat „invalid token claims”.
- **RLS**: `profiles` powinno mieć RLS zgodne z `auth.uid() = id` (dla profilu 1:1) — endpoint opiera się na odczycie własnego profilu.

## 8) Scenariusze błędów i kody statusu
- `200 OK`: poprawny odczyt `id`, `username`, `app_role`.
- `401 Unauthorized`:
  - brak `Authorization`
  - niepoprawny format `Bearer`
  - JWT nieważny / wygasły
  - nie da się zidentyfikować użytkownika (brak `sub`)
  - brak/niepoprawny claim `app_role`
- `404 Not Found`:
  - profil nie istnieje (`profiles` bez wiersza dla userId) — sytuacja awaryjna (np. trigger `handle_new_user` nie zadziałał)
- `500 Internal Server Error`:
  - błąd supabase client / błąd połączenia / nieoczekiwany wyjątek
</analysis>

## 1. Przegląd punktu końcowego
- **Nazwa endpointu:** `GET /me`
- **Cel:** zwrócić minimalny zestaw danych o aktualnym użytkowniku do bootstrapu warstwy UI (App Shell) oraz diagnostyki roli.
- **Dostęp:** prywatny (wymaga JWT).
- **Kontrakt odpowiedzi:** `id`, `username`, `app_role`.

## 2. Szczegóły żądania
- **Metoda HTTP:** `GET`
- **Struktura URL:** `/functions/v1/me` (lokalnie: `http://localhost:54331/functions/v1/me`)
- **Parametry:**
  - **Wymagane:**
    - Nagłówek `Authorization: Bearer <JWT>`
  - **Opcjonalne:** brak
- **Request Body:** brak

## 3. Wykorzystywane typy
- **Z `shared/contracts/types.ts`:**
  - `ProfileDto` (do kształtu `{ id, username }`)
  - Brak wspólnego typu na `{ id, username, app_role }` → rekomendowane dopisanie `MeDto`.
- **Proponowany typ (wspólny kontrakt):**
  - `type AppRole = 'user' | 'premium' | 'admin'`
  - `interface MeDto { id: string; username: string; app_role: AppRole }`

## 4. Szczegóły odpowiedzi
- **200 OK**
  - Payload:
    - `id`: string (uuid)
    - `username`: string | null (zgodnie z `profiles.username`, jeśli dopuszczalne)
    - `app_role`: `user | premium | admin`
- **401 Unauthorized**
  - Payload (przykład): `{ "message": "Authentication required" }` lub `{ "message": "Invalid token claims" }`
- **404 Not Found**
  - Payload (przykład): `{ "message": "Profile not found" }`
- **500 Internal Server Error**
  - Payload (przykład): `{ "message": "Internal server error" }`

## 5. Przepływ danych
1. **Router (`supabase/functions/me/index.ts`)**
   - przyjmuje request
   - deleguje do `meRouter` / `handleGetMe`
   - centralnie mapuje błędy na kody HTTP (zgodnie z `_shared/errors.ts`, jeśli istnieje)
2. **Handler (`me.handlers.ts`)**
   - waliduje metodę (`GET`)
   - waliduje nagłówek `Authorization` (format)
   - wywołuje serwis `getMe({ request })`
   - mapuje wynik na JSON response
3. **Service (`me.service.ts`)**
   - weryfikuje JWT i wyciąga:
     - `userId` (np. `sub`)
     - `app_role`
   - pobiera `profiles` dla `userId` (kolumny: `id`, `username`)
   - buduje `MeDto` i zwraca
4. **Baza danych (Supabase Postgres)**
   - odczyt z `public.profiles` po `id = userId`
   - egzekwowanie RLS po stronie bazy

## 6. Względy bezpieczeństwa
- **JWT / auth:**
  - endpoint wymaga JWT; brak tokena → 401.
  - token musi zawierać claim `app_role` (`user|premium|admin`).
- **RBAC:**
  - `app_role` jest foundation pod gating w UI i przyszłe restrykcje; sam endpoint `GET /me` nie ogranicza dostępu po roli (każdy zalogowany).
- **Minimalizacja danych:**
  - zwracamy tylko `id`, `username`, `app_role` (bez e-maila, metadanych, itd.).
- **Logowanie:**
  - nie logować `Authorization`/JWT.
  - logować `requestId`, `userId`, `path`, `status`.

## 7. Obsługa błędów
- **401 Unauthorized**
  - `Authorization` brak/niepoprawny
  - JWT invalid/expired
  - brak `sub` / brak `app_role` / `app_role` poza enumeracją
- **404 Not Found**
  - brak rekordu w `profiles` dla `userId`
- **500 Internal Server Error**
  - błędy klienta Supabase / wyjątki runtime
- **Mapowanie błędów**
  - preferowane użycie wspólnego `ApplicationError` z `_shared/errors.ts` (np. `code`, `httpStatus`, `details`)
  - handler łapie błędy walidacji (Zod) i zwraca 400 tylko gdy dotyczy danych wejściowych (tu raczej 401); resztę deleguje do centralnego mappera.

## 8. Rozważania dotyczące wydajności
- **Zapytania do DB:** 1 proste `SELECT` po PK (`profiles.id`) → stały koszt.
- **Cache:** opcjonalny krótkotrwały cache po stronie klienta (frontend) na czas życia sesji; po stronie Edge Function brak potrzeby cache.
- **Payload:** minimalny (kilkadziesiąt bajtów).

## 9. Kroki implementacji
1. **Utworzyć strukturę Edge Function** `supabase/functions/me/`:
   - `index.ts` (routing + obsługa błędów)
   - `me.handlers.ts` (handler GET + walidacja)
   - `me.service.ts` (pobranie profilu + claim `app_role`)
2. **Współdzielone utilsy** (jeśli nie istnieją, dodać do `supabase/functions/_shared/`):
   - `auth.ts`: weryfikacja JWT i ekstrakcja claims (`userId`, `app_role`)
   - `errors.ts`: `ApplicationError` + mapper na HTTP
   - `logger.ts`: spójny logger z kontekstem
   - `supabase-client.ts`: tworzenie klienta Supabase z kontekstu requestu
3. **Walidacja claims**
   - Zod enum dla `app_role`: `z.enum(['user','premium','admin'])`
   - Jeśli brak/niepoprawne → zwrócić 401 z komunikatem „Invalid token claims”
4. **Zapytanie do `profiles`**
   - SELECT: `id, username`
   - Jeśli brak rekordu → 404 „Profile not found”
5. **Złożenie odpowiedzi**
   - Zwrócić `200` z `{ id, username, app_role }`
6. **Kontrakt typów**
   - (Rekomendacja) dodać `MeDto` i `AppRole` do `shared/contracts/types.ts`, aby frontend i backend miały spójny kontrakt.
7. **Testy lokalne (smoke)**
   - uruchomić `supabase functions serve me`
   - wywołać `GET /functions/v1/me` z tokenem testowego użytkownika
   - sprawdzić: 200, 401 bez tokena, 401 dla złego claim, 404 bez profilu
8. **Checklist bezpieczeństwa**
   - potwierdzić, że signup nie pozwala na przesłanie/zmianę `app_role`
   - potwierdzić, że JWT faktycznie zawiera claim `app_role` (konfiguracja Supabase/DB)


