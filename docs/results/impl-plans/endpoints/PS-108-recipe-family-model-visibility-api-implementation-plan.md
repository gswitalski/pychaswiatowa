# PS-108 — plan implementacji API

## Cel i zakres

Wprowadzić model `recipe_families`, przypisać do niego każdy istniejący przepis
oraz zachować dotychczasowe odpowiedzi i widoczność. Nie dodawać endpointów do
zarządzania wariantami ani nie zmieniać `search_vector`, RLS `recipes`,
`security_invoker` widoku `recipe_details` ani zachowania `SHARED`.

## Pliki

- Nowa migracja `supabase/migrations/{timestamp}_create_recipe_families.sql`:
  tabela, indeksy, RLS, backfill, ograniczenia, triggery/RPC, uprawnienia i
  weryfikacja.
- Kolejne migracje tylko jeśli konieczne do bezpiecznego zastąpienia istniejących
  definicji `create_recipe_with_tags`, `update_recipe_with_tags` lub
  `soft_delete_recipe`; nie usuwać obcych przeciążeń.
- `supabase/functions/recipes/recipes.service.ts` i ewentualnie
  `recipes.handlers.ts`: wyłącznie dostosowanie typów/mapowania, bez zmiany
  publicznego kształtu odpowiedzi.
- `shared/contracts/types.ts`,
  `shared/types/database.types.ts` oraz
  `supabase/functions/_shared/database.types.ts`: typy addytywne, wygenerowane
  po migracji.
- Testy obok zmienionych serwisów oraz migracyjne zapytania weryfikacyjne.

## Model danych i migracja

1. Utworzyć `public.recipe_families` z `id`, `user_id`, `name`, `visibility`,
   `deleted_at`, `created_at`, `updated_at`; klucz główny oraz unikalność
   `(id, user_id)`, FK właściciela i indeksy po właścicielu/widoczności.
2. Włączyć RLS wyłącznie na tej tabeli. Polityka SELECT pozwala właścicielowi
   czytać własne grupy oraz wszystkim czytać wyłącznie aktywne `PUBLIC`.
   Brak polityk INSERT/UPDATE/DELETE dla `anon`/`authenticated`; zapis wykonują
   backend i funkcje uprzywilejowane.
3. Dodać do `recipes` `recipe_family_id`, `variant_name`, `is_default`,
   `sort_order`; najpierw nullable, następnie w jednej migracji transakcyjnej
   utworzyć grupę 1:1 z kopiami `user_id`, `name`, `visibility`,
   `deleted_at`, `created_at`, przypisać każdy rekord i ustawić
   `Podstawowa`, `true`, `0`, a potem dodać NOT NULL, FK z `(recipe_family_id,
   user_id)` i indeks `recipe_family_id`. Zachować wszystkie identyfikatory i
   rekordy zależne.
4. Dodać częściowe unikalności dla aktywnych wariantów: jedna nazwa
   wariantu w grupie bez rozróżniania wielkości liter oraz najwyżej jeden
   aktywny `is_default`. Reguła „grupa aktywna ma domyślny wariant” ma być
   wymuszona przez trigger/constraint-check wykonywany atomowo.
5. Trigger na `recipes` ma odrzucać rozjazd `name`/`visibility` z grupą i
   synchronizować `deleted_at` z grupą. Przy insercie bez grupy, o ile nie da
   się bezpiecznie odrzucić starego kodu, rekomendowane jest utworzenie
   grupy 1:1 w tej samej transakcji; po wdrożeniu nie może powstać rekord bez
   grupy. Operacje grupowe backendu aktualizują grupę i kopię w jednym RPC.
6. Przebudować zapis tworzenia/edycji tak, aby `create_recipe_with_tags` tworzył
   grupę i przepis atomowo, a `update_recipe_with_tags` aktualizował nazwę i
   widoczność grupy oraz kopię. `soft_delete_recipe` usuwa grupę i wariant
   (w PS-108 1:1). Import URL i zapis szkicu AI korzystają z tej samej ścieżki
   tworzenia; pozostałe ścieżki zapisu są objęte triggerem.

## API, kontrakty i błędy

Brak nowych publicznych endpointów. Zachować:

- `POST /functions/v1/recipes` — 201, ten sam DTO co obecnie;
- `PUT /functions/v1/recipes/{id}` — 200, ten sam DTO;
- `DELETE /functions/v1/recipes/{id}` — 204;
- `POST /functions/v1/recipes/import` i ścieżka AI — 201, bez zmiany DTO;
- istniejące GET/listy, `/recipes/{id}`, Explore, public, search, plan,
  kolekcje i admin — 200 oraz niezmienione filtrowanie.

Stosować dotychczasowe kody: 400 dla niepoprawnego requestu, 401 dla braku
JWT, 402 jeśli istniejąca ścieżka kredytowa go zgłasza, 403 dla braku
uprawnienia, 404 dla nieistniejącego/usuniętego przepisu, 409 dla konfliktu
unikalności wariantu, 422 dla błędu walidacji domenowej i 500 dla błędu bazy.
Nie wprowadzać nowych kodów ani zmieniać komunikatów użytkownika bez potrzeby.
Kontrakty dodają opcjonalne pola rodziny/wariantu wyłącznie tam, gdzie typ
kompilatora tego wymaga; istniejące DTO pozostają kompatybilne.

Każda przebudowana funkcja `security definer` musi mieć jawne `REVOKE ALL`
od `public`, `anon`, `authenticated`, a następnie `GRANT EXECUTE` wyłącznie
roli faktycznie wywołującej (dla zachowania obecnego RPC: `authenticated`,
ewentualnie `service_role`). Migracja sprawdza `has_function_privilege`;
anon/public nie mogą wykonywać funkcji.

## Testy i weryfikacja

- Testy `deno test` serwisów/handlerów: scenariusze GWT **8–12** oraz
  mapowanie/kompatybilność odpowiedzi **18–20**; testy błędów ścieżek
  tworzenia, edycji, importu i usuwania.
- Testy SQL na lokalnej bazie: **1–7**, **13–17**; dane PRIVATE/SHARED/PUBLIC,
  aktywne/usunięte, pusta baza, rollback, role anon/authenticated oraz
  `has_function_privilege`.
- Sprawdzić `recipes.relrowsecurity = false`, `recipe_families.relrowsecurity
  = true`, brak `security_invoker` w `recipe_details` oraz niezmieniony
  `search_vector`.
- Uruchomić `supabase db reset`, migrację na kopii danych, `deno lint`,
  `deno check` zmienionych funkcji, `ng lint` i `ng build`.

## Założenia

- Nazwa grupy w backfillu jest kopią `recipes.name`; wariant zawsze
  `Podstawowa`.
- Zapis bez `recipe_family_id` dostaje grupę 1:1 przez trigger, jeśli nie
  narusza to bezpieczeństwa; w przeciwnym razie jest odrzucony czytelnym
  błędem, nigdy nie tworzy osieroconego przepisu.
- Zmiany nazwy/widoczności wykonuje istniejąca ścieżka edycji, nie nowy
  endpoint grupowy; nowe warianty pozostają niemożliwe dla użytkownika.
- Wpisy innych użytkowników, `SHARED`, soft delete i wszystkie odpowiedzi
  odczytowe zachowują dzisiejszą semantykę.

## Czynności ręczne

Brak poza uruchomieniem lokalnych zapytań weryfikacyjnych opisanych powyżej.
