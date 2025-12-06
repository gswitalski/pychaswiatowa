# API Endpoint Implementation Plan: GET /tags

## 1. Przegląd punktu końcowego
Ten punkt końcowy umożliwia uwierzytelnionym użytkownikom pobranie listy wszystkich tagów, które sami utworzyli. Zwraca tablicę obiektów zawierających ID i nazwę każdego tagu.

## 2. Szczegóły żądania
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/tags`
-   **Parametry**:
    -   Wymagane: Brak
    -   Opcjonalne: Brak
-   **Request Body**: Brak

## 3. Wykorzystywane typy
-   **`TagDto`**: Używany do strukturyzacji danych wyjściowych.
    ```typescript
    export type TagDto = Pick<Tag, 'id' | 'name'>;
    ```

## 4. Szczegóły odpowiedzi
-   **Odpowiedź sukcesu (200 OK)**:
    ```json
    [
      { "id": 1, "name": "wegetariańskie" },
      { "id": 2, "name": "ostre" },
      { "id": 5, "name": "szybkie" }
    ]
    ```
-   **Odpowiedzi błędów**:
    -   `401 Unauthorized`: Gdy żądanie nie jest uwierzytelnione.
    -   `500 Internal Server Error`: W przypadku problemów z serwerem lub bazą danych.

## 5. Przepływ danych
1.  Żądanie `GET /tags` trafia do `index.ts` w Edge Function `tags`.
2.  Główny router weryfikuje token JWT za pomocą współdzielonej funkcji `auth.ts` i wyodrębnia `user_id`.
3.  Żądanie jest przekierowywane do `handleGetTags` w `tags.handlers.ts`.
4.  Handler wywołuje funkcję `getTags(userId)` z serwisu `tags.service.ts`.
5.  Serwis wykonuje zapytanie do bazy danych Supabase: `supabase.from('tags').select('id, name').eq('user_id', userId)`.
6.  Baza danych, z włączonym RLS, zwraca tylko te tagi, których właścicielem jest uwierzytelniony użytkownik.
7.  Serwis zwraca listę tagów do handlera.
8.  Handler formatuje odpowiedź jako JSON i wysyła ją z kodem statusu `200 OK`.

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie**: Punkt końcowy musi być chroniony i dostępny tylko dla uwierzytelnionych użytkowników. Każde żądanie musi zawierać prawidłowy nagłówek `Authorization: Bearer <JWT>`.
-   **Autoryzacja**: Polityki Row Level Security (RLS) w Supabase zapewniają, że użytkownik może odczytać wyłącznie własne tagi. Zapytanie w serwisie dodatkowo filtruje dane po `user_id`, co stanowi drugą warstwę zabezpieczeń.

## 7. Obsługa błędów
-   **Brak tokenu/Nieprawidłowy token**: `index.ts` zwróci odpowiedź `401 Unauthorized` przed przekazaniem żądania do handlera.
-   **Błąd bazy danych**: Każdy błąd zwrócony przez Supabase podczas zapytania zostanie przechwycony w bloku `try...catch`, zalogowany przy użyciu współdzielonego loggera, a do klienta zostanie wysłana odpowiedź `500 Internal Server Error`.

## 8. Rozważania dotyczące wydajności
-   Zapytanie do bazy jest proste i powinno być wydajne. Tabela `tags` posiada indeks na kolumnie `user_id`, co przyspiesza filtrowanie.
-   Dla bardzo dużej liczby tagów (>1000 na użytkownika) w przyszłości można rozważyć implementację paginacji, ale nie jest to wymagane w wersji MVP.

## 9. Etapy wdrożenia
1.  **Struktura plików**: Utwórz nową funkcję w katalogu `supabase/functions/tags/`.
2.  **Serwis (`tags.service.ts`)**:
    -   Zaimplementuj funkcję `async function getTags(supabase: SupabaseClient, userId: string): Promise<TagDto[]>`.
    -   Funkcja powinna wykonać zapytanie `select('id, name')` do tabeli `tags`, filtrując po `user_id`.
    -   W przypadku błędu zapytania, zaloguj go i rzuć `ApplicationError`.
3.  **Handler (`tags.handlers.ts`)**:
    -   Zaimplementuj `async function handleGetTags(req: Request, supabase: SupabaseClient, userId: string): Promise<Response>`.
    -   Wywołaj `getTags(supabase, userId)` z serwisu.
    -   Zwróć odpowiedź JSON z listą tagów i statusem `200 OK`.
4.  **Router (`index.ts`)**:
    -   Skonfiguruj główny router, aby obsługiwał żądania `GET`.
    -   Zintegruj mechanizm weryfikacji tokenu JWT.
    -   W przypadku żądania `GET /tags`, wywołaj `handleGetTags`.
    -   Zaimplementuj globalną obsługę błędów, która przechwytuje `ApplicationError` i inne wyjątki, zwracając odpowiednie kody statusu HTTP.
5.  **Współdzielony kod**: Upewnij się, że funkcja ma dostęp do współdzielonych modułów, takich jak `supabase-client.ts`, `errors.ts` i `logger.ts`.
