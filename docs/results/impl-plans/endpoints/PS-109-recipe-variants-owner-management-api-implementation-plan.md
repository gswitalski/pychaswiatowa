# PS-109 — plan implementacji API

## Cel i etapy

Udostępnić właścicielowi pełne zarządzanie wariantami przy zachowaniu
kompatybilności istniejących zapisów i odczytów. Flaga jest wyłączona po
migracji, a nowe operacje pozostają niedostępne do czasu jej włączenia.

Plan należy wykonać etapami:

1. **Bezpieczeństwo i flaga:** migracja flag, zamknięcie istniejących RPC,
   klient `service_role` w `recipes`, weryfikacja JWT/własności oraz stan flagi
   w `/me`.
2. **Domena i kontrakty:** RPC dla listy, tworzenia pustego/kopii, nazwy,
   widoczności, domyślnego wariantu, kolejności, użycia i usuwania; DTO,
   mapowanie błędów i testy.
3. **Integracja Storage i regresja:** kopiowanie zdjęcia best-effort,
   sprzątanie planu/kolekcji/listy zakupów, migracja typów oraz testy
   istniejących ścieżek tworzenia, edycji, importu i AI.

## Pliki i API

- Nowa migracja `supabase/migrations/{timestamp}_recipe_variants_owner_management.sql`
  oraz ewentualna kolejna migracja wyłącznie dla korekt uprawnień/RPC.
- `supabase/functions/recipes/recipes.handlers.ts`,
  `recipes.service.ts`, opcjonalnie `recipes.types.ts` i `recipes.utils.ts`.
- `supabase/functions/me/me.service.ts` i kontrakt `/me`.
- `shared/contracts/types.ts`, `shared/types/database.types.ts`,
  `supabase/functions/_shared/database.types.ts`.
- Testy `supabase/functions/recipes/*.test.ts`, `me/*.test.ts` oraz
  weryfikacyjne zapytania SQL/migracji.

Proponowane ścieżki, wszystkie chronione JWT i własnością grupy/wariantu:

- `GET /recipes/{recipeId}/variants` — lista skrótów wariantów grupy
  wskazanej przepisem.
- `POST /recipes/{recipeId}/variants` — pusty wariant albo kopia;
  body zawiera `variant_name` i opcjonalne `source_recipe_id`.
- `PUT /recipes/{recipeId}/variant-name` — zmiana nazwy jednego wariantu.
- `PUT /recipes/{recipeId}/family` — zmiana nazwy grupy i/lub widoczności.
- `PUT /recipes/{recipeId}/default` — wskazanie wariantu domyślnego.
- `PUT /recipes/{recipeId}/order` — pełna lista aktywnych `recipe_id` w nowej
  kolejności.
- `GET /recipes/{recipeId}/usage` — użycie wariantu lub całej grupy przed
  usunięciem.
- `DELETE /recipes/{recipeId}/variants/{variantId}` oraz
  `DELETE /recipes/{recipeId}/family` — odpowiednio usunięcie wariantu/grupy.

Router sprawdza dłuższe ścieżki przed `/recipes/{id}`. Operacje grupowe
identyfikują rodzinę przez wariant, nie ujawniają `recipe_family_id` w URL.
Istniejące `GET/POST/PUT/DELETE /recipes/{id}` zachowują znaczenie; `PUT`
z `name`/`visibility` nadal zmienia grupę i kopie zgodnie z PS-108.

## Migracja, RPC i uprawnienia

1. Utworzyć tabelę flag, np. `feature_flags(name text primary key,
   mode text check (mode in ('disabled','admin','all')), updated_at ...)`,
   z rekordem wariantu funkcji ustawionym na `disabled`. Odczyt flagi wykona
   uprzywilejowany backend; brak rekordu oznacza `disabled`. Nie dodawać panelu
   administracyjnego. `/me` zwraca addytywnie `features.recipe_variants`
   (np. `enabled: boolean`, `mode`), obliczone dla roli JWT.
2. Wszystkie nowe funkcje `security definer` mają `REVOKE ALL` od
   `public, anon, authenticated` i `GRANT EXECUTE` tylko `service_role`.
   To samo zastosować do `create_recipe_with_tags`,
   `update_recipe_with_tags` i `soft_delete_recipe`; `soft_delete_recipe`
   przyjmuje jawne `p_user_id`. Migracja sprawdza
   `has_function_privilege` dla każdej funkcji i kończy się błędem przy
   dostępie `authenticated`/`anon`.
3. Edge Function utworzyć na kliencie serwisowym po poprawnej weryfikacji
   Bearer JWT. `user_id` przekazywać do RPC wyłącznie z tokena, a przed
   każdym odczytem/zapisem sprawdzać właściciela grupy i wariantu. Cudzy,
   usunięty lub nieistniejący zasób zwracać jako `404`.
4. Nowe RPC blokują wiersz `recipe_families` (`FOR UPDATE`) przed liczeniem
   aktywnych wariantów. Limit wynosi 10; dodanie na limicie zwraca błąd
   domenowy mapowany na `409`. Nazwa jest przycinana i walidowana jak
   `recipes.name`; konflikt bez wielkości liter mapować na `409`.
5. Puste tworzenie i kopiowanie wykonuje jedna transakcja: sprawdzenie flagi
   i własności, limit, obliczenie `sort_order = max + 1`, insert wariantu
   z `is_default = false`, a przy kopii jednorazowe skopiowanie opisu,
   składników, kroków, porad, tagów, kategorii, cech i czasów. Nazwa grupy
   i widoczność pochodzą z `recipe_families`; trigger PS-108 synchronizuje
   kopie. Odpowiedź zawiera nowy `recipe_id`, listę wariantów i ewentualne
   `image_warning`.
6. RPC grupowe blokują rodzinę i aktualizują spójnie:
   - nazwę rodziny oraz `recipes.name` aktywnych wariantów,
   - widoczność rodziny oraz `recipes.visibility`,
   - dokładnie jeden `is_default`,
   - kompletną kolejność `0..n-1`.
   Niepełna, zduplikowana, obca lub usunięta lista kolejności kończy się
   atomowym `400`; obcy wariant/domyslny `404`.
7. RPC użycia zwraca liczby dla planu, kolekcji i listy zakupów. Usunięcie
   wariantu wymaga co najmniej dwóch aktywnych rekordów, ustawia `deleted_at`,
   wybiera pierwszy aktywny wariant według kolejności, a następnie sprząta
   wpis właściciela w kolekcjach i planie oraz uruchamia tę samą logikę RPC
   co usunięcie z planu dla listy zakupów. Usunięcie grupy wykonuje
   kaskadowe soft-delete i sprzątanie. Ostatni wariant zwraca `409`.
8. Kopia zdjęcia jest wykonywana po utworzeniu rekordu pod ścieżką
   `recipe-images/{userId}/{newRecipeId}/cover_{ts}.{ext}`. Niepowodzenie
   nie wycofuje wariantu: odpowiedź zawiera ostrzeżenie, a pliki tymczasowe
   są usuwane best-effort. Usunięcie wariantu nie kasuje pliku innego
   wariantu.

## Kontrakty, błędy i testy

Dodać addytywne DTO: `RecipeVariantSummaryDto`,
`RecipeVariantsResponseDto`, `CreateRecipeVariantCommand`,
`UpdateRecipeFamilyCommand`, `SetDefaultVariantCommand`,
`ReorderRecipeVariantsCommand`, `RecipeUsageDto` oraz odpowiedzi operacji.
Lista zawiera id, nazwę, `is_default`, `sort_order`, miniaturę i chipy
wyliczone z `diet_type`, `is_termorobot`, `is_grill`, `difficulty`, `servings`.
Nie zwracać pełnej treści wszystkich wariantów.

Używać wspólnego formatu `{ code, message, details }`: `401` brak JWT,
`403` odrzucona flaga dla bieżącej roli (jednolity kod ustali implementacja),
`404` obcy/nieaktywny zasób, `409` limit/konflikt/ostatni wariant,
`400` niepoprawna kolejność lub body, `422` walidacja i `500` awaria.

Testy `deno test` pokrywają GWT **1–21** (flaga, własność, limit,
unikalność, kopiowanie, ostrzeżenie Storage, grupowe transakcje, usuwanie
i uprawnienia), a testy regresji potwierdzają **8, 11, 20–22** dla
istniejących ścieżek. Zapytania lokalnej bazy sprawdzają **6, 12–16, 20**,
blokadę współbieżnego dodawania oraz `has_function_privilege`. Uruchomić
`supabase db reset`, `deno lint`, `deno check` zmienionych funkcji, `ng lint`
i `ng build`. Nie zmieniać `search_vector`, RLS `recipes` ani dostępu
`SHARED` po linku.

## Założenia

- Flaga w trybie `all` nadal udostępnia operacje wyłącznie właścicielowi
  grupy; nie włącza publicznego odczytu. Z powodu stanu RLS z PS-108 plan
  ręczny używa `admin`, a tryb `all` pozostaje przełącznikiem technicznym
  do późniejszego domknięcia widoczności.
- Limit 10 jest stały, niezależny od planu konta.
- Nazwa grupy jest aktualizowana przez osobne API grupowe, a stare `PUT`
  pozostaje kompatybilnym aliasem tej semantyki.
- Usunięcie wariantu sprząta wpisy właściciela; wpisy innych użytkowników
  zachowują dzisiejszą semantykę soft-delete.
- `database.types.ts` aktualizować ręcznie/addytywnie, jeśli generator
  usunie istniejące `| null`; nie rozszerzać tego planu o naprawę długu
  typów `explore`.
- Wektor wyszukiwania i nazwa techniczna `Podstawowa` pozostają bez zmian;
  zmiana nazwy grupy synchronizuje tylko istniejące kopie.
- Operacje flagi i wariantów są jednostkowe dla żądania; nie wprowadzać
  endpointu panelu flag ani przywracania.

## Czynności ręczne

1. Po `supabase db reset` wykonać zapytania weryfikacyjne z migracji:
   aktywne warianty 1–10, dokładnie jeden domyślny, kolejność `0..n-1`,
   brak konfliktu nazw oraz `has_function_privilege` dla nowych i trzech
   przebudowanych RPC.
2. Ustawić SQL-em flagę na `admin`, utworzyć grupę z pustego wariantu
   i kopii, sprawdzić listę, zmianę nazwy/widoczności, domyślny i kolejność.
3. Sprawdzić kopiowanie zdjęcia, odpowiedź z ostrzeżeniem po kontrolowanym
   błędzie Storage, użycie w planie/kolekcji/liście zakupów oraz usunięcie
   wariantu i całej grupy.
4. Powtórzyć wybrane żądania jako zwykły użytkownik, użytkownik bez własności
   i bez JWT; potwierdzić `404`/`401`, brak zmian oraz brak dostępu do RPC.
5. Zapisać status ręcznej weryfikacji jako `PASS`, `FAIL`, `NIE_WYKONANO`
   albo `WYMAGA_WERYFIKACJI`; nie wykonywać wdrożenia zdalnego.
