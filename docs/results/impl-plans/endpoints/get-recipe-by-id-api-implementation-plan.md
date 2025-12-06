# API Endpoint Implementation Plan: GET /recipes/{id}

## 1. Przegląd punktu końcowego
Ten punkt końcowy umożliwia pobranie szczegółowych informacji o pojedynczym przepisie na podstawie jego unikalnego identyfikatora. Dostęp jest ograniczony wyłącznie do uwierzytelnionego użytkownika, który jest właścicielem przepisu. Endpoint wykorzystuje widok `recipe_details` w celu zoptymalizowania zapytań i uniknięcia problemu N+1.

## 2. Szczegóły żądania
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/recipes/{id}`
-   **Parametry**:
    -   **Wymagane**:
        -   `id` (w ścieżce): numeryczny identyfikator przepisu.
    -   **Opcjonalne**: Brak.
-   **Request Body**: Brak.

## 3. Wykorzystywane typy
-   **DTO (Data Transfer Object)**: `RecipeDetailDto`
    -   Struktura ta będzie używana do formatowania danych wyjściowych. Zawiera wszystkie kluczowe informacje o przepisie, w tym dane złączone z kategorii, tagów i kolekcji.
    -   Definicja znajduje się w `shared/contracts/types.ts`.

## 4. Szczegóły odpowiedzi
-   **Odpowiedź sukcesu (`200 OK`)**:
    -   Zwraca obiekt JSON zgodny z typem `RecipeDetailDto`.
    ```json
    {
        "id": 1,
        "user_id": "user-uuid",
        "category_id": 2,
        "name": "Spaghetti Bolognese",
        "description": "Klasyczne włoskie danie.",
        "image_path": "path/to/image.jpg",
        "created_at": "2025-12-06T10:00:00Z",
        "updated_at": "2025-12-06T11:00:00Z",
        "category_name": "Obiad",
        "ingredients": [
            { "type": "header", "content": "Sos" },
            { "type": "item", "content": "500g mięsa mielonego" }
        ],
        "steps": [
            { "type": "item", "content": "Podsmaż mięso na patelni." }
        ],
        "tags": [
            { "id": 10, "name": "włoskie" },
            { "id": 15, "name": "makaron" }
        ]
    }
    ```
-   **Odpowiedzi błędów**:
    -   `400 Bad Request`: Jeśli `id` w URL nie jest prawidłową liczbą.
    -   `401 Unauthorized`: Jeśli użytkownik nie jest uwierzytelniony (brak nagłówka `Authorization`).
    -   `404 Not Found`: Jeśli przepis o podanym `id` nie istnieje, został usunięty (`deleted_at` jest ustawione) lub użytkownik nie jest jego właścicielem.
    -   `500 Internal Server Error`: W przypadku nieoczekiwanego błędu serwera.

## 5. Przepływ danych
1.  Żądanie `GET` trafia do głównego routera w `supabase/functions/recipes/index.ts`.
2.  Router identyfikuje ścieżkę `/recipes/([^/]+)` i metodę `GET`, a następnie przekierowuje żądanie do odpowiedniego handlera w `recipes.handlers.ts`.
3.  Handler `handleGetRecipeById` jest wywoływany:
    a. Ekstrahuje `id` z parametrów ścieżki.
    b. Waliduje `id` - sprawdza, czy jest to poprawna, dodatnia liczba całkowita. Jeśli nie, zwraca `400 Bad Request`.
    c. Wywołuje funkcję `getRecipeById(id)` z serwisu `recipes.service.ts`.
4.  Serwis `getRecipeById` wykonuje następujące operacje:
    a. Używa klienta Supabase do wykonania zapytania do widoku `recipe_details`.
    b. Zapytanie filtruje wyniki po `id`.
    c. Polityki RLS na poziomie bazy danych automatycznie zapewniają, że zapytanie zwróci dane tylko wtedy, gdy `user_id` pasuje do ID uwierzytelnionego użytkownika (`auth.uid()`) oraz `deleted_at IS NULL`.
5.  Serwis analizuje wynik zapytania:
    a. Jeśli zapytanie zwróci dane, serwis mapuje je na DTO `RecipeDetailDto` i zwraca do handlera.
    b. Jeśli zapytanie nie zwróci danych (z powodu braku rekordu lub blokady RLS), serwis zwraca `null` lub rzuca dedykowany błąd `NotFoundError`.
6.  Handler otrzymuje dane z serwisu:
    a. Jeśli otrzymał `RecipeDetailDto`, formatuje odpowiedź `200 OK` z obiektem w ciele.
    b. Jeśli otrzymał informację o braku danych, zwraca odpowiedź `404 Not Found`.
    c. W przypadku innych błędów (np. błąd walidacji, błąd serwera), zwraca odpowiedni kod statusu i komunikat błędu.

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie**: Każde żądanie musi zawierać ważny token JWT w nagłówku `Authorization`. Weryfikacja tokenu jest obsługiwana przez Supabase Edge Functions.
-   **Autoryzacja**: Polityki PostgreSQL Row Level Security (RLS) są kluczowym mechanizmem zabezpieczającym. Zapewniają one, że użytkownik może odczytać wyłącznie te przepisy, dla których jego `user_id` zgadza się z `auth.uid()`.
-   **Walidacja danych wejściowych**: Parametr `id` musi być rygorystycznie walidowany jako liczba, aby zapobiec potencjalnym atakom (np. próbom iniekcji).

## 7. Rozważania dotyczące wydajności
-   **Użycie widoku `recipe_details`**: Wykorzystanie predefiniowanego widoku bazodanowego jest kluczowe dla wydajności. Agreguje on dane z wielu tabel (`recipes`, `categories`, `tags`) w jednym zapytaniu, co eliminuje problem N+1 zapytań i zmniejsza obciążenie bazy danych.
-   **Indeksowanie**: Tabela `recipes` musi mieć założony indeks na kluczu głównym `id`, co jest standardem i zapewnia błyskawiczne wyszukiwanie.

## 8. Etapy wdrożenia
1.  **Aktualizacja serwisu (`recipes.service.ts`)**:
    -   Utwórz nową, asynchroniczną funkcję `getRecipeById(id: number)`.
    -   Wewnątrz funkcji, użyj `supabase-js` do wykonania zapytania:
        ```typescript
        const { data, error } = await supabase
            .from('recipe_details')
            .select('*')
            .eq('id', id)
            .single();
        ```
    -   Obsłuż błąd (`error`) i przypadek, gdy dane nie zostaną znalezione (`data` jest `null`).
    -   Jeśli dane zostaną znalezione, zwróć je. W przeciwnym razie rzuć błąd `NotFoundError`.
2.  **Aktualizacja handlera (`recipes.handlers.ts`)**:
    -   Utwórz nową, asynchroniczną funkcję `handleGetRecipeById(req: Request, recipeId: string)`.
    -   Sparsuj `recipeId` do liczby. W przypadku błędu parsowania, zwróć `ApplicationError` z kodem 400.
    -   Wywołaj `recipesService.getRecipeById()` z przekonwertowanym ID.
    -   Zawiń wywołanie w blok `try...catch`, aby obsłużyć błędy rzucane przez serwis.
    -   W przypadku sukcesu, zwróć odpowiedź `200 OK` z danymi w formacie JSON.
    -   W przypadku błędu `NotFoundError`, zwróć odpowiedź `404 Not Found`.
3.  **Aktualizacja routera (`index.ts`)**:
    -   W głównym routerze funkcji `recipes` dodaj nową regułę obsługującą żądania `GET` dla ścieżki pasującej do wzorca `/recipes/([^/]+)`.
    -   Reguła ta powinna wywoływać nowo utworzony handler `handleGetRecipeById`, przekazując mu przechwycone ID przepisu.
    -   Upewnij się, że ta reguła jest sprawdzana przed bardziej ogólnymi ścieżkami (np. `/recipes`).
