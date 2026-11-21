# PS-110 — plan implementacji API

## Cel i zakres

Rozszerzyć istniejące `GET /recipes/{id}` oraz `GET /explore/recipes/{id}` o
opcjonalny parametr `variant`, rozstrzyganie wariantu zgodnie z R1–R6 oraz
addytywną listę dostępnych wariantów. Zachować dotychczasowe rozróżnienie
`403` dla `/recipes` i `404` dla `/explore`, nie ujawniać cudzych grup i
ignorować nowe dane przy wyłączonej fladze.

Zakres obejmuje GWT 1–12, 22 oraz dane potrzebne frontendowi do GWT 13–27.
Nie obejmuje `/public/recipes/{id}`, RLS `recipes`, dostępu `SHARED` po linku,
list i wyszukiwania ani nowych operacji wariantów z PS-109.

## Etapy i pliki

1. **Kontrakt i selekcja danych**
   - rozszerzyć `RecipeDetailDto` o opcjonalne `variants` oraz
     `variant_resolution` (`null` albo powód `INVALID_PARAMETER` /
     `VARIANT_DELETED`);
   - zachować istniejący `RecipeVariantSummaryDto`, ale mapować `chips`
     wyłącznie dla cech różniących się w rodzinie;
   - dodać do widoku `recipe_details` pola `recipe_family_id`, `is_default`,
     `sort_order` albo pobierać je addytywnie z `recipes`; dla usuniętego
     `{id}` używać kontrolowanego odczytu `recipes` + `recipe_families`,
     ponieważ bieżący widok filtruje `deleted_at`;
   - ręcznie uzupełnić typy bazy, jeżeli generator zmieni istniejące typy.
2. **Rozstrzyganie domenowe**
   - w `recipes.service.ts` i `explore.service.ts` dodać wspólny schemat
     rozstrzygania: aktywność flagi, dostęp do grupy, aktywny/nieaktywny
     `{id}`, walidacja `variant`, wybór wariantu i budowa listy;
   - filtrować rodzeństwo w kodzie funkcji po ustaleniu właściciela:
     właściciel widzi wszystkie aktywne, pozostali tylko `PUBLIC`;
   - wykonywać porównanie chipów przed mapowaniem, pomijając cechy identyczne
     w całej grupie oraz wartości logiczne `false`;
   - przy błędnym/nieaktualnym `variant` otwierać domyślny wariant i zwracać
     powód; przy usuniętym `{id}` robić to samo tylko dla dostępnej rodziny,
     w pozostałych przypadkach zwracać dotychczasowy `403`/`404`.
3. **Obsługa HTTP**
   - w `recipes.handlers.ts` i `explore.handlers.ts` odczytać `variant`
     z `URL.searchParams`, przekazać je jako surowy tekst do serwisu i nie
     parsować luźniej niż reguły R2;
   - rozszerzyć frontendowe serwisy o `variant` w query stringu oraz
     propagowanie statusu błędu, bez bezpośredniego dostępu do Supabase;
   - w `/recipes` zachować klienta uwierzytelnionego dla działań użytkownika
     i service-role tylko dla kontroli `403`/`404` oraz publicznego szczegółu;
     w `/explore` pozostać przy service-role z kontrolą dostępu w kodzie.
4. **Regresja i testy**
   - testy `deno test` dla GWT 1–12 i 22: aktywny A/B, parametr równy,
     nieliczbowy, obca grupa, usunięty wariant, niedostępna rodzina, flaga,
     filtrowanie `PRIVATE`/`SHARED`/`PUBLIC`, jeden wariant, chipy i brak
     pełnej treści w podsumowaniach;
   - testy kontraktu/mapowania dla odpowiedzi bez `variants` przy fladze
     `disabled`/`admin` oraz dla obu ścieżek `getRecipeById`;
   - naprawić przy okazji znane błędy typów `explore`, o ile wynikają z
     rozszerzenia używanych w PS-110 pól; nie rozszerzać pracy o niezwiązany
     refaktor generatora typów;
   - uruchomić `deno test`, `deno lint` i `deno check` zmienionych funkcji oraz
     `ng lint`/`ng build`; bez E2E.

## Kontrakt odpowiedzi

`RecipeDetailDto` zachowuje wszystkie dotychczasowe pola wybranego wariantu.
Przy aktywnej fladze otrzymuje:

- `variants: RecipeVariantSummaryDto[]` — aktywne, dostępne rodzeństwo,
  posortowane po `sort_order`, wyłącznie pola podsumowania;
- `variant_resolution: { reason: 'INVALID_PARAMETER' | 'VARIANT_DELETED'; message: string } | null`.

`variant_resolution` jest `null`, gdy nie było ratunku. Przy wyłączonej fladze
oba pola są pomijane lub `null` zgodnie z istniejącą konwencją DTO, a
`variant` nie wpływa na wybór. `id`, treść, oceny, notatka, kolekcje i plan
zawsze dotyczą wariantu faktycznie otwartego.

## Założenia

- Flaga jest odczytywana tym samym mechanizmem co PS-109; `admin` oznacza
  włączenie tylko dla administratora, a `all` nie jest używane do publicznego
  dostępu. Włączenie `all` nadal wymaga osobnego domknięcia RLS i `SHARED`.
- Najmniejszą bezpieczną zmianą jest addytywne rozszerzenie `recipe_details`
  o metadane aktywnego wariantu; stan usuniętego wariantu i rodziny jest
  sprawdzany w `recipes`/`recipe_families`, bez ujawniania danych grupy.
- Nieliczbowy, ujemny, nieistniejący, usunięty lub obcy `variant` ma wspólny
  rezultat „wariant domyślny + `INVALID_PARAMETER`”, poza komunikatem
  `VARIANT_DELETED` dla usuniętego wariantu.
- Lista jednego wariantu jest zwracana przy aktywnej fladze; UI zdecyduje,
  czy nie renderować przełącznika.
- Dług typów `explore` naprawiać tylko addytywnie w zakresie pól użytych przez
  resolver i chipy. Nie obejmować `/public`, bo historyjka jednoznacznie
  ogranicza endpointy do `recipes` i `explore`.
- Soft delete całej rodziny korzysta z istniejącego `soft_delete_recipe`;
  API nie dodaje nowej operacji usuwania, a frontend pobiera `active_variant_count`
  i pokazuje liczbę wariantów przed wywołaniem istniejącej akcji.

## Czynności ręczne

1. Po `supabase db reset` sprawdzić metadane widoku i aktywną rodzinę:
   jeden domyślny wariant, poprawne `sort_order`, rodzina aktywna/usunięta
   oraz widoczność kopii `recipes.visibility`.
2. Ustawić flagę SQL-em na `admin`, przygotować rodzinę A/B/C i wykonać
   żądania obu endpointów: bez `variant`, z A/B, z wartością błędną, obcą
   i usuniętą. Potwierdzić wybrany `id`, powód ratunku i brak treści rodzeństwa.
3. Powtórzyć żądania jako właściciel, inny użytkownik i gość dla
   `PRIVATE`, `SHARED` oraz `PUBLIC`; potwierdzić `403`/`404`, brak przecieku
   listy i poprawne chipy różnicujące.
4. Ustawić flagę `disabled`/`admin` dla zwykłego użytkownika i potwierdzić,
   że `variant` jest ignorowany, a odpowiedź zachowuje dawny kształt.
5. Uruchomić oba widoki lokalnie i sprawdzić ręcznie tylko scenariusze API
   niezbędne do integracji; wynik zapisać jako `PASS`, `FAIL`,
   `NIE_WYKONANO` albo `WYMAGA_WERYFIKACJI`. Nie wdrażać zdalnie.
