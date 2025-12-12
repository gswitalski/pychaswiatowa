# Implementacje Endpointów REST API

Ten katalog zawiera dokumentację implementacji endpointów REST API dla aplikacji PychaŚwiatowa.

## Lista Zaimplementowanych Endpointów

### 1. Search - Globalne Wyszukiwanie ✅

**Endpoint:** `GET /functions/v1/search/global?q={query}`

**Status:** Ukończone (Backend + Frontend)

**Pliki:**
- Backend: `supabase/functions/search/*`
- Frontend: `src/app/core/services/search.service.ts`
- Komponent: `src/app/shared/components/omnibox/`

**Dokumentacja:**
- [Szczegóły Implementacji](./search-global-implementation-summary.md)
- [Przewodnik Testowania](./search-testing-guide.md)

**Funkcjonalność:**
- Wyszukiwanie przepisów po nazwie
- Wyszukiwanie kolekcji po nazwie
- Case-insensitive matching
- Limit 10 wyników per typ
- Debounce 300ms w komponencie
- Minimalna długość zapytania: 2 znaki

**Użycie w aplikacji:**
- Komponent Omnibox w górnym pasku nawigacji
- Globalny dostęp z każdego ekranu aplikacji

---

### 2. Recipes Import ✅

**Endpoint:** `POST /functions/v1/recipes/import`

**Status:** Ukończone

**Dokumentacja:**
- [Szczegóły Implementacji](./recipes-import-implementation-summary.md)

**Funkcjonalność:**
- Import przepisu z tekstu Markdown
- Parsowanie struktury (nazwa, składniki, kroki)
- Automatyczne tworzenie przepisu w bazie

---

## Standardy Implementacji

Wszystkie endpointy są implementowane zgodnie z:

1. **Architektura Modularna**
   - `index.ts` - Router główny + CORS
   - `*.handlers.ts` - Handlery HTTP + walidacja
   - `*.service.ts` - Logika biznesowa
   - `*.types.ts` - DTO + schematy Zod

2. **Bezpieczeństwo**
   - Autentykacja JWT (Supabase Auth)
   - Row Level Security (RLS)
   - Walidacja Zod
   - CORS headers

3. **Observability**
   - Structured logging
   - Error tracking
   - Performance monitoring

4. **Dokumentacja**
   - API specification
   - Testing guide
   - Implementation details

## Jak Dodać Nowy Endpoint

1. **Stwórz strukturę Edge Function**
   ```bash
   mkdir supabase/functions/nazwa-funkcji
   cd supabase/functions/nazwa-funkcji
   touch index.ts nazwa-funkcji.handlers.ts nazwa-funkcji.service.ts nazwa-funkcji.types.ts
   ```

2. **Zaimplementuj zgodnie z wzorcem**
   - Zobacz `supabase/functions/search/` jako przykład
   - Postępuj zgodnie z `.cursor/rules/backend.mdc`

3. **Dodaj typy do shared/contracts**
   ```typescript
   // shared/contracts/types.ts
   export interface MyNewDto { ... }
   ```

4. **Stwórz serwis Angular**
   ```typescript
   // src/app/core/services/my-new.service.ts
   this.supabase.functions.invoke('nazwa-funkcji', ...)
   ```

5. **Udokumentuj**
   - Stwórz plik `nazwa-funkcji-implementation-summary.md`
   - Dodaj do tej listy w README.md

## Przydatne Komendy

```bash
# Uruchom wszystkie funkcje lokalnie
supabase functions serve

# Uruchom konkretną funkcję
supabase functions serve search

# Sprawdź logi
supabase functions serve search --debug

# Deploy na produkcję
supabase functions deploy search

# Testuj endpoint
curl -X GET "http://localhost:54321/functions/v1/search/global?q=test" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Roadmap (Przyszłe Endpointy)

Zgodnie z [API Plan](../../009%20API%20plan.md):

- [ ] `GET /recipes` - Lista przepisów z paginacją i filtrowaniem
- [ ] `GET /recipes/{id}` - Szczegóły przepisu
- [ ] `POST /recipes` - Tworzenie przepisu
- [ ] `PUT /recipes/{id}` - Aktualizacja przepisu
- [ ] `DELETE /recipes/{id}` - Usuwanie przepisu (soft delete)
- [ ] `GET /collections` - Lista kolekcji
- [ ] `POST /collections` - Tworzenie kolekcji
- [ ] `GET /collections/{id}` - Szczegóły kolekcji
- [ ] `PUT /collections/{id}` - Aktualizacja kolekcji
- [ ] `DELETE /collections/{id}` - Usuwanie kolekcji
- [ ] `POST /collections/{id}/recipes` - Dodanie przepisu do kolekcji
- [ ] `DELETE /collections/{collectionId}/recipes/{recipeId}` - Usunięcie przepisu z kolekcji
- [ ] `GET /categories` - Lista kategorii
- [ ] `GET /tags` - Lista tagów użytkownika
- [ ] `GET /profile` - Profil użytkownika
- [ ] `PUT /profile` - Aktualizacja profilu

## Kontakt

W przypadku pytań lub problemów, sprawdź:
1. Dokumentację w tym katalogu
2. Backend rules: `.cursor/rules/backend.mdc`
3. Frontend rules: `.cursor/rules/fronend.mdc`
4. API Plan: `docs/results/009 API plan.md`

