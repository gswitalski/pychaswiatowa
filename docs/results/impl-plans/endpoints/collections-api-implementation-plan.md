# API Endpoints Implementation Plan: Collections

## 1. Przegląd punktu końcowego

Endpoint `/collections` zapewnia pełną obsługę operacji CRUD (Create, Read, Update, Delete) dla zasobu "kolekcji", które są zdefiniowanymi przez użytkownika zbiorami przepisów. Umożliwia również zarządzanie przynależnością przepisów do tych kolekcji. Wszystkie operacje są zabezpieczone i dostępne tylko dla uwierzytelnionych użytkowników w kontekście ich własnych danych.

## 2. Architektura i Struktura Plików

Zgodnie z wytycznymi, implementacja zostanie umieszczona w nowej funkcji Supabase o nazwie `collections`.

```
supabase/functions/collections/
  ├── index.ts                 # Główny router, obsługa żądań i delegowanie do handlerów
  ├── collections.handlers.ts  # Handlery dla poszczególnych metod HTTP, walidacja
  ├── collections.service.ts   # Czysta logika biznesowa i interakcje z bazą danych
  └── collections.types.ts     # Definicje typów DTO i Command Models specyficznych dla kolekcji
```

## 3. Wykorzystywane typy

W pliku `collections.types.ts` zostaną zdefiniowane następujące interfejsy i typy, aby zapewnić bezpieczeństwo typów w całej funkcji.

```typescript
// collections.types.ts

// Data Transfer Objects (DTOs) for responses
export interface CollectionDto {
  id: number;
  name: string;
  description: string | null;
}

export interface RecipeInCollectionDto {
  id: number;
  name: string;
}

export interface PaginationDetails {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export interface PaginatedRecipesDto {
  data: RecipeInCollectionDto[];
  pagination: PaginationDetails;
}

export interface CollectionWithRecipesDto extends CollectionDto {
  recipes: PaginatedRecipesDto;
}

// Command Models for requests
export interface CreateCollectionCommand {
  name: string;
  description?: string;
}

export interface UpdateCollectionCommand {
  name?: string;
  description?: string;
}

export interface AddRecipeToCollectionCommand {
  recipe_id: number;
}
```

## 4. Szczegóły Endpointów

### 4.1. Pobieranie listy kolekcji

-   **Opis**: Pobiera listę wszystkich kolekcji należących do uwierzytelnionego użytkownika.
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/collections`
-   **Parametry**: Brak
-   **Odpowiedź sukcesu (200 OK)**:
    ```json
    [
      {
        "id": 1,
        "name": "Christmas Dishes",
        "description": "Recipes for the holidays."
      }
    ]
    ```
-   **Odpowiedź błędu**: `401 Unauthorized`

### 4.2. Tworzenie nowej kolekcji

-   **Opis**: Tworzy nową kolekcję dla uwierzytelnionego użytkownika.
-   **Metoda HTTP**: `POST`
-   **Struktura URL**: `/collections`
-   **Request Body**: `CreateCollectionCommand`
    ```json
    {
      "name": "Summer BBQ Ideas",
      "description": "Great for a sunny day."
    }
    ```
-   **Odpowiedź sukcesu (201 Created)**: `CollectionDto` (nowo utworzona kolekcja)
-   **Odpowiedzi błędów**: `400 Bad Request`, `401 Unauthorized`, `409 Conflict`

### 4.3. Pobieranie szczegółów kolekcji

-   **Opis**: Pobiera szczegóły pojedynczej kolekcji wraz z paginowaną listą jej przepisów.
-   **Metoda HTTP**: `GET`
-   **Struktura URL**: `/collections/{id}`
-   **Parametry**:
    -   **Ścieżki (wymagane)**: `id` (number)
    -   **Query (opcjonalne)**: `page` (number, default: 1), `limit` (number, default: 20)
-   **Odpowiedź sukcesu (200 OK)**: `CollectionWithRecipesDto`
-   **Odpowiedzi błędów**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

### 4.4. Aktualizacja kolekcji

-   **Opis**: Aktualizuje nazwę i/lub opis istniejącej kolekcji.
-   **Metoda HTTP**: `PUT`
-   **Struktura URL**: `/collections/{id}`
-   **Parametry**:
    -   **Ścieżki (wymagane)**: `id` (number)
-   **Request Body**: `UpdateCollectionCommand`
-   **Odpowiedź sukcesu (200 OK)**: `CollectionDto` (zaktualizowana kolekcja)
-   **Odpowiedzi błędów**: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`

### 4.5. Usuwanie kolekcji

-   **Opis**: Trwale usuwa kolekcję. Operacja nie usuwa przepisów należących do kolekcji.
-   **Metoda HTTP**: `DELETE`
-   **Struktura URL**: `/collections/{id}`
-   **Parametry**:
    -   **Ścieżki (wymagane)**: `id` (number)
-   **Odpowiedź sukcesu (204 No Content)**: Brak zawartości.
-   **Odpowiedzi błędów**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

### 4.6. Dodawanie przepisu do kolekcji

-   **Opis**: Dodaje istniejący przepis do istniejącej kolekcji.
-   **Metoda HTTP**: `POST`
-   **Struktura URL**: `/collections/{id}/recipes`
-   **Parametry**:
    -   **Ścieżki (wymagane)**: `id` (number) - ID kolekcji
-   **Request Body**: `AddRecipeToCollectionCommand`
-   **Odpowiedź sukcesu (201 Created)**:
    ```json
    { "message": "Recipe added to collection successfully." }
    ```
-   **Odpowiedzi błędów**: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`

### 4.7. Usuwanie przepisu z kolekcji

-   **Opis**: Usuwa powiązanie przepisu z kolekcją.
-   **Metoda HTTP**: `DELETE`
-   **Struktura URL**: `/collections/{collectionId}/recipes/{recipeId}`
-   **Parametry**:
    -   **Ścieżki (wymagane)**: `collectionId` (number), `recipeId` (number)
-   **Odpowiedź sukcesu (204 No Content)**: Brak zawartości.
-   **Odpowiedzi błędów**: `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

## 5. Przepływ Danych

1.  Żądanie HTTP trafia do `index.ts` w funkcji `collections`.
2.  Główny router w `index.ts` weryfikuje token JWT i przekazuje żądanie do odpowiedniego handlera w `collections.handlers.ts` na podstawie metody HTTP i ścieżki URL.
3.  **Handler** (`collections.handlers.ts`):
    -   Waliduje parametry ścieżki, zapytania oraz ciało żądania przy użyciu schematów Zod.
    -   W przypadku błędu walidacji, zwraca odpowiedź `400 Bad Request`.
    -   Wywołuje odpowiednią metodę z serwisu `collections.service.ts`, przekazując zweryfikowane dane oraz ID uwierzytelnionego użytkownika.
    -   Otrzymuje dane lub błąd z warstwy serwisu.
    -   Formatuje pomyślną odpowiedź (np. `200 OK`, `201 Created`) lub mapuje błąd na odpowiedni kod statusu HTTP (np. `404 Not Found`, `409 Conflict`).
4.  **Serwis** (`collections.service.ts`):
    -   Zawiera całą logikę biznesową.
    -   Komunikuje się z bazą danych Supabase za pomocą klienta `supabase-js`.
    -   Każde zapytanie do bazy danych zawiera warunek `WHERE user_id = :userId`, aby zapewnić izolację danych użytkownika.
    -   Implementuje logikę sprawdzającą (np. unikalność nazwy kolekcji, istnienie przepisu przed dodaniem).
    -   W przypadku naruszenia reguł biznesowych, rzuca dedykowane błędy (np. `ApplicationError` z kodem `NOT_FOUND` lub `CONFLICT`), które są następnie przechwytywane przez handler.

## 6. Względy bezpieczeństwa

-   **Uwierzytelnianie**: Każde żądanie do endpointu będzie weryfikowane pod kątem obecności i poprawności tokenu JWT w nagłówku `Authorization`.
-   **Autoryzacja**: Polityki Row Level Security (RLS) w bazie danych będą stanowiły podstawową warstwę ochrony. Dodatkowo, każda metoda w `collections.service.ts` będzie jawnie filtrować dane po `user_id` pobranym z tokenu, co stanowi drugą, aktywną warstwę zabezpieczeń przed nieautoryzowanym dostępem do danych (IDOR).
-   **Walidacja danych wejściowych**: Użycie biblioteki Zod w handlerach do ścisłej walidacji wszystkich danych przychodzących od klienta (ciało, parametry query, parametry ścieżki) ochroni przed błędami i potencjalnymi atakami (np. XSS, NoSQL Injection, mimo że używamy SQL).

## 7. Obsługa błędów

| Kod Statusu         | Opis                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `400 Bad Request`   | Błąd walidacji danych wejściowych (np. brak wymaganego pola, nieprawidłowy format danych). Odpowiedź będzie zawierać szczegóły błędu. |
| `401 Unauthorized`  | Brak, nieprawidłowy lub wygasły token JWT.                                                                                        |
| `403 Forbidden`     | Użytkownik próbuje uzyskać dostęp lub zmodyfikować zasób, który do niego nie należy.                                              |
| `404 Not Found`     | Próba operacji na kolekcji lub przepisie o podanym ID, który nie istnieje lub nie należy do użytkownika.                           |
| `409 Conflict`      | - Próba utworzenia kolekcji o nazwie, która już istnieje.<br>- Próba dodania przepisu, który już znajduje się w kolekcji.           |
| `500 Internal Server Error` | Nieoczekiwany błąd serwera. Szczegóły błędu zostaną zalogowane.                                                            |

## 8. Rozważania dotyczące wydajności

-   **Paginacja**: Paginacja przepisów w `GET /collections/{id}` jest kluczowa dla wydajności, aby uniknąć ładowania potencjalnie setek przepisów naraz.
-   **Indeksy**: Baza danych posiada odpowiednie indeksy na kluczach obcych (`user_id`, `collection_id`) oraz na polach używanych do wyszukiwania i sortowania (`name`), co zapewni szybkość zapytań.
-   **Selektywne zapytania**: Zapytania do bazy danych będą pobierać tylko niezbędne kolumny (`SELECT id, name, ...`), aby zminimalizować transfer danych.

## 9. Etapy wdrożenia

1.  **Stworzenie struktury plików**: Utworzenie katalogu `supabase/functions/collections` i plików `index.ts`, `collections.handlers.ts`, `collections.service.ts`, `collections.types.ts`.
2.  **Definicja typów**: Zaimplementowanie wszystkich interfejsów DTO i Command Models w `collections.types.ts`.
3.  **Implementacja serwisu (`collections.service.ts`)**:
    -   Stworzenie funkcji dla każdej operacji biznesowej (get, create, update, delete etc.).
    -   Zaimplementowanie zapytań do bazy danych Supabase dla każdej funkcji.
    -   Dodanie logiki walidacji biznesowej (np. sprawdzanie własności, unikalności).
4.  **Implementacja handlerów (`collections.handlers.ts`)**:
    -   Stworzenie schematów walidacji Zod dla wszystkich przychodzących danych.
    -   Zaimplementowanie funkcji handlerów dla każdej ścieżki i metody HTTP.
    -   Dodanie logiki wywołującej odpowiednie metody serwisu i mapującej wyniki/błędy na odpowiedzi HTTP.
5.  **Implementacja routera (`index.ts`)**:
    -   Skonfigurowanie głównego serwera i routera.
    -   Dodanie middleware do weryfikacji JWT.
    -   Zmapowanie ścieżek do odpowiednich handlerów.
    -   Dodanie globalnej obsługi błędów (try-catch) w celu zwracania odpowiedzi `500`.
6.  **Testowanie**:
    -   Uruchomienie funkcji lokalnie za pomocą `supabase functions serve collections`.
    -   Przetestowanie każdego endpointu za pomocą narzędzia do testowania API (np. Postman, Insomnia) z uwzględnieniem przypadków sukcesu i błędów.
7.  **Wdrożenie**: Wdrożenie funkcji na platformę Supabase za pomocą `supabase functions deploy collections`.
