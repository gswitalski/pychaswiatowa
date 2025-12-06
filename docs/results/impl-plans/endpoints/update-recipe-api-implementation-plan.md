# API Endpoint Implementation Plan: `PUT /recipes/{id}`

## 1. Przegląd punktu końcowego

Ten punkt końcowy umożliwia uwierzytelnionym użytkownikom aktualizację istniejącego przepisu, którego są właścicielami. Użytkownik może zaktualizować dowolne pole przepisu, w tym jego nazwę, opis, kategorię, składniki, kroki oraz powiązane tagi. Wszystkie pola w ciele żądania są opcjonalne.

## 2. Szczegóły żądania

-   **Metoda HTTP**: `PUT`
-   **Struktura URL**: `/functions/v1/recipes/{id}`
-   **Parametry**:
    -   **Wymagane**:
        -   `id` (w ścieżce URL): numeryczny identyfikator przepisu do aktualizacji.
    -   **Opcjonalne**: Brak
-   **Request Body**:
    -   **Content-Type**: `application/json`
    -   **Struktura**: Obiekt JSON zawierający pola do aktualizacji. Wszystkie pola są opcjonalne.

    ```json
    {
      "name": "Zaktualizowana nazwa przepisu",
      "description": "Nowy, lepszy opis.",
      "category_id": 2,
      "ingredients_raw": "# Nowa sekcja\n- Składnik 1\n- Składnik 2",
      "steps_raw": "1. Nowy krok pierwszy\n2. Nowy krok drugi",
      "tags": ["nowy-tag", "zaktualizowany"]
    }
    ```

## 3. Wykorzystywane typy

-   **Command Model**: `UpdateRecipeCommand` (z `shared/contracts/types.ts`), który jest `Partial<CreateRecipeCommand>`.
-   **DTO Odpowiedzi**: `RecipeDetailDto` (z `recipes.service.ts` i `shared/contracts/types.ts`).

## 4. Szczegóły odpowiedzi

-   **Odpowiedź sukcesu**:
    -   **Kod statusu**: `200 OK`
    -   **Payload**: Pełny obiekt zaktualizowanego przepisu w formacie `RecipeDetailDto`.

    ```json
    {
      "id": 123,
      "user_id": "...",
      "category_id": 2,
      "name": "Zaktualizowana nazwa przepisu",
      "description": "Nowy, lepszy opis.",
      "image_path": null,
      "created_at": "...",
      "updated_at": "...",
      "category_name": "Obiad",
      "ingredients": [
        { "type": "header", "content": "Nowa sekcja" },
        { "type": "item", "content": "Składnik 1" },
        { "type": "item", "content": "Składnik 2" }
      ],
      "steps": [
        { "type": "item", "content": "Nowy krok pierwszy" },
        { "type": "item", "content": "Nowy krok drugi" }
      ],
      "tags": [
        { "id": 1, "name": "nowy-tag" },
        { "id": 2, "name": "zaktualizowany" }
      ]
    }
    ```

-   **Odpowiedzi błędów**:
    -   `400 Bad Request`: Nieprawidłowe dane wejściowe (np. niepoprawne `id`, błędy walidacji ciała żądania).
    -   `401 Unauthorized`: Użytkownik nie jest uwierzytelniony.
    -   `404 Not Found`: Przepis o podanym `id` nie istnieje lub użytkownik nie ma do niego dostępu.
    -   `500 Internal Server Error`: Wewnętrzny błąd serwera (np. błąd bazy danych).

## 5. Przepływ danych

1.  Żądanie `PUT` trafia do `index.ts` w Edge Function `recipes`.
2.  Główny router w `recipes.handlers.ts` identyfikuje metodę `PUT` i obecność `id` w URL, a następnie kieruje żądanie do nowego handlera `handleUpdateRecipe`.
3.  `handleUpdateRecipe` wywołuje `getAuthenticatedContext`, aby zweryfikować JWT i uzyskać `client` Supabase oraz `user_id`.
4.  ID przepisu z URL jest walidowane za pomocą funkcji `parseAndValidateRecipeId`.
5.  Ciało żądania jest parsowane i walidowane przy użyciu nowego schematu Zod `updateRecipeSchema`. Sprawdzane jest również, czy ciało żądania nie jest puste.
6.  Handler wywołuje nową funkcję `updateRecipe` z `recipes.service.ts`, przekazując `client`, `recipeId`, `user_id` oraz zwalidowane dane.
7.  Funkcja `updateRecipe` w serwisie wykonuje logikę biznesową:
    a. Sprawdza, czy przepis o podanym `id` istnieje i należy do użytkownika, próbując go pobrać. RLS zapewnia, że powiedzie się to tylko dla właściciela.
    b. Tworzy nową funkcję RPC w PostgreSQL `update_recipe_with_tags`, która w ramach jednej transakcji:
        i. Aktualizuje podstawowe dane przepisu w tabeli `recipes`.
        ii. Przetwarza `ingredients_raw` i `steps_raw` na JSONB.
        iii. Zarządza tagami: usuwa powiązania z tagami, które nie są już na liście, i tworzy/dodaje powiązania dla nowych tagów.
    c. Wywołuje funkcję RPC `update_recipe_with_tags`.
8.  Po pomyślnej aktualizacji, funkcja `updateRecipe` wywołuje `getRecipeById`, aby pobrać pełne, zaktualizowane dane przepisu.
9.  Zaktualizowany `RecipeDetailDto` jest zwracany do handlera.
10. Handler formatuje odpowiedź `200 OK` z otrzymanym DTO i zwraca ją do klienta.

## 6. Względy bezpieczeństwa

-   **Uwierzytelnianie**: Każde żądanie musi zawierać ważny token JWT w nagłówku `Authorization`. Funkcja `getAuthenticatedContext` zajmie się weryfikacją.
-   **Autoryzacja**: Polityki Row Level Security (RLS) w Supabase zapewnią, że operacja `UPDATE` na tabeli `recipes` powiedzie się tylko wtedy, gdy `auth.uid()` jest równe `user_id` przepisu. To jest główny mechanizm zapobiegający nieautoryzowanym modyfikacjom.
-   **Walidacja danych wejściowych**: Wszystkie dane wejściowe (`id` w URL, ciało żądania) będą rygorystycznie walidowane za pomocą Zod, aby zapobiec błędom i atakom (np. XSS, poprzez trimowanie stringów).

## 7. Rozważania dotyczące wydajności

-   Operacja aktualizacji jest złożona, ponieważ obejmuje wiele tabel (`recipes`, `tags`, `recipe_tags`). Zamknięcie całej logiki w jednej transakcyjnej funkcji RPC (`update_recipe_with_tags`) jest kluczowe dla zapewnienia spójności danych i optymalizacji wydajności przez zminimalizowanie liczby zapytań do bazy danych.
-   Po aktualizacji, do pobrania zaktualizowanych danych wykorzystany zostanie zoptymalizowany widok `recipe_details`, co zapobiega problemowi N+1 zapytań.

## 8. Etapy wdrożenia

1.  **Baza Danych (SQL Migration)**:
    -   Zdefiniuj i utwórz nową funkcję PostgreSQL `update_recipe_with_tags`. Funkcja ta powinna przyjmować `recipe_id`, `user_id` oraz wszystkie opcjonalne pola przepisu jako argumenty.
    -   Funkcja powinna działać w ramach transakcji i wykonywać następujące operacje:
        -   Weryfikacja, czy przepis należy do danego użytkownika.
        -   Aktualizacja pól w tabeli `recipes` tylko jeśli nie są `NULL`.
        -   Obsługa logiki tagów (usunięcie starych, dodanie/utworzenie nowych).

2.  **Warstwa Serwisu (`recipes.service.ts`)**:
    -   Zdefiniuj typ `UpdateRecipeInput` dla danych wejściowych.
    -   Zaimplementuj nową funkcję `updateRecipe(client, recipeId, userId, input)`.
    -   Funkcja ta powinna wywoływać nową funkcję RPC `update_recipe_with_tags`.
    -   Po pomyślnym wywołaniu RPC, powinna wywołać `getRecipeById(client, recipeId)` w celu zwrócenia pełnego, zaktualizowanego obiektu.

3.  **Warstwa Handlera (`recipes.handlers.ts`)**:
    -   Zdefiniuj schemat walidacji `updateRecipeSchema` przy użyciu Zod. Powinien on bazować na `createRecipeSchema`, ale z `optional()` dla wszystkich pól i dodatkową weryfikacją, aby ciało żądania nie było puste (`.refine()`).
    -   Zaimplementuj nową funkcję `handleUpdateRecipe(req, recipeIdParam)`.
    -   W handlerze dodaj logikę do:
        -   Uwierzytelniania użytkownika.
        -   Walidacji `recipeIdParam`.
        -   Walidacji ciała żądania przy użyciu `updateRecipeSchema`.
        -   Wywołania `recipes.service.ts#updateRecipe`.
        -   Zwrócenia odpowiedzi `200 OK` z danymi lub obsługi błędów za pomocą `handleError`.

4.  **Routing (`recipes.handlers.ts`)**:
    -   W funkcji `recipesRouter` dodaj nową logikę do obsługi metody `PUT` dla ścieżek zawierających `recipeId`.
    -   Upewnij się, że `Allow` w nagłówkach odpowiedzi dla błędów `405 Method Not Allowed` jest zaktualizowany o `PUT` i `DELETE`.

5.  **Typy (`shared/contracts/types.ts`)**:
    -   Upewnij się, że typ `UpdateRecipeCommand` jest poprawnie zdefiniowany i eksportowany. (Jest już zdefiniowany jako `Partial<CreateRecipeCommand>`).
