# API Endpoint Implementation Plan: GET /categories

## 1. Przegląd punktu końcowego
Ten punkt końcowy umożliwia pobranie pełnej listy predefiniowanych kategorii przepisów, takich jak "Obiad", "Deser" czy "Zupa". Jest to operacja typu "read-only", dostępna wyłącznie dla uwierzytelnionych użytkowników.

## 2. Szczegóły żądania
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/functions/v1/categories`
-   **Parametry**:
    -   Wymagane: Brak
    -   Opcjonalne: Brak
-   **Request Body**: Brak

## 3. Wykorzystywane typy
-   **`CategoryDto`**: Obiekt transferu danych (DTO) reprezentujący pojedynczą kategorię w odpowiedzi.
    ```typescript:shared/contracts/types.ts
    export type CategoryDto = Pick<Category, 'id' | 'name'>;
    ```

## 4. Szczegóły odpowiedzi
-   **Odpowiedź sukcesu (Success Response)**:
    -   **Kod**: `200 OK`
    -   **Struktura (Payload)**: Tablica obiektów `CategoryDto`.
        ```json
        [
          { "id": 1, "name": "Obiad" },
          { "id": 2, "name": "Deser" },
          { "id": 3, "name": "Zupa" }
        ]
        ```
-   **Odpowiedź błędu (Error Response)**:
    -   **Kod**: `401 Unauthorized` - W przypadku braku lub nieprawidłowego tokenu uwierzytelniającego.
    -   **Kod**: `500 Internal Server Error` - W przypadku problemów z serwerem lub bazą danych.

## 5. Przepływ danych
1.  Żądanie `GET` trafia do funkcji Supabase Edge Function pod adresem `/functions/v1/categories`.
2.  Plik `index.ts` przechwytuje żądanie i w pierwszej kolejności weryfikuje token JWT w nagłówku `Authorization`.
3.  Po pomyślnej autoryzacji, router kieruje żądanie do dedykowanego handlera w `categories.handlers.ts`.
4.  Handler wywołuje funkcję `getAllCategories()` z pliku `categories.service.ts`.
5.  Funkcja serwisowa wykonuje zapytanie `SELECT id, name FROM categories ORDER BY name ASC` do bazy danych PostgreSQL za pomocą klienta Supabase.
6.  Serwis zwraca listę kategorii do handlera.
7.  Handler formatuje dane do postaci `CategoryDto[]` i wysyła odpowiedź HTTP z kodem `200 OK`.

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie**: Punkt końcowy musi być chroniony i dostępny tylko dla zalogowanych użytkowników. Każde żądanie musi zawierać prawidłowy nagłówek `Authorization: Bearer <JWT>`.
-   **Autoryzacja (RLS)**: Tabela `categories` jest tabelą słownikową i powinna być dostępna do odczytu dla wszystkich uwierzytelnionych użytkowników. Polityka RLS dla tej tabeli powinna zezwalać na operacje `SELECT` dla roli `authenticated`.

## 7. Obsługa błędów
-   **Brak uwierzytelnienia**: Jeśli token JWT jest nieprawidłowy, brakujący lub wygasł, funkcja w `index.ts` natychmiast zwróci odpowiedź z kodem `401 Unauthorized`.
-   **Błąd bazy danych**: Jeśli zapytanie do bazy danych nie powiedzie się, funkcja serwisowa rzuci wyjątek. Scentralizowany mechanizm obsługi błędów przechwyci go i zwróci odpowiedź z kodem `500 Internal Server Error` wraz z zarejestrowaniem błędu.

## 8. Rozważania dotyczące wydajności
-   Tabela `categories` będzie zawierać niewielką liczbę rekordów, więc nie przewiduje się problemów z wydajnością.
-   Zapytanie `SELECT` będzie operować na indeksowanym kluczu głównym (`id`) i posortuje wyniki po kolumnie `name`, co jest optymalne dla małych zbiorów danych.

## 9. Etapy wdrożenia
1.  **Struktura plików**: Utwórz nowy katalog `supabase/functions/categories/`.
2.  **Serwis**: W katalogu `categories` utwórz plik `categories.service.ts`. Zaimplementuj w nim asynchroniczną funkcję `getAllCategories`, która:
    -   Importuje współdzielony klient Supabase.
    -   Wykonuje zapytanie `select('id, name').from('categories').order('name')`.
    -   Obsługuje potencjalne błędy zapytania i rzuca `ApplicationError` w razie niepowodzenia.
    -   Zwraca pobrane dane.
3.  **Handler**: W katalogu `categories` utwórz plik `categories.handlers.ts`. Zaimplementuj w nim:
    -   Funkcję `handleGetCategories`, która wywołuje `categories.service.ts` i wysyła odpowiedź `200 OK` z danymi.
    -   Funkcję `categoriesRouter`, która obsługuje metodę `GET` na ścieżce `/` i kieruje ją do `handleGetCategories`.
4.  **Router główny**: W katalogu `categories` utwórz plik `index.ts`, który:
    -   Importuje `categoriesRouter`.
    -   Implementuje główną logikę serwera (obsługa `CORS`, weryfikacja JWT, routing).
    -   Deleguje obsługę żądań do `categoriesRouter`.
5.  **Testowanie**: Uruchom funkcję lokalnie za pomocą `supabase functions serve categories` i przetestuj jej działanie (zarówno scenariusz pomyślny, jak i błędy) używając narzędzia do testowania API (np. Postman, cURL).
6.  **Wdrożenie**: Wdróż funkcję na platformie Supabase za pomocą komendy `supabase functions deploy categories`.
