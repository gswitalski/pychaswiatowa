# API Endpoint Implementation Plan: GET /recipes

## 1. Przegląd punktu końcowego
Ten punkt końcowy umożliwia pobieranie listy przepisów dla uwierzytelnionego użytkownika. Udostępnia zaawansowane opcje paginacji, sortowania, filtrowania według kategorii i tagów oraz wyszukiwania pełnotekstowego, aby umożliwić elastyczne przeglądanie danych.

## 2. Szczegóły żądania
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/functions/v1/recipes`
-   **Parametry (Query Params)**:
    -   **Opcjonalne**:
        -   `page` (integer, domyślnie: `1`): Numer strony do wyświetlenia.
        -   `limit` (integer, domyślnie: `20`): Liczba przepisów na stronie.
        -   `sort` (string, np. `name.asc`, `created_at.desc`): Klucz i kierunek sortowania. Domyślnie `created_at.desc`.
        -   `filter[category_id]` (integer): ID kategorii do filtrowania przepisów.
        -   `filter[tags]` (string, np. `"ciasta,deser"`): Lista nazw tagów oddzielonych przecinkami.
        -   `search` (string): Fraza do wyszukiwania pełnotekstowego w nazwie i składnikach przepisu.

## 3. Wykorzystywane typy
-   `RecipeListItemDto`: Reprezentuje pojedynczy przepis na liście.
    ```typescript
    export type RecipeListItemDto = Pick<
        Recipe,
        'id' | 'name' | 'image_path' | 'created_at'
    >;
    ```
-   `PaginatedResponseDto<RecipeListItemDto>`: Struktura odpowiedzi zawierająca listę przepisów i dane paginacji.
    ```typescript
    export interface PaginatedResponseDto<T> {
        data: T[];
        pagination: PaginationDetails;
    }
    ```

## 4. Szczegóły odpowiedzi
-   **Odpowiedź sukcesu (200 OK)**:
    ```json
    {
      "data": [
        {
          "id": 1,
          "name": "Szarlotka",
          "image_path": "path/to/image.jpg",
          "created_at": "2023-10-27T10:00:00Z"
        }
      ],
      "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "totalItems": 100
      }
    }
    ```
-   **Odpowiedzi błędów**:
    -   `400 Bad Request`: Nieprawidłowe parametry zapytania.
    -   `401 Unauthorized`: Brak autoryzacji.
    -   `500 Internal Server Error`: Błąd po stronie serwera.

## 5. Przepływ danych
1.  Żądanie `GET` trafia do `recipes/index.ts` i jest kierowane do handlera `handleGetRecipes`.
2.  `handleGetRecipes` (`recipes.handlers.ts`) parsuje parametry zapytania z URL.
3.  Zdefiniowany schemat `Zod` waliduje i przekształca parametry (np. konwertuje stringi na liczby, dzieli listę tagów).
4.  W przypadku błędu walidacji, handler zwraca odpowiedź `400 Bad Request`.
5.  Handler wywołuje funkcję `getRecipes` z `recipes.service.ts`, przekazując jej obiekt z opcjami paginacji, sortowania i filtrowania.
6.  `getRecipes` dynamicznie buduje zapytanie do Supabase na podstawie otrzymanych parametrów, używając widoku `recipe_details` w celu optymalizacji.
7.  Zapytanie jest rozszerzane o warunki:
    -   Filtrowanie po `user_id` (zgodnie z RLS).
    -   Warunek `deleted_at IS NULL` (soft delete).
    -   Filtry `category_id` i `tags`, jeśli zostały podane.
    -   Wyszukiwanie pełnotekstowe (`textSearch`) dla parametru `search`.
    -   Sortowanie (`order`).
    -   Paginacja (`range`).
8.  Serwis wykonuje dwa zapytania: jedno do pobrania danych, drugie do zliczenia całkowitej liczby pasujących rekordów (potrzebne do paginacji).
9.  Serwis oblicza `totalPages` i konstruuje obiekt `PaginatedResponseDto`.
10. Handler odbiera dane z serwisu i wysyła odpowiedź `200 OK` do klienta.

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie**: Każde żądanie musi zawierać prawidłowy token JWT w nagłówku `Authorization`. Tożsamość użytkownika jest weryfikowana na podstawie tokena.
-   **Autoryzacja**: Dostęp do danych jest chroniony przez polityki Row Level Security (RLS) w PostgreSQL. Użytkownik może pobrać tylko te przepisy, których jest właścicielem (`user_id = auth.uid()`).

## 7. Obsługa błędów
-   **400 Bad Request**: Zwracany, gdy parametry zapytania są nieprawidłowe (np. `page` nie jest liczbą, `sort` ma zły format). Odpowiedź będzie zawierać szczegóły błędu walidacji.
-   **401 Unauthorized**: Zwracany, gdy token JWT jest nieprawidłowy, wygasł lub go brakuje.
-   **500 Internal Server Error**: Zwracany w przypadku nieoczekiwanych problemów po stronie serwera, np. błędu połączenia z bazą danych.

## 8. Wydajność
-   **Indeksy**: Baza danych wykorzystuje indeksy na kolumnach `user_id`, `name`, `created_at` oraz indeks GIN dla wyszukiwania pełnotekstowego, co zapewnia wysoką wydajność zapytań.
-   **Widok `recipe_details`**: Użycie predefiniowanego widoku `recipe_details` minimalizuje liczbę złączeń (JOIN) wykonywanych w czasie rzeczywistym i zapobiega problemowi N+1 przy pobieraniu powiązanych danych (np. tagów).
-   **Paginacja**: Ograniczenie liczby zwracanych wyników jest kluczowe dla wydajności i zmniejszenia obciążenia zarówno serwera, jak i klienta.

## 9. Etapy wdrożenia
1.  **Handler (`recipes.handlers.ts`)**:
    a. Zdefiniować schemat walidacji `Zod` dla wszystkich parametrów zapytania (`page`, `limit`, `sort`, `filter`, `search`).
    b. W `handleGetRecipes` zaimplementować logikę parsowania i walidacji parametrów przy użyciu stworzonego schematu.
    c. W przypadku błędu walidacji, przygotować i zwrócić odpowiedź o statusie `400` z komunikatem błędu.

2.  **Serwis (`recipes.service.ts`)**:
    a. Zaktualizować sygnaturę funkcji `getRecipes`, aby przyjmowała obiekt z opcjonalnymi parametrami do filtrowania, sortowania i paginacji.
    b. Zrefaktoryzować logikę budowania zapytania, aby była w pełni dynamiczna. Używać `if` do warunkowego dołączania kolejnych metod (`.eq()`, `.in()`, `.textSearch()`, `.order()`) do konstruktora zapytań Supabase.
    c. Zaimplementować obsługę filtrowania po wielu tagach (prawdopodobnie przez funkcję RPC lub złożone zapytanie).
    d. Zaimplementować oddzielne zapytanie `count` z tymi samymi filtrami, aby uzyskać całkowitą liczbę elementów.
    e. Na podstawie `limit` i `totalItems` obliczyć `totalPages`.
    f. Zwrócić obiekt zgodny z interfejsem `PaginatedResponseDto<RecipeListItemDto>`.

3.  **Integracja**:
    a. Połączyć zaktualizowany handler z serwisem, przekazując poprawnie zwalidowane i przetworzone parametry.
    b. Upewnić się, że odpowiedź z serwisu jest poprawnie formatowana i zwracana do klienta w `handleGetRecipes`.
