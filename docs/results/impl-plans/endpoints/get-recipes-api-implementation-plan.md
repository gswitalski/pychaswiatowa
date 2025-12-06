# API Endpoint Implementation Plan: GET /recipes

## 1. Przegląd punktu końcowego
Ten punkt końcowy umożliwia pobranie listy przepisów należących do uwierzytelnionego użytkownika. Obsługuje paginację, sortowanie, filtrowanie według kategorii i tagów oraz wyszukiwanie pełnotekstowe, zwracając dane w ustrukturyzowanym, paginowanym formacie.

## 2. Szczegóły żądania
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/functions/v1/recipes`
- **Parametry zapytania (Query Parameters)**:
    - **Opcjonalne**:
        - `page` (integer, domyślnie: 1): Numer strony do wyświetlenia.
        - `limit` (integer, domyślnie: 20): Liczba wyników na stronie (maksymalnie 100).
        - `sort` (string, np. `name.asc`, `created_at.desc`): Klucz i kierunek sortowania. Domyślnie `created_at.desc`.
        - `filter[category_id]` (integer): ID kategorii do filtrowania przepisów.
        - `filter[tags]` (string): Lista nazw tagów oddzielonych przecinkami.
        - `search` (string): Frazą do wyszukiwania pełnotekstowego w nazwie, składnikach i tagach.
- **Request Body**: Brak.

## 3. Wykorzystywane typy
- `PaginatedResponseDto<RecipeListItemDto>`: Główny typ odpowiedzi dla pomyślnego żądania.
- `RecipeListItemDto`: Typ dla pojedynczego obiektu przepisu na liście.
- `PaginationDetails`: Typ dla obiektu zawierającego szczegóły paginacji.
- `ApiError`: Typ dla odpowiedzi w przypadku błędu.

## 4. Szczegóły odpowiedzi
- **Odpowiedź sukcesu (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": 1,
        "name": "Apple Pie",
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
- **Odpowiedzi błędów**:
    - `400 Bad Request`: `{ "message": "Invalid input: [szczegóły błędu walidacji]" }`
    - `401 Unauthorized`: `{ "message": "Authentication required" }`
    - `500 Internal Server Error`: `{ "message": "An unexpected error occurred" }`

## 5. Przepływ danych
1.  Żądanie `GET` trafia do `supabase/functions/recipes/index.ts`.
2.  Stosowane są nagłówki CORS, a następnie weryfikowany jest token JWT z nagłówka `Authorization`.
3.  Jeśli token jest prawidłowy, żądanie jest kierowane do handlera `handleGetRecipes` w `recipes.handlers.ts`.
4.  Handler waliduje parametry zapytania przy użyciu predefiniowanego schematu Zod.
5.  Po pomyślnej walidacji, handler wywołuje funkcję `getRecipes` z `recipes.service.ts`, przekazując jej przetworzone parametry.
6.  Serwis buduje dynamiczne zapytanie do Supabase, korzystając z widoku `recipe_details`, aby zoptymalizować pobieranie danych.
7.  Zapytanie uwzględnia filtrowanie (`deleted_at IS NULL`, `category_id`, `tags`), wyszukiwanie pełnotekstowe, sortowanie i paginację (`range`).
8.  Wykonywane są dwa zapytania: jedno pobierające dane dla bieżącej strony, a drugie zliczające wszystkie pasujące rekordy (`{ count: 'exact' }`) w celu obliczenia paginacji.
9.  Serwis zwraca pobrane dane i całkowitą liczbę wyników do handlera.
10. Handler formatuje dane do struktury `PaginatedResponseDto`, oblicza `totalPages` i zwraca odpowiedź z kodem statusu `200 OK`.

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: Dostęp jest bezwzględnie wymagany. Każde żądanie musi być podpisane ważnym tokenem JWT.
- **Autoryzacja**: Dostęp do danych jest ograniczony na poziomie bazy danych przez polityki RLS (Row Level Security). Użytkownicy mogą odczytywać wyłącznie własne, nieusunięte przepisy.
- **Walidacja danych**: Wszystkie parametry wejściowe są rygorystycznie walidowane, aby zapobiec nieprawidłowym operacjom i potencjalnym atakom. Maksymalna wartość `limit` zostanie ograniczona po stronie serwera do 100.

## 7. Rozważania dotyczące wydajności
- **Wykorzystanie widoku**: Zapytania będą kierowane do zdenormalizowanego widoku `recipe_details`, co eliminuje potrzebę wykonywania złożonych złączeń (JOIN) w czasie rzeczywistym.
- **Indeksowanie**: Zapytanie będzie wykorzystywać istniejące indeksy B-drzewa na kolumnach `user_id`, `name`, `created_at` oraz indeks GIN dla wyszukiwania pełnotekstowego.
- **Paginacja**: Obowiązkowa paginacja zapobiega pobieraniu nadmiernej ilości danych w jednym żądaniu.

## 8. Etapy wdrożenia
1.  **Struktura plików**: Utworzenie plików `index.ts`, `recipes.handlers.ts` i `recipes.service.ts` w katalogu `supabase/functions/recipes/`.
2.  **`recipes.handlers.ts`**:
    -   Zdefiniować schemat walidacji Zod dla parametrów zapytania (`page`, `limit`, `sort`, `filter`, `search`).
    -   Zaimplementować handler `handleGetRecipes`, który parsuje i waliduje parametry, a następnie wywołuje serwis.
    -   Sformatować pomyślną odpowiedź lub rzucić `ApplicationError` w przypadku błędu walidacji.
3.  **`recipes.service.ts`**:
    -   Zaimplementować funkcję `getRecipes` przyjmującą obiekt z opcjami zapytania.
    -   Zbudować dynamiczne zapytanie Supabase, zaczynając od `supabase.from('recipe_details').select(...)`.
    -   Dodać obowiązkowy filtr `.is('deleted_at', null)`.
    -   Dynamicznie dołączać filtry: `.eq('category_id', ...)` dla kategorii, `.contains('tags', ['tag1', 'tag2'])` dla tagów oraz `.textSearch()` dla wyszukiwania.
    -   Dodać sortowanie `.order()` i paginację `.range()`.
    -   Wykonać zapytanie z opcją `{ count: 'exact' }`.
    -   Przetworzyć wyniki i zwrócić dane oraz całkowitą liczbę pasujących elementów.
4.  **`index.ts`**:
    -   Skonfigurować główny router dla funkcji.
    -   Dodać obsługę CORS i middleware do weryfikacji JWT.
    -   Skierować żądania `GET` na ścieżce `/` do `handleGetRecipes`.
    -   Zaimplementować globalny mechanizm przechwytywania błędów, który loguje błędy i zwraca ustandaryzowaną odpowiedź JSON.
