# API Endpoint Implementation Plan: GET /me

## 1. Przegląd punktu końcowego
Endpoint `GET /me` zwraca **minimalny zestaw danych identyfikacyjnych** zalogowanego użytkownika, potrzebny do inicjalizacji UI (App Shell) także na trasach publicznych (np. `/`, `/explore`, `/explore/recipes/:id-:slug`). Endpoint jest tylko do odczytu i wymaga poprawnego JWT z Supabase Auth.

## 2. Szczegóły żądania
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/me` (Supabase Edge Function: `/functions/v1/me`)
- **Parametry**:
    - **Wymagane**:
        - Nagłówek `Authorization: Bearer <JWT_TOKEN>`
    - **Opcjonalne**: Brak
- **Request Body**: Brak

## 3. Wykorzystywane typy
- **`ProfileDto`** (z `shared/contracts/types.ts`):

    ```ts
    export type ProfileDto = {
        id: string;
        username: string;
    };
    ```

- **Model błędu** (konwencja projektu w `supabase/functions/_shared/errors.ts`):

    ```json
    { "code": "UNAUTHORIZED", "message": "Invalid or expired token" }
    ```

## 4. Szczegóły odpowiedzi
- **Odpowiedź sukcesu (200 OK)**:

    ```json
    {
        "id": "a1b2c3d4-...",
        "username": "john.doe"
    }
    ```

- **Odpowiedzi błędów**:
    - **401 Unauthorized**: brak nagłówka `Authorization`, token niepoprawny lub wygasły.
    - **404 Not Found**: użytkownik istnieje w Supabase Auth, ale nie ma rekordu w `public.profiles` (np. wyjątkowy przypadek po migracjach / awaria triggera `handle_new_user`).
    - **500 Internal Server Error**: błąd po stronie serwera (np. błąd bazy, brak konfiguracji Supabase w env, nieobsłużony wyjątek).

## 5. Przepływ danych
1. Żądanie `GET /functions/v1/me` trafia do Edge Function `supabase/functions/me/index.ts`.
2. `index.ts`:
    - loguje request (bez danych wrażliwych),
    - obsługuje `OPTIONS` dla CORS,
    - deleguje request do routera w `me.handlers.ts`,
    - na najwyższym poziomie łapie nieobsłużone wyjątki i mapuje je na `500`.
3. `me.handlers.ts`:
    - wywołuje `getAuthenticatedContext(req)` z `supabase/functions/_shared/supabase-client.ts`, aby:
        - utworzyć klienta Supabase z JWT z nagłówka,
        - pobrać użytkownika (`client.auth.getUser()`),
        - w razie problemów rzucić `ApplicationError('UNAUTHORIZED', ...)`.
    - wywołuje warstwę serwisową: `getMeProfile(client, user.id)`.
    - zwraca `200` z `ProfileDto`.
4. `me.service.ts`:
    - wykonuje zapytanie do `profiles` po kluczu głównym:
        - `SELECT id, username FROM profiles WHERE id = :userId`.
    - mapuje brak rekordu na `ApplicationError('NOT_FOUND', 'Profile not found')`.
    - mapuje błędy bazy na `ApplicationError('INTERNAL_ERROR', 'Failed to fetch profile')`.

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie**:
    - endpoint jest chroniony i wymaga JWT; brak/niepoprawny token = `401`.
    - token **nie może być logowany** (ani w całości, ani w części).
- **Autoryzacja i RLS**:
    - tabela `public.profiles` ma RLS; polityka SELECT powinna pozwalać odczytać wyłącznie własny rekord:

        ```sql
        CREATE POLICY "Enable read access for authenticated users on their own profile"
        ON public.profiles FOR SELECT
        USING (auth.uid() = id);
        ```

- **CORS**:
    - zachować spójne nagłówki CORS jak w innych funkcjach (np. `profile/index.ts`),
    - uwzględnić `Authorization` w `Access-Control-Allow-Headers`.
- **Minimalizacja danych**:
    - endpoint zwraca tylko `id` i `username` (bez e-maila i metadanych z `auth.users`).

## 7. Wydajność
- **Zapytanie po PK** (`profiles.id`) jest stałoczasowe i tanie.
- **Payload jest mały**, więc koszt transferu jest minimalny.
- **Cold start** Edge Function: możliwy, ale wpływ ograniczony (krótka logika i jedno zapytanie).

## 8. Kroki implementacji
1. **Dodanie Edge Function**
    - utworzyć katalog `supabase/functions/me/`.
    - dodać pliki zgodnie ze standardem projektu:

        ```
        supabase/functions/me/
            index.ts
            me.handlers.ts
            me.service.ts
        ```

2. **Router (`me/index.ts`)**
    - skopiować sprawdzony szablon z `supabase/functions/profile/index.ts`:
        - CORS headers,
        - obsługa `OPTIONS` → `204`,
        - logowanie requestu,
        - try/catch na najwyższym poziomie i fallback `500`.
    - zmienić logi oraz import routera na `meRouter`.

3. **Handlers (`me/me.handlers.ts`)**
    - zaimplementować `handleGetMe(req)`:
        - `const { client, user } = await getAuthenticatedContext(req)`
        - `const dto = await getMeProfile(client, user.id)`
        - zwrócić `200` z JSON.
    - zaimplementować `meRouter(req)`:
        - `GET` → `handleGetMe`,
        - `OPTIONS` → `204` (preflight),
        - inne metody → `405 Method Not Allowed`.
    - używać `handleError(error)` z `supabase/functions/_shared/errors.ts`.

4. **Service (`me/me.service.ts`)**
    - zdefiniować stałą `PROFILE_SELECT_COLUMNS = 'id, username'`.
    - zaimplementować `getMeProfile(client, userId)` analogicznie do `profile.service.ts`:
        - `.from('profiles').select(PROFILE_SELECT_COLUMNS).eq('id', userId).single()`
        - obsłużyć `PGRST116` jako `NOT_FOUND`.
    - logować:
        - `info` na start/koniec,
        - `warn` przy `NOT_FOUND`,
        - `error` przy błędach bazy (bez danych wrażliwych).

5. **Typy kontraktów**
    - upewnić się, że frontend i backend używają spójnej struktury `ProfileDto` (już istnieje w `shared/contracts/types.ts`).
    - nie wprowadzać nowego DTO, jeśli `ProfileDto` spełnia wymagania endpointu `GET /me`.

6. **Błędy i ich rejestrowanie**
    - w projekcie nie ma zdefiniowanej „tabeli błędów” w DB planie, więc:
        - używać `logger` (structured logs) + standardowej mapy błędów (`ApplicationError`),
        - jeśli w przyszłości pojawi się tabela audytu/błędów, rozszerzyć `_shared/errors.ts` o opcjonalny zapis do DB.

7. **Testowanie lokalne**
    - uruchomić: `supabase functions serve me`.
    - scenariusze:
        - **200**: poprawny JWT → zwraca `{ id, username }`.
        - **401**: brak `Authorization` lub niepoprawny JWT.
        - **404**: brak rekordu w `profiles` dla `user.id`.
        - **500**: brak env (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) lub wymuszony błąd bazy.

8. **Weryfikacja integracji z frontendem (kontrakt)**
    - frontend powinien traktować `401` jako „użytkownik niezalogowany” i nie blokować tras publicznych.
    - cache w kliencie (opcjonalnie): krótki (np. w pamięci) na czas sesji, ponieważ dane są stabilne.
