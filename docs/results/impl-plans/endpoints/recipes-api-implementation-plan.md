# API Endpoints Implementation Plan: Recipes

## 1. Przegląd punktu końcowego
Ten plan obejmuje implementację i modyfikację trzech punktów końcowych API związanych z zarządzaniem przepisami:
- `POST /recipes`: Tworzenie nowego przepisu.
- `PUT /recipes/{id}`: Aktualizacja istniejącego przepisu.
- `POST /recipes/import`: Importowanie przepisu z surowego tekstu.
Głównym celem jest zapewnienie poprawnego tworzenia i aktualizowania przepisów, w tym rozszerzonej logiki parsowania składników i kroków (szczególnie usuwanie numeracji i punktorów z kroków) oraz integracji z tagami i kategoriami użytkownika.

## 2. Szczegóły żądania

### `POST /recipes`
- Metoda HTTP: `POST`
- Struktura URL: `/recipes`
- Parametry:
  - Wymagane:
    - `name` (string): Nazwa przepisu (1-150 znaków).
    - `ingredients_raw` (string): Surowy tekst składników.
    - `steps_raw` (string): Surowy tekst kroków.
    - `tags` (string[]): Lista nazw tagów.
  - Opcjonalne:
    - `description` (string): Opis przepisu.
    - `category_id` (integer): ID kategorii.
- Request Body: `CreateRecipeCommand`

### `PUT /recipes/{id}`
- Metoda HTTP: `PUT`
- Struktura URL: `/recipes/{id}`
- Parametry:
  - Wymagane:
    - `id` (integer): Unikalny identyfikator przepisu (w URL).
  - Opcjonalne:
    - `name` (string): Nazwa przepisu (1-150 znaków).
    - `description` (string): Opis przepisu.
    - `category_id` (integer): ID kategorii.
    - `ingredients_raw` (string): Surowy tekst składników.
    - `steps_raw` (string): Surowy tekst kroków.
    - `tags` (string[]): Lista nazw tagów.
- Request Body: `UpdateRecipeCommand`

### `POST /recipes/import`
- Metoda HTTP: `POST`
- Struktura URL: `/recipes/import`
- Parametry:
  - Wymagane:
    - `raw_text` (string): Surowy tekst przepisu do zaimportowania (musi zawierać tytuł).
  - Opcjonalne: Brak
- Request Body: `ImportRecipeCommand`

## 3. Wykorzystywane typy
- `RecipeDetailDto`: Używany jako typ odpowiedzi dla utworzonego/zaktualizowanego przepisu.
- `CreateRecipeCommand`: Model danych wejściowych dla `POST /recipes`.
- `UpdateRecipeCommand`: Model danych wejściowych dla `PUT /recipes/{id}`.
- `ImportRecipeCommand`: Model danych wejściowych dla `POST /recipes/import`.
- `RecipeContentItem`, `RecipeContent`: Wewnętrzne typy dla struktury JSONB składników i kroków.
- `TagDto`: Używany w `RecipeDetailDto` dla reprezentacji tagów.

## 3. Szczegóły odpowiedzi

### `POST /recipes`, `PUT /recipes/{id}`, `POST /recipes/import`
- **Kod**: `201 Created` (dla POST), `200 OK` (dla PUT)
- **Payload**: Pełny obiekt przepisu w formacie `RecipeDetailDto`, zawierający sparsowane `ingredients` i `steps`, oraz zaktualizowane `tags` i inne pola. Przykład:
```json
{
  "id": 101,
  "name": "New Awesome Recipe",
  "description": "A short description.",
  "category_id": 2,
  "ingredients": [
    {"type": "header", "content": "Dough"},
    {"type": "item", "content": "500g flour"}
  ],
  "steps": [
    {"type": "header", "content": "Preparation"},
    {"type": "item", "content": "Mix flour and water."}
  ],
  "tags": [
    {"id": 5, "name": "vegan"}
  ],
  "created_at": "2023-10-27T12:00:00Z"
}
```

## 4. Przepływ danych
1.  **Request Reception**: Edge Function odbiera żądanie HTTP.
2.  **Autoryzacja**: Weryfikacja tokena JWT i autoryzacja użytkownika (globalny middleware).
3.  **Walidacja wejścia**: Handlery używają biblioteki Zod do walidacji danych wejściowych (body, parametry URL) zgodnie ze schematami DTO/Command.
4.  **Logika Biznesowa (Service Layer)**:
    - Handlery delegują do `recipes.service.ts` (np. `createRecipe`, `updateRecipe`, `importRecipe`).
    - `recipes.service.ts` jest odpowiedzialny za:
        - Wywołanie funkcji PostgreSQL `parse_text_to_jsonb` do konwersji `ingredients_raw` i `steps_raw` na `jsonb`. **Kluczowe**: Funkcja `parse_text_to_jsonb` musi zostać zaktualizowana w bazie danych, aby usuwać numerację (np. "1.", "1)") i punktory (np. "-", "*") z początku linii w parsowanych krokach (`steps`).
        - Obsługę tagów: Znalezienie istniejących tagów lub utworzenie nowych na podstawie listy nazw, a następnie powiązanie ich z przepisem poprzez tabelę `recipe_tags`.
        - Wykonanie operacji `INSERT`/`UPDATE` na tabeli `recipes`.
        - Integrację z `categories` (jeśli `category_id` jest podane).
        - W przypadku `POST /recipes/import`, cały `raw_text` jest przekazywany do funkcji parsowania, która zwróci wstępnie wypełniony obiekt przepisu.
        - Zapewnienie atomowości operacji (np. tworzenie przepisu i tagów) za pomocą transakcji bazodanowych.
5.  **RLS Enforcement**: Supabase Row Level Security automatycznie wymusi, aby użytkownik operował tylko na własnych zasobach.
6.  **Response Generation**: Service zwraca przetworzone dane do handlera, który formatuje je jako `RecipeDetailDto` i wysyła odpowiedź z odpowiednim kodem statusu.

## 5. Względy bezpieczeństwa
-   **Uwierzytelnianie**: Wszystkie endpointy wymagają ważnego tokena JWT, weryfikowanego przez Edge Function.
-   **Autoryzacja (RLS)**: PostgreSQL Row Level Security (RLS) jest włączone dla tabel `recipes`, `tags`, `recipe_tags` i `categories` (read-only). Zapewnia to, że użytkownicy mogą tworzyć, modyfikować i odczytywać tylko swoje własne przepisy i tagi, oraz odczytywać systemowe kategorie.
-   **Walidacja wejścia**: Kompleksowa walidacja danych wejściowych przy użyciu Zod zapobiegnie atakom wstrzykiwania (np. SQL Injection, choć `supabase-js` to minimalizuje) oraz zapewni integralność danych.
-   **Parsowanie tekstów**: Funkcja `parse_text_to_jsonb` musi być bezpieczna i odporna na złośliwe dane wejściowe. Należy upewnić się, że nie pozwala na wstrzykiwanie kodu ani inne podatności.
-   **Limity danych**: Należy rozważyć limity długości dla `raw_text`, `ingredients_raw` i `steps_raw`, aby zapobiec atakom DoS lub przeciążeniu parsera.

## 6. Obsługa błędów
-   **`400 Bad Request`**: Zwracany, gdy:
    - Dane wejściowe nie przejdą walidacji Zod (np. brakujące wymagane pola, nieprawidłowy format, zbyt krótka/długa nazwa).
    - `raw_text` dla `POST /recipes/import` jest puste lub nie zawiera wymaganego tytułu (`#`).
    - `category_id` odnosi się do nieistniejącej kategorii.
    - Inne błędy logiki biznesowej zgłoszone przez serwis (np. próba utworzenia tagu z nazwą, która już istnieje u danego użytkownika, choć to powinno być obsługiwane przez unikalny indeks).
-   **`401 Unauthorized`**: Zwracany, gdy token JWT jest brakujący, nieprawidłowy lub wygasł.
-   **`403 Forbidden`**: Może być zwrócony, jeśli użytkownik próbuje operować na przepisie, do którego nie ma dostępu (mimo RLS, warstwa aplikacji może to dodatkowo weryfikować lub obsługiwać specyficzne scenariusze).
-   **`404 Not Found`**: Zwracany dla `PUT /recipes/{id}` i `DELETE /recipes/{id}`, gdy przepis o podanym `id` nie istnieje lub został soft-usunięty.
-   **`500 Internal Server Error`**: Zwracany w przypadku nieoczekiwanych błędów po stronie serwera (np. błąd bazy danych, problem z funkcją parsowania JSONB, nieobsłużone wyjątki).
-   **Logowanie**: Błędy będą logowane w warstwie serwisowej zgodnie z `backend.mdc`.

## 7. Rozważania dotyczące wydajności
-   **Indeksy bazodanowe**: Istniejące indeksy na `user_id`, `name`, `created_at` oraz indeks GIN na `tsvector` dla `recipes` powinny zapewnić dobrą wydajność zapytań.
-   **Optymalizacja parsowania**: Funkcja PostgreSQL `parse_text_to_jsonb` powinna być zoptymalizowana pod kątem wydajności, szczególnie dla dużych bloków tekstu.
-   **Transakcje**: Użycie transakcji dla operacji łączących wiele tabel jest konieczne dla spójności danych, ale należy upewnić się, że są one efektywne i nie blokują zasobów na zbyt długo.
-   **Zapytania N+1**: Widok `recipe_details` jest już używany do unikania problemu N+1 dla odczytu, należy upewnić się, że operacje zapisu i aktualizacji również są zoptymalizowane.

## 8. Etapy wdrożenia
1.  **Aktualizacja funkcji PostgreSQL `parse_text_to_jsonb`**: Zmodyfikuj funkcję w bazie danych, aby prawidłowo usuwała numerację i punktory z początku linii w sekcji kroków (`steps_raw`) podczas konwersji na JSONB.
2.  **Modyfikacja `recipes.service.ts`**: Upewnij się, że serwis prawidłowo wywołuje zaktualizowaną funkcję parsowania i obsługuje logikę tworzenia/aktualizacji tagów (znajdowanie istniejących lub tworzenie nowych).
3.  **Modyfikacja `recipes.handlers.ts`**: Zaimplementuj lub zaktualizuj handlery dla `POST /recipes`, `PUT /recipes/{id}` i `POST /recipes/import`.
    - Dodaj walidację danych wejściowych przy użyciu Zod dla `CreateRecipeCommand`, `UpdateRecipeCommand` i `ImportRecipeCommand`.
    - Zapewnij prawidłowe mapowanie danych wejściowych do wywołań serwisu.
    - Obsługuj potencjalne błędy zwracane przez serwis i mapuj je na odpowiednie odpowiedzi HTTP.
