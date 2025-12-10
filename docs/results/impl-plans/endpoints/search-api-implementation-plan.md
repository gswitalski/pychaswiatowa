# API Endpoints Implementation Plan: Global Search

## 1. Przegląd punktu końcowego
Celem tego endpointu jest dostarczenie funkcjonalności globalnego wyszukiwania ("Omnibox") dostępnego z poziomu paska nawigacyjnego aplikacji. Endpoint agreguje wyniki wyszukiwania z dwóch głównych zasobów: przepisów (Recipes) oraz kolekcji (Collections), umożliwiając użytkownikowi szybką nawigację do interesujących go treści.

## 2. Szczegóły żądania
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/functions/v1/search/global` (zakładając strukturę Edge Functions Supabase)
- **Parametry**:
  - **Wymagane**: 
    - `q`: string (Ciąg wyszukiwania, minimum 2 znaki)
  - **Opcjonalne**: Brak
- **Request Body**: Brak

## 3. Wykorzystywane typy

### DTOs (Data Transfer Objects)

```typescript
// Zod Schema dla walidacji inputu
import { z } from 'zod';

export const SearchQuerySchema = z.object({
  q: z.string().min(2, "Search query must be at least 2 characters long"),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// DTO dla pojedynczego wyniku przepisu
export interface SearchRecipeDto {
  id: number;
  name: string;
  category: string | null; // Nazwa kategorii
}

// DTO dla pojedynczego wyniku kolekcji
export interface SearchCollectionDto {
  id: number;
  name: string;
}

// Główny DTO odpowiedzi
export interface GlobalSearchResponseDto {
  recipes: SearchRecipeDto[];
  collections: SearchCollectionDto[];
}
```

## 3. Szczegóły odpowiedzi

**Status 200 OK**
Zwraca obiekt JSON zawierający tablice znalezionych przepisów i kolekcji.

```json
{
  "recipes": [
    { "id": 1, "name": "Szarlotka", "category": "Deser" },
    { "id": 15, "name": "Spaghetti Carbonara", "category": "Obiad" }
  ],
  "collections": [
    { "id": 3, "name": "Szybkie obiady" }
  ]
}
```

**Status 400 Bad Request**
Gdy parametr `q` jest krótszy niż 2 znaki lub go brakuje.

**Status 401 Unauthorized**
Gdy użytkownik nie jest zalogowany (brak poprawnego tokenu JWT).

## 4. Przepływ danych

1.  **Klient (Frontend)**: Wysyła żądanie `GET /search/global?q=query` z tokenem Bearer.
2.  **Supabase Edge Function (`search`)**:
    *   Odbiera żądanie.
    *   Weryfikuje token użytkownika (Auth Context).
    *   Waliduje parametr `q` za pomocą Zod.
3.  **Service Layer (`SearchService`)**:
    *   Uruchamia równolegle (`Promise.all`) dwa zapytania do bazy danych PostgreSQL (poprzez klienta Supabase):
        *   **Recipes Query**: Przeszukuje tabelę `recipes` (lub widok `recipe_details`). Wykorzystuje Full Text Search (kolumny zindeksowane `tsvector`) lub `ilike` na kolumnie `name`. Filtruje `deleted_at IS NULL`. Pobiera relację `categories(name)`.
        *   **Collections Query**: Przeszukuje tabelę `collections`. Wykorzystuje `ilike` na kolumnie `name`.
4.  **Baza Danych (PostgreSQL)**: Zwraca przefiltrowane wyniki, uwzględniając polityki RLS (Row Level Security), co gwarantuje, że użytkownik widzi tylko swoje zasoby.
5.  **Edge Function**: Mapuje wyniki z bazy danych na strukturę `GlobalSearchResponseDto`.
6.  **Klient**: Otrzymuje zagregowane wyniki JSON.

## 5. Względy bezpieczeństwa

-   **Uwierzytelnianie**: Endpoint wymaga ważnego tokenu JWT w nagłówku `Authorization`. Brak tokenu skutkuje błędem 401.
-   **Autoryzacja (RLS)**: Bezpieczeństwo danych jest gwarantowane na poziomie bazy danych. Edge Function działa w kontekście zalogowanego użytkownika, więc RLS automatycznie odfiltruje rekordy nie należące do użytkownika.
-   **Walidacja**: Parametr wejściowy `q` jest walidowany (min. długość, typ) przed wykonaniem zapytania do bazy, co zapobiega niepotrzebnemu obciążeniu DB niepoprawnymi zapytaniami.
-   **Sanityzacja**: Klient Supabase automatycznie parametryzuje zapytania, chroniąc przed SQL Injection.

## 6. Obsługa błędów

| Scenariusz błędu | Kod HTTP | Komunikat / Akcja |
|:---|:---|:---|
| Brak tokenu Auth | 401 | Zwracany przez warstwę Auth Supabase |
| Parametr `q` < 2 znaki | 400 | `{ "error": "Search query must be at least 2 characters long" }` |
| Błąd połączenia z DB | 500 | Logowanie błędu po stronie serwera, zwrot ogólnego komunikatu błędu |
| Nieoczekiwany wyjątek | 500 | Logowanie stack trace, zwrot ogólnego komunikatu błędu |

## 7. Rozważania dotyczące wydajności

-   **Indeksy**: Tabela `recipes` posiada indeks GIN na wektorze `tsvector` (name + ingredients), co zapewnia szybkie wyszukiwanie pełnotekstowe. Tabela `collections` powinna mieć indeks na kolumnie `name` (lub wykorzystać indeks unikalny `user_id, name` jeśli wyszukiwanie jest prefixowe).
-   **Równoległość**: Zapytania o przepisy i kolekcje są niezależne, więc powinny być wykonywane równolegle (`Promise.all`), aby zminimalizować czas odpowiedzi.
-   **Selekcja pól**: Pobieramy tylko niezbędne pola (`id`, `name`, `category.name`), minimalizując ilość przesyłanych danych (payload size).
-   **Debouncing**: Po stronie frontendu należy zastosować debouncing, aby nie wysyłać zapytania przy każdym naciśnięciu klawisza (to uwaga dla implementacji klienta, ale wpływa na obciążenie endpointu).

## 8. Etapy wdrożenia

### Krok 1: Przygotowanie środowiska Edge Function
1.  Utwórz katalog `supabase/functions/search`.
2.  Utwórz pliki: `index.ts`, `search.handlers.ts`, `search.service.ts`, `search.types.ts`.
3.  Skonfiguruj importy współdzielone (logger, obsługa błędów, klient supabase) z `_shared`.

### Krok 2: Definicja typów i walidacji (`search.types.ts`)
1.  Zdefiniuj `SearchQuerySchema` używając Zod.
2.  Zdefiniuj interfejsy DTO dla odpowiedzi (`GlobalSearchResponseDto` itp.).

### Krok 3: Implementacja serwisu (`search.service.ts`)
1.  Zaimplementuj funkcję `searchRecipes(client, userId, query)`.
    *   Użyj `client.from('recipes').select('id, name, category:categories(name)')`.
    *   Zastosuj filtr `.textSearch(...)` lub `.ilike(...)`.
    *   Pamiętaj o `.eq('deleted_at', null)`.
2.  Zaimplementuj funkcję `searchCollections(client, userId, query)`.
    *   Użyj `client.from('collections').select('id, name')`.
    *   Zastosuj filtr `.ilike('name', \`%${query}%\`)`.

### Krok 4: Implementacja handlera (`search.handlers.ts`)
1.  Utwórz funkcję `handleGlobalSearch`.
2.  Pobierz i zweryfikuj użytkownika (`auth.getUser()`).
3.  Sparsruj URL i zwaliduj parametr `q`.
4.  Wywołaj metody serwisu w `Promise.all`.
5.  Zmapuj wyniki z bazy na DTO odpowiedzi.
6.  Zwróć odpowiedź JSON.

### Krok 5: Konfiguracja routera (`index.ts`)
1.  Skonfiguruj obsługę ścieżki `/global` i metody `GET`.
2.  Podepnij `handleGlobalSearch`.
3.  Dodaj globalną obsługę błędów (try-catch).

