# Implementacja Endpointa Globalnego Wyszukiwania

## Przegląd

Ten dokument opisuje implementację endpointa `GET /search/global`, który umożliwia wyszukiwanie przepisów i kolekcji użytkownika w jednym zapytaniu. Endpoint został zaprojektowany zgodnie z PRD (US-009) i API Plan.

## Endpoint Backend

### Struktura plików

```
supabase/functions/search/
├── index.ts                # Router główny z obsługą CORS
├── search.handlers.ts      # Handlery HTTP z walidacją
├── search.service.ts       # Logika biznesowa wyszukiwania
└── search.types.ts         # DTO i schematy walidacji Zod
```

### Endpoint URL

```
GET /functions/v1/search/global?q={query}
```

### Query Parameters

| Parametr | Typ    | Wymagany | Ograniczenia | Opis                    |
|----------|--------|----------|--------------|-------------------------|
| `q`      | string | Tak      | min 2 znaki  | Fraza wyszukiwania      |

### Response Format

```json
{
    "recipes": [
        {
            "id": 1,
            "name": "Sernik klasyczny",
            "category": "Deser"
        }
    ],
    "collections": [
        {
            "id": 3,
            "name": "Desery świąteczne"
        }
    ]
}
```

### Kody Statusu

- `200 OK` - Wyszukiwanie zakończone sukcesem
- `400 Bad Request` - Brak parametru `q` lub zbyt krótkie zapytanie (< 2 znaki)
- `401 Unauthorized` - Brak lub nieprawidłowy token JWT
- `500 Internal Server Error` - Błąd bazy danych lub serwera

### Szczegóły Implementacji Backend

#### index.ts
- Obsługuje CORS (preflight OPTIONS)
- Routing do `searchRouter`
- Globalna obsługa błędów

#### search.handlers.ts
- `handleGlobalSearch` - główny handler dla GET /search/global
- Walidacja query parameter `q` za pomocą Zod schema
- Autentykacja użytkownika przez `getAuthenticatedContext`
- Równoległe wykonanie wyszukiwania (Promise.all)
- Formatowanie odpowiedzi zgodnie z DTO

#### search.service.ts

**searchRecipes(client, userId, query)**
- Wyszukuje przepisy po nazwie (case-insensitive)
- Filtruje tylko nieusunięte przepisy (`deleted_at IS NULL`)
- Limit: 10 wyników
- Zwraca: `SearchRecipeDto[]`

**searchCollections(client, userId, query)**
- Wyszukuje kolekcje po nazwie (case-insensitive)
- Limit: 10 wyników
- Zwraca: `SearchCollectionDto[]`

#### search.types.ts
- `SearchQuerySchema` - walidacja Zod dla parametru `q`
- `SearchRecipeDto` - DTO dla wyniku wyszukiwania przepisu
- `SearchCollectionDto` - DTO dla wyniku wyszukiwania kolekcji
- `GlobalSearchResponseDto` - główny DTO odpowiedzi

### Bezpieczeństwo

- **Autentykacja**: Wymagany JWT token w headerze `Authorization: Bearer <token>`
- **RLS (Row Level Security)**: Zapytania do bazy automatycznie filtrują dane tylko do zasobów użytkownika
- **Walidacja**: Wszystkie parametry wejściowe są walidowane przez schematy Zod
- **Izolacja danych**: Każdy użytkownik widzi tylko swoje przepisy i kolekcje

## Modyfikacje Frontend

### SearchService (`src/app/core/services/search.service.ts`)

#### Przed zmianami
- Bezpośrednie zapytania do Supabase Client
- Ręczne JOIN-y i transformacje danych
- Logika wyszukiwania w frontendzie

#### Po zmianach
- Wywołanie REST API endpoint przez `supabase.functions.invoke()`
- Uproszczona logika - backend zajmuje się wyszukiwaniem
- Lepsza separacja odpowiedzialności (SoC)

#### Kod implementacji

```typescript
searchGlobal(query: string): Observable<GlobalSearchResponseDto> {
    const encodedQuery = encodeURIComponent(query.trim());
    
    return from(
        this.supabase.functions.invoke<GlobalSearchResponseDto>(
            `search/global?q=${encodedQuery}`,
            {
                method: 'GET',
            }
        )
    ).pipe(
        map((response) => {
            if (response.error) {
                throw new Error(response.error.message || 'Błąd wyszukiwania');
            }
            return response.data ?? { recipes: [], collections: [] };
        }),
        catchError(() => {
            // Return empty results on error for better UX
            return from([{ recipes: [], collections: [] }]);
        })
    );
}
```

#### Kluczowe zmiany

1. **Usunięto bezpośrednie zapytania do bazy**
   - `this.supabase.from('recipes')` → usunięte
   - `this.supabase.from('collections')` → usunięte

2. **Dodano wywołanie Edge Function**
   - `this.supabase.functions.invoke('search/global?q=...')`
   - Query parameter `q` jest enkodowany (URL-safe)

3. **Uproszczona obsługa błędów**
   - Backend zwraca ustandaryzowane błędy
   - Frontend zwraca puste wyniki w przypadku błędu (lepsze UX)

4. **Zmniejszona liczba linii kodu**
   - Z ~119 linii do ~46 linii (-61% kodu)
   - Brak duplikacji logiki wyszukiwania

### OmniboxComponent

**Brak zmian** - Komponent nadal używa `SearchService.searchGlobal()`, który teraz wewnętrznie korzysta z REST API.

## Korzyści z Refaktoryzacji

### 1. Architektura
- ✅ Zgodność z wzorcem Backend-as-a-Service
- ✅ Separacja odpowiedzialności (frontend vs backend)
- ✅ Łatwiejsze testowanie - można mockować endpoint

### 2. Bezpieczeństwo
- ✅ Centralna walidacja w backendzie
- ✅ Logowanie operacji wyszukiwania
- ✅ Jednolita obsługa autoryzacji

### 3. Wydajność
- ✅ Równoległe wyszukiwanie (Promise.all) w backendzie
- ✅ Optymalne zapytania SQL (SELECT tylko potrzebnych kolumn)
- ✅ Limit wyników zapobiega przeciążeniu

### 4. Utrzymanie
- ✅ Jedna implementacja logiki wyszukiwania (DRY principle)
- ✅ Łatwiejsze dodawanie nowych źródeł wyszukiwania (np. tagi, składniki)
- ✅ Wspólne typy między frontendem i backendem (`shared/contracts/types.ts`)

## Testowanie

### Backend (Supabase Functions)

#### Uruchomienie lokalnie
```bash
supabase functions serve search
```

#### Test endpoint
```bash
# GET request z query parameter
curl -X GET "http://localhost:54321/functions/v1/search/global?q=sernik" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

#### Oczekiwany response
```json
{
    "recipes": [
        {
            "id": 1,
            "name": "Sernik klasyczny",
            "category": "Deser"
        }
    ],
    "collections": []
}
```

### Frontend (Angular)

1. Uruchom aplikację: `npm start`
2. Zaloguj się jako użytkownik
3. Użyj Omnibox w górnym pasku nawigacji
4. Wpisz minimum 2 znaki
5. Sprawdź czy wyniki pojawiają się w dropdown

### Test Cases

| Test Case | Kroki | Oczekiwany rezultat |
|-----------|-------|---------------------|
| TC-001: Wyszukiwanie przepisu | Wpisz "pizza" | Lista przepisów z nazwą zawierającą "pizza" |
| TC-002: Wyszukiwanie kolekcji | Wpisz "święta" | Lista kolekcji z nazwą zawierającą "święta" |
| TC-003: Brak wyników | Wpisz "xyzabc123" | Pusta lista (brak błędu) |
| TC-004: Zbyt krótkie zapytanie | Wpisz "a" | Brak wywołania API (walidacja frontend) |
| TC-005: Debounce | Wpisz szybko "pizza" | Tylko jedno wywołanie API (po 300ms) |

## Zgodność z Dokumentacją Projektu

### PRD (004 prd.md)
- ✅ **US-009**: Wyszukiwanie przepisów - zaimplementowane
- ✅ **US-014**: Globalna nawigacja (Omnibox) - funkcjonalne

### API Plan (009 API plan.md)
- ✅ Endpoint `GET /search/global?q={query}` zgodny z dokumentacją
- ✅ Response format zgodny z specyfikacją
- ✅ Kody statusu HTTP zgodne z planem

### Tech Stack (006 Tech Stack.md)
- ✅ Supabase Edge Functions (Deno)
- ✅ TypeScript w backendzie i frontendzie
- ✅ Angular z RxJS po stronie klienta

### Backend Rules (.cursor/rules/backend.mdc)
- ✅ Modularna struktura Edge Function (index/handlers/service/types)
- ✅ Walidacja Zod
- ✅ Logowanie operacji (logger)
- ✅ Obsługa błędów przez ApplicationError
- ✅ CORS headers
- ✅ Typy współdzielone

### Frontend Rules (.cursor/rules/fronend.mdc)
- ✅ Standalone service (Injectable)
- ✅ Signals dla stanu (używane w OmniboxComponent)
- ✅ RxJS observables
- ✅ Proper error handling

## Możliwe Rozszerzenia

### Przyszłe usprawnienia (poza scope MVP)

1. **Full-text search**
   - Wyszukiwanie w składnikach przepisów
   - Wyszukiwanie w tagach

2. **Zaawansowane filtrowanie**
   - Typ zasobu (tylko przepisy / tylko kolekcje)
   - Kategoria przepisów

3. **Sugestie wyszukiwania**
   - Autocomplete based on search history
   - Najpopularniejsze wyszukiwania

4. **Ranking wyników**
   - Sortowanie po relevance score
   - Priorytet dla ostatnio dodanych

5. **Highlighting**
   - Podświetlanie szukanej frazy w wynikach

## Podsumowanie

Implementacja endpointa `/search/global` została zakończona zgodnie z wymaganiami projektu. Frontend został zrefaktoryzowany, aby korzystać z REST API zamiast bezpośrednich zapytań do bazy danych, co poprawia architekturę aplikacji, bezpieczeństwo i utrzymanie kodu.

### Status
✅ **Ukończone** - Endpoint działa poprawnie w backendzie i frontendzie

### Pliki zmodyfikowane
1. ✅ `supabase/functions/search/*` - Endpoint już istniał
2. ✅ `src/app/core/services/search.service.ts` - Zrefaktoryzowany do używania API
3. ✅ `src/app/shared/components/omnibox/` - Bez zmian (używa SearchService)

