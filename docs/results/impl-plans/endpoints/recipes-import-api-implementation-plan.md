# API Endpoints Implementation Plan: `POST /recipes/import`

## 1. Przegląd punktu końcowego
Endpoint `POST /recipes/import` umożliwia użytkownikom tworzenie nowych przepisów poprzez przesłanie surowego bloku tekstu. Serwer jest odpowiedzialny za sparsowanie tego tekstu w celu wyodrębnienia nazwy przepisu, listy składników i kroków przygotowania, a następnie zapisanie ich w ustrukturyzowanej formie w bazie danych. W odpowiedzi zwracany jest pełny obiekt nowo utworzonego przepisu.

## 2. Szczegóły żądania
-   **Metoda HTTP**: `POST`
-   **Struktura URL**: `/recipes/import`
-   **Parametry**: Brak parametrów w URL.
-   **Request Body**:
    -   **Typ zawartości**: `application/json`
    -   **Struktura**:
        ```json
        {
          "raw_text": "string"
        }
        ```
    -   **Walidacja**:
        -   `raw_text`: Musi być niepustym ciągiem znaków.

## 3. Wykorzystywane typy
-   **Command Model (Żądanie)**: `ImportRecipeCommand`
    ```typescript
    // shared/contracts/types.ts
    export type ImportRecipeCommand = {
        raw_text: string;
    };
    ```
-   **DTO (Odpowiedź)**: `RecipeDetailDto`
    ```typescript
    // shared/contracts/types.ts
    export type RecipeDetailDto = Omit<
        RecipeDetail,
        'ingredients' | 'steps' | 'tags' | 'collections'
    > & {
        ingredients: RecipeContent;
        steps: RecipeContent;
        tags: TagDto[];
    };
    ```

## 4. Szczegóły odpowiedzi
-   **Odpowiedź sukcesu**:
    -   **Kod statusu**: `201 Created`
    -   **Ciało odpowiedzi**: Obiekt JSON reprezentujący nowo utworzony przepis, zgodny z typem `RecipeDetailDto`.
        ```json
        {
          "id": 102,
          "user_id": "user-uuid-...",
          "name": "Pizza",
          "description": null,
          "category_id": null,
          "category_name": null,
          "image_path": null,
          "ingredients": [
            {"type": "header", "content": "Ciasto"},
            {"type": "item", "content": "mąka"},
            {"type": "item", "content": "drożdże"}
          ],
          "steps": [
            {"type": "item", "content": "krok 1"}
          ],
          "tags": [],
          "created_at": "2023-10-28T10:00:00Z",
          "updated_at": "2023-10-28T10:00:00Z"
        }
        ```
-   **Odpowiedzi błędów**:
    -   **Kod statusu**: `400 Bad Request`
    -   **Ciało odpowiedzi**: `{ "message": "Treść błędu" }` (np. "Invalid recipe format. A title (#) is required.")
    -   **Kod statusu**: `401 Unauthorized`
    -   **Kod statusu**: `500 Internal Server Error`

## 5. Przepływ danych
1.  Klient wysyła żądanie `POST` na adres `/functions/v1/recipes/import` z tokenem JWT w nagłówku `Authorization` i obiektem `{ "raw_text": "..." }` w ciele.
2.  Router w `supabase/functions/recipes/index.ts` przechwytuje żądanie i kieruje je do odpowiedniego handlera w `recipes.handlers.ts`.
3.  Handler weryfikuje token JWT, aby uzyskać `user_id`.
4.  Handler waliduje ciało żądania przy użyciu schematu Zod.
5.  Jeśli walidacja przejdzie pomyślnie, handler wywołuje funkcję `importRecipeFromText(userId, rawText)` z `recipes.service.ts`.
6.  Serwis parsuje `rawText`: wyodrębnia nazwę, surowy tekst dla składników i kroków.
7.  Serwis wywołuje istniejącą logikę `createRecipe`, która z kolei używa funkcji bazodanowej `parse_text_to_jsonb` do konwersji tekstu na format JSONB.
8.  Dane są zapisywane w tabeli `recipes` w bazie danych PostgreSQL.
9.  Serwis pobiera pełne dane nowo utworzonego przepisu (używając widoku `recipe_details`).
10. Handler otrzymuje dane z serwisu i formatuje odpowiedź HTTP z kodem `201 Created` i DTO przepisu w ciele.

## 6. Względy bezpieczeństwa
-   **Uwierzytelnianie**: Dostęp do endpointu jest chroniony. Każde żądanie musi zawierać ważny token JWT w nagłówku `Authorization`.
-   **Autoryzacja**: Polityki Row Level Security (RLS) w Supabase zapewniają, że użytkownik może tworzyć przepisy tylko w swoim imieniu (`user_id` w tabeli `recipes` musi być zgodne z `auth.uid()`).
-   **Walidacja danych**: Wszystkie dane wejściowe są walidowane za pomocą Zod, aby zapobiec nieprawidłowym lub złośliwym danym.

## 7. Obsługa błędów
-   **Błędy walidacji (400)**: Zwracane, gdy `raw_text` jest puste, ma nieprawidłowy format lub brakuje w nim wymaganego tytułu (linii rozpoczynającej się od `#`).
-   **Błąd autoryzacji (401)**: Zwracany, gdy token JWT jest nieobecny, nieważny lub wygasł.
-   **Błędy serwera (500)**: Zwracane w przypadku nieoczekiwanych problemów, takich jak błąd połączenia z bazą danych lub krytyczny błąd parsowania. Wszystkie błędy serwera są logowane po stronie serwera.

## 8. Rozważania dotyczące wydajności
-   Operacje parsowania tekstu są wykonywane w pamięci i powinny być bardzo szybkie dla typowych długości przepisów.
-   Operacje bazodanowe ograniczają się do pojedynczej transakcji zapisu i odczytu, co jest optymalne.
-   Nie przewiduje się problemów z wydajnością dla tego endpointu przy normalnym obciążeniu.

## 9. Etapy wdrożenia
1.  **Aktualizacja definicji typów**: Upewnić się, że `ImportRecipeCommand` istnieje w `shared/contracts/types.ts`.
2.  **Implementacja logiki w `recipes.service.ts`**:
    -   Stworzyć nową, eksportowaną funkcję asynchroniczną `importRecipeFromText(userId: string, rawText: string): Promise<RecipeDetail>`.
    -   Zaimplementować logikę do parsowania `rawText` w celu wyodrębnienia nazwy, składników i kroków. Rzucić `ApplicationError` w przypadku braku tytułu.
    -   Wywołać istniejącą funkcję do tworzenia przepisu, przekazując jej sparsowane dane.
    -   Zwrócić pełne dane nowo utworzonego przepisu.
3.  **Implementacja w `recipes.handlers.ts`**:
    -   Stworzyć schemat walidacji Zod dla `ImportRecipeCommand`.
    -   Stworzyć nowy handler `handleImportRecipe`, który będzie obsługiwał żądanie.
    -   W handlerze zwalidować ciało żądania, wywołać `importRecipeFromText` z serwisu i zwrócić odpowiedź `201 Created` z danymi przepisu.
4.  **Aktualizacja routera w `index.ts`**:
    -   Dodać nową regułę w głównym routerze funkcji `recipes`, aby kierować żądania `POST /import` do `handleImportRecipe`. Upewnić się, że jest ona sprawdzana przed bardziej ogólnymi ścieżkami, takimi jak `POST /`.
5.  **Testowanie**: Dodać testy jednostkowe dla nowej logiki w `recipes.service.ts` (szczególnie dla funkcji parsowania) oraz testy integracyjne dla całego endpointu.
