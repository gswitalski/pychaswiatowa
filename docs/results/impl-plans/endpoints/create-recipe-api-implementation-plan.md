# API Endpoint Implementation Plan: `POST /recipes`

## 1. Przegląd punktu końcowego

Ten punkt końcowy umożliwia uwierzytelnionym użytkownikom tworzenie nowego przepisu kulinarnego. Endpoint przyjmuje podstawowe dane przepisu, w tym surowy tekst dla składników i kroków, a także listę nazw tagów. Po stronie serwera tekst jest parsowany do formatu JSONB, a tagi są tworzone lub ponownie wykorzystywane w ramach jednej transakcji bazodanowej. W odpowiedzi zwracany jest nowo utworzony, w pełni zwalidowany i sformatowany obiekt przepisu.

## 2. Szczegóły żądania

-   **Metoda HTTP**: `POST`
-   **Struktura URL**: `/functions/v1/recipes`
-   **Request Body**: Obiekt JSON zgodny z modelem `CreateRecipeCommand`.
    ```json
    {
      "name": "string (1-150 znaków, wymagane)",
      "description": "string (opcjonalne)",
      "category_id": "number (opcjonalne, ID istniejącej kategorii)",
      "ingredients_raw": "string (wymagane)",
      "steps_raw": "string (wymagane)",
      "tags": "string[] (opcjonalne, nazwy tagów, 1-50 znaków każda)"
    }
    ```

## 3. Wykorzystywane typy

-   **Command Model**: `CreateRecipeCommand` (`shared/contracts/types.ts`)
-   **Data Transfer Object (DTO)**: `RecipeDetailDto` (`shared/contracts/types.ts`)

## 4. Szczegóły odpowiedzi

-   **Odpowiedź sukcesu**:
    -   **Kod**: `201 Created`
    -   **Payload**: Obiekt JSON zgodny z `RecipeDetailDto`, zawierający pełne dane nowo utworzonego przepisu, w tym sparsowane `ingredients` i `steps` oraz listę obiektów `tags`.

-   **Odpowiedzi błędu**:
    -   **Kod**: `400 Bad Request` - Błąd walidacji danych wejściowych.
    -   **Kod**: `401 Unauthorized` - Brak lub nieprawidłowy token uwierzytelniania.
    -   **Kod**: `404 Not Found` - Podana kategoria (`category_id`) nie istnieje.
    -   **Kod**: `500 Internal Server Error` - Wewnętrzny błąd serwera, np. niepowodzenie transakcji w bazie danych.

## 5. Przepływ danych

1.  Żądanie `POST` trafia do `index.ts` w Edge Function `recipes`.
2.  Router przekazuje żądanie do handlera `handleCreateRecipe` w `recipes.handlers.ts`.
3.  **Handler**: Weryfikuje token JWT użytkownika w celu uwierzytelnienia.
4.  **Handler**: Waliduje ciało żądania przy użyciu predefiniowanego schematu Zod. W przypadku błędu zwraca `400 Bad Request`.
5.  **Handler**: Wywołuje funkcję `createRecipe` z `recipes.service.ts`, przekazując zweryfikowane dane oraz ID uwierzytelnionego użytkownika.
6.  **Serwis**: Rozpoczyna transakcję bazodanową. Zalecane jest użycie funkcji RPC w PostgreSQL, aby zminimalizować liczbę zapytań i zapewnić atomowość.
7.  **Serwis (lub funkcja RPC)**:
    a. Sprawdza, czy podana `category_id` (jeśli istnieje) jest prawidłowa. Jeśli nie, transakcja jest przerywana, a serwis zwraca błąd `404 Not Found`.
    b. Wywołuje funkcję `parse_text_to_jsonb()` dla `ingredients_raw` i `steps_raw`.
    c. Wstawia nowy rekord do tabeli `recipes`.
    d. Dla każdej nazwy tagu z wejściowej tablicy `tags`:
        i. Sprawdza, czy tag o tej nazwie (ignorując wielkość liter) już istnieje dla danego użytkownika.
        ii. Jeśli tak, pobiera jego ID.
        iii. Jeśli nie, tworzy nowy tag i pobiera jego ID.
    e. Wstawia rekordy do tabeli łączącej `recipe_tags`, wiążąc nowo utworzony przepis z odpowiednimi tagami.
8.  **Serwis**: Zatwierdza transakcję.
9.  **Serwis**: Po pomyślnym utworzeniu, pobiera pełne dane nowego przepisu (używając widoku `recipe_details` i ID z kroku 7c) w celu skonstruowania odpowiedzi.
10. **Serwis**: Zwraca `RecipeDetailDto` do handlera.
11. **Handler**: Formatuje odpowiedź `201 Created` z otrzymanym DTO i wysyła ją do klienta.

## 6. Względy bezpieczeństwa

-   **Uwierzytelnianie**: Każde żądanie musi zawierać prawidłowy token `Bearer` (JWT), który zostanie zweryfikowany w `recipes.handlers.ts`. ID użytkownika zostanie wyodrębnione z tokena i użyte we wszystkich operacjach bazodanowych.
-   **Autoryzacja**: Dostęp do danych jest chroniony przez polityki RLS w bazie danych Supabase. Wszystkie operacje (INSERT, SELECT) będą automatycznie ograniczone do zasobów należących do uwierzytelnionego użytkownika (`user_id = auth.uid()`).
-   **Walidacja danych**: Rygorystyczna walidacja za pomocą Zod na poziomie handlera zapobiega wprowadzeniu nieprawidłowych lub potencjalnie szkodliwych danych do systemu.

## 7. Rozważania dotyczące wydajności

-   **Transakcje i RPC**: Wykonanie całej logiki tworzenia przepisu i zarządzania tagami w ramach jednej funkcji RPC w PostgreSQL znacząco zredukuje opóźnienia sieciowe (latency) w porównaniu do wykonywania wielu oddzielnych zapytań z Edge Function.
-   **Pobieranie danych**: Po utworzeniu przepisu, do pobrania danych zwrotnych należy użyć zoptymalizowanego widoku `recipe_details`, co zapobiegnie problemowi N+1 zapytań przy pobieraniu tagów i kategorii.

## 8. Etapy wdrożenia

1.  **Struktura plików**: Utworzyć strukturę katalogów `supabase/functions/recipes/` (jeśli nie istnieje) oraz pliki: `index.ts`, `recipes.handlers.ts`, `recipes.service.ts`.
2.  **Walidacja (Handler)**: W `recipes.handlers.ts` zdefiniować schemat walidacji Zod dla `CreateRecipeCommand`.
3.  **Funkcja RPC (Baza Danych)**:
    -   Utworzyć nowy plik migracji w `supabase/migrations/`.
    -   Zaimplementować funkcję PostgreSQL `create_recipe_with_tags(name, description, ..., user_id)`, która będzie realizować logikę opisaną w punkcie "Przepływ danych" (krok 7) w ramach jednej transakcji. Funkcja powinna zwracać ID nowo utworzonego przepisu.
4.  **Logika biznesowa (Serwis)**: W `recipes.service.ts` zaimplementować funkcję `createRecipe`, która:
    -   Przyjmuje `CreateRecipeCommand` i `userId`.
    -   Wywołuje funkcję RPC `create_recipe_with_tags`.
    -   Po pomyślnym wykonaniu RPC, odpytuje widok `recipe_details` o dane nowo utworzonego przepisu.
    -   Zwraca `RecipeDetailDto`.
5.  **Obsługa żądania (Handler)**: W `recipes.handlers.ts` zaimplementować `handleCreateRecipe`, która:
    -   Weryfikuje JWT.
    -   Waliduje request body.
    -   Wywołuje `recipes.service.ts`.
    -   Obsługuje błędy i formatuje odpowiedzi (sukces `201` lub błędy `4xx`/`5xx`).
6.  **Routing (index.ts)**: W `recipes/index.ts` skonfigurować router do obsługi metody `POST` na ścieżce `/` i skierowania jej do `handleCreateRecipe`.
7.  **Testy**: Dodać testy integracyjne w celu weryfikacji poprawnego działania endpointu, w tym obsługi przypadków brzegowych i błędów.
