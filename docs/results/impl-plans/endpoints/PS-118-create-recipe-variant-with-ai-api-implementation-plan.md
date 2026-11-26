# PS-118 — plan implementacji API

## Cel

Udostępnić zapis szkicu AI jako nowego wariantu istniejącej rodziny przepisu.
Generowanie pozostaje w istniejącym `POST /ai/recipes/draft`: zapis nie wysyła
treści źródłowej ani ponownie nie nalicza kredytu. Nowy wariant powstaje dopiero
po świadomym `Zapisz`.

## Pliki

- `supabase/migrations/{timestamp}_ps118_ai_recipe_variant.sql`
- `supabase/functions/recipes/recipes.handlers.ts`
- `supabase/functions/recipes/recipes.variants.ts`
- `supabase/functions/recipes/recipes.variants.test.ts`,
  `recipes.handlers.test.ts`
- `shared/contracts/types.ts`
- `shared/types/database.types.ts` i
  `supabase/functions/_shared/database.types.ts` (po regeneracji, jeśli
  generator zmieni sygnatury RPC)
- `supabase/functions/ai/*` tylko w zakresie potwierdzenia istniejącego
  kontraktu i testów regresji; bez drugiego endpointu generowania

## Endpointy

### Istniejący draft

`POST /functions/v1/ai/recipes/draft`, JWT, role `user`/`premium`/`admin`.
Pozostaje bez zmiany: źródło `text`, `image` (1–5 zdjęć przez `images`) lub
`url`, pula `draft`, jeden kredyt za udane generowanie, zwrot po odrzuceniu
treści lub błędzie modelu/sieci. Walidacja obrazu i wszystkie istniejące kody
`400/402/413/422/429/500` pozostają zgodne z PS-100.

### Nowy zapis AI

`POST /recipes/{recipeId}/variants/ai`, JWT, właściciel aktywnego wariantu i
włączona flaga `recipe_variants`; `admin` może przejść przez istniejący
mechanizm flagi, ale nie omija własności rodziny.

Żądanie `CreateAiRecipeVariantCommand`:

- `variant_name`: przycięty tekst 1–150 znaków;
- `family_name`: tekst 1–150 albo `null` — aktualna wspólna nazwa, ewentualnie
  ręcznie zmieniona na przeglądzie;
- `visibility`: `PRIVATE | SHARED | PUBLIC` — aktualna lub ręcznie zmieniona;
- `description`, `ingredients_raw`, `steps_raw`, `tips_raw`, `tags`,
  `category_id`, `servings`, `prep_time_minutes`, `total_time_minutes`,
  `diet_type`, `cuisine`, `difficulty`, `is_termorobot`, `is_grill`;
- brak pola obrazu: zdjęcia źródłowe AI nie są okładką.

Endpoint atomowo sprawdza rodzinę, limit, nazwę, waliduje treść i tworzy
wariant. Odpowiedź `201` zawiera `recipe_id` oraz minimalny
`RecipeDetailDto`/slugowe dane potrzebne do przejścia do
`/recipes/{id}-{slug}`. `is_default=false`, `sort_order=max+1`; nazwa rodziny
i widoczność są aktualizowane tylko z wartości przesłanych przez formularz.
Jeśli formularz nie zmienił tych pól, przekazuje wartości odczytane z rodziny.

## RPC, transakcja i bezpieczeństwo

Migracja doda `create_recipe_variant_from_ai(...)` jako `security definer`.
RPC:

1. blokuje `recipe_families` `FOR UPDATE`;
2. potwierdza `p_user_id` z JWT, aktywny przepis i flagę;
3. sprawdza 1–10 aktywnych wariantów oraz unikalność
   `lower(btrim(variant_name))`;
4. aktualizuje nazwę/widoczność rodziny, jeśli przekazane;
5. parsuje surowe składniki, kroki i wskazówki tym samym mechanizmem co
   istniejące tworzenie przepisu;
6. mapuje tylko istniejącą kategorię wskazaną przez `category_id`, nie tworzy
   kategorii z tekstu AI;
7. wstawia nowy rekord z `image_path = null`, bez kopiowania tagów, kolekcji,
   ocen, notatek, planu i listy zakupów;
8. zwraca nowe ID i dane do nawigacji.

Wszystkie funkcje `security definer` w migracji muszą mieć
`REVOKE ALL ... FROM public, anon, authenticated` i jawny `GRANT EXECUTE`
wyłącznie dla `service_role`; migracja sprawdza `has_function_privilege`.
Własność nie może pochodzić z body. `PUBLIC` dziedziczy się przez rodzinę.
Nie modyfikować istniejącego `create_recipe_variant`, `POST /variants`
(pusty/kopia), `PUT /recipes/{id}` ani semantyki `/ai/recipes/draft`.

## Kody błędów

- `401` — brak lub nieważny JWT;
- `400` — niepoprawny JSON, DTO, surowe składniki/kroki albo wartości poza
  zakresem;
- `403` — flaga wyłączona dla roli;
- `404` — cudzy, usunięty lub nieistniejący przepis/rodzina;
- `409` — limit 10, zajęta nazwa wariantu lub konflikt współbieżności;
- `422` — semantycznie niepoprawny zapis po walidacji formularza;
- `500` — błąd RPC/Storage/infrastruktury.

Błędy mapować przez istniejące `ApplicationError` i `{ code, message, details }`.
Nie zwracać treści źródłowej ani informacji o cudzych wariantach.

## Kontrakty i implementacja

Dodać w `shared/contracts/types.ts`:
`CreateAiRecipeVariantCommand` oraz `CreateAiRecipeVariantResponseDto`.
Wspólne typy szkicu (`AiRecipeDraftDto`, metadata, obrazy i błędy) pozostają
addytywne i zsynchronizowane z backendem. Dodać walidację Zod po stronie
handlera; normalizacja `trim`, tagów i tekstów musi odpowiadać istniejącemu
`POST /recipes`. Router sprawdza ścieżkę `/variants/ai` przed ogólnym
`/variants` i ścieżką `/recipes/{id}`.

## Testy `deno test`

- schemat i DTO zapisu: pola wymagane, zakresy, trim, puste składniki/kroki —
  scenariusze **1, 2, 7, 8**;
- RPC: właściciel/flaga, limit, nazwa bez względu na wielkość liter,
  kolejność na końcu, brak domyślności, nazwa i widoczność rodziny —
  **1, 2, 7, 8, 10**;
- mapowanie draftu: wszystkie pola, puste opcjonalne wartości, kategoria,
  `is_termorobot`, `is_grill`, brak okładki i brak kopii danych użytkownika —
  **2**;
- transakcja i konflikt współbieżnego zapisu — **6, 8**;
- regresja istniejącego pustego wariantu/kopii i istniejącego draftu wraz z
  kredytami, błędami oraz obrazami — **3, 9, 11**;
- routing i kody `401/403/404/409/422/500` — **4, 8, 10**.

Weryfikacja: `supabase db reset`, `deno test supabase/functions/recipes`,
`deno test supabase/functions/ai`, `deno lint` i `deno check` zmienionych
funkcji, `ng build`.

## Czynności ręczne

1. Po `supabase db reset` wykonać zapytania weryfikacyjne z migracji:
   aktywne warianty 1–10, dokładnie jeden domyślny, kolejność `0..n-1`,
   brak konfliktu nazw oraz `has_function_privilege` dla nowego RPC.
2. Ustawić SQL-em flagę na `admin`, wygenerować szkic tekstem, sprawdzić że
   „Dalej” nie tworzy wiersza, a zapis tworzy wariant na końcu bez domyślności.
3. Sprawdzić zapis szkicu z tekstu, obrazu i URL; potwierdzić mapowanie pól,
   brak okładki ze źródła, brak zmian kolekcji/ocen/planu/listy i zużycie
   dokładnie jednego kredytu za udane generowanie.
4. Sprawdzić wyjście bez zapisu, nazwę pustą/zajętą, limit 10 oraz konflikt
   równoległego zapisu; potwierdzić że kredyt po generowaniu pozostaje zużyty.
5. Powtórzyć żądania jako zwykły właściciel, użytkownik bez własności,
   admin i bez JWT; potwierdzić `403`/`404`/`401`, brak zmian oraz brak dostępu
   do RPC. Zapisać status ręcznej weryfikacji jako `PASS`, `FAIL`,
   `NIE_WYKONANO` albo `WYMAGA_WERYFIKACJI`; nie wykonywać wdrożenia zdalnego.
