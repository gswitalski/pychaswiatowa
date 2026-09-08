<conversation_summary>
<decisions>
1. Tabela `profiles` zostanie utworzona w schemacie `public` i połączona z `auth.users` kluczem obcym `id` (UUID). Będzie zawierać również `username` i `updated_at`.
2. Składniki i kroki przepisu będą przechowywane w kolumnach typu `JSONB` w tabeli `recipes`.
3. Zostanie utworzona dedykowana tabela `categories` dla predefiniowanych kategorii, połączona z `recipes` kluczem obcym. Kategorie będą inicjalizowane za pomocą skryptu `supabase/seed.sql`.
4. Relacje wiele-do-wielu dla tagów i kolekcji zostaną zaimplementowane przy użyciu tabel łączących (`recipe_tags`, `recipe_collections`).
5. Dostęp do danych zostanie zabezpieczony za pomocą polityk Row Level Security (RLS) w każdej tabeli, opartych na kolumnie `user_id` i funkcji `auth.uid()`.
6. Wprowadzone zostanie "miękkie usuwanie" (soft delete) poprzez dodanie kolumny `deleted_at` do tabeli `recipes`.
7. Kolumna `user_id` w tabelach z danymi użytkownika będzie miała wartość domyślną `auth.uid()`, aby automatycznie przypisywać właściciela.
8. Pola tekstowe, takie jak nazwy, będą miały ograniczenia długości (`CHECK constraints`). Tagi będą unikalne w obrębie użytkownika, bez uwzględniania wielkości liter, co zostanie zapewnione przez unikalny indeks.
9. Zostaną utworzone indeksy B-drzewa (dla sortowania po `name` i `created_at`) oraz GIN (dla wyszukiwania pełnotekstowego w `name` i `ingredients`).
10. Logika parsowania składników/kroków zostanie zaimplementowana jako funkcja PostgreSQL, aby zapewnić spójność danych.
11. Zostanie utworzony widok `recipe_details` oraz funkcja RPC do pobierania listy przepisów, aby uprościć zapytania po stronie klienta i rozwiązać problem N+1.
12. Zdjęcia będą przechowywane w Supabase Storage, a w bazie danych zapisywana będzie tylko relatywna ścieżka do pliku. Dostęp do Storage będzie chroniony osobnymi politykami.
13. Integralność referencyjna zostanie zapewniona przez reguły `ON DELETE CASCADE` na kluczach obcych w tabelach łączących.
</decisions>

<matched_recommendations>
1. Modelowanie danych użytkownika poprzez osobną tabelę `profiles` połączoną z `auth.users`.
2. Użycie typu `JSONB` do elastycznego przechowywania ustrukturyzowanych danych, takich jak składniki i kroki.
3. Implementacja relacji wiele-do-wielu dla tagów i kolekcji za pomocą tabel pośredniczących.
4. Zabezpieczenie danych na poziomie wiersza (RLS) w oparciu o ID zalogowanego użytkownika (`auth.uid()`).
5. Stosowanie "miękkiego usuwania" (soft delete) jako bezpieczniejszej alternatywy dla trwałego kasowania danych.
6. Automatyzacja przypisywania właściciela rekordu poprzez ustawienie `DEFAULT auth.uid()` dla kolumny `user_id`.
7. Optymalizacja zapytań i uproszczenie logiki po stronie klienta przez tworzenie widoków (VIEWS) i funkcji bazodanowych (RPC).
8. Zapewnienie integralności danych poprzez `CHECK constraints` oraz unikalne indeksy.
9. Inicjalizacja danych stałych (np. kategorii) za pomocą skryptów seedujących.
10. Zabezpieczenie dostępu do plików w Supabase Storage za pomocą dedykowanych polityk.
</matched_recommendations>

<database_planning_summary>
Na podstawie wymagań produktowych (PRD) i stacku technologicznego (Angular, Supabase) uzgodniono kompleksowy plan schematu bazy danych PostgreSQL dla aplikacji PychaŚwiatowa.

**a. Główne wymagania dotyczące schematu bazy danych**
Schemat będzie oparty na kilku głównych tabelach w schemacie `public`. Centralnym punktem będzie tabela `recipes`, przechowująca szczegóły przepisów. Dane użytkowników będą zarządzane przez Supabase Auth (`auth.users`) i połączone z tabelą `profiles`. Organizacja przepisów będzie realizowana przez tabele `categories`, `tags` oraz `collections`. Wszystkie tabele z danymi prywatnymi będą zawierać kolumnę `user_id` w celu powiązania z właścicielem.

**b. Kluczowe encje i ich relacje**
- `profiles`: Relacja jeden-do-jednego z `auth.users`. Przechowuje publiczne dane profilowe.
- `recipes`: Należy do jednego `profile` (jeden-do-wielu) i jednej `category` (jeden-do-wielu). Zawiera kolumny `JSONB` na składniki i kroki oraz kolumnę `deleted_at` do obsługi soft delete.
- `categories`: Tabela słownikowa z predefiniowanymi kategoriami.
- `tags`: Każdy użytkownik ma własny zbiór tagów. Relacja wiele-do-wielu z `recipes` poprzez tabelę łączącą `recipe_tags`.
- `collections`: Każdy użytkownik ma własne kolekcje. Relacja wiele-do-wielu z `recipes` poprzez tabelę `recipe_collections`.

**c. Ważne kwestie dotyczące bezpieczeństwa i skalowalności**
- **Bezpieczeństwo:** Dostęp do danych będzie ściśle kontrolowany przez polityki Row Level Security (RLS), zapewniające, że użytkownicy mogą modyfikować tylko własne zasoby. Dostęp do plików w Supabase Storage również będzie chroniony dedykowanymi politykami.
- **Wydajność i Skalowalność:** W celu optymalizacji zapytań zostaną utworzone indeksy (B-tree dla sortowania, GIN dla wyszukiwania pełnotekstowego). Aby zminimalizować liczbę zapytań z frontendu i uniknąć problemu N+1, zostaną zaimplementowane widoki (`recipe_details`) oraz funkcje RPC, które będą agregować i zwracać złożone dane w jednym wywołaniu.

**d. Podsumowanie kluczowych decyzji technicznych**
- Struktura składników/kroków będzie przechowywana w `JSONB`.
- Logika parsowania tekstu zostanie przeniesiona do funkcji PostgreSQL.
- Identyfikator użytkownika będzie automatycznie wstawiany przez bazę danych (`DEFAULT auth.uid()`).
- Zostanie zastosowane "miękkie usuwanie" zamiast trwałego kasowania danych.
</database_planning_summary>

<unresolved_issues>
Brak nierozwiązanych kwestii. Wszystkie przedstawione rekomendacje zostały zaakceptowane i stanowią podstawę do stworzenia skryptów migracyjnych dla schematu bazy danych.
</unresolved_issues>
</conversation_summary>
