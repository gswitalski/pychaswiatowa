# PS-111 — plan implementacji API

## Cel i zakres

Włączyć grupowanie aktywnych, dostępnych wariantów przed paginacją/limitem dla
Explore (`public`), „Moje przepisy” (`recipes`), kolekcji i wyszukiwarki
globalnej. Przy aktywnej fladze jedna grupa zwraca jednego reprezentanta,
liczbę `N`, liczbę pasujących `K`, nazwy skrótu i dane potrzebne do linku
`?variant=`. Przy fladze wyłączonej zachować dotychczasowe odpowiedzi.
Zakres obejmuje GWT 1–13, 18–21 oraz backendową część 22; nie zmienia
`public/recipes/{id}`, szczegółów, `search_vector`, RLS ani E2E.

## Etapy i pliki

1. **Kontrakty i wspólny model** — w `shared/contracts/types.ts` addytywnie
   rozszerzyć elementy listy (`RecipeListItemDto`, `PublicRecipeListItemDto`,
   `RecipeInCollectionDto`, `RecipeSidebarListItemDto`, `SearchRecipeDto`) o
   opcjonalne `variant_name`, `active_variant_count`,
   `matching_variant_count`, `matching_variant_names` oraz opcjonalne
   `is_default`/`sort_order` tylko tam, gdzie frontend tego wymaga. `id` nadal
   oznacza id reprezentanta. W `supabase/functions/_shared/` dodać typy i
   czystą funkcję grupowania kandydatów: dostępność, R2, R3, R6, R8,
   wykluczenie nazw technicznych z dopasowania i stabilny tie-breaker.
2. **Explore/public** — w `public.service.ts` pobierać kandydatów wariantów
   (bez treści niepotrzebnych na liście), stosować istniejące filtry osobiste,
   cech i tokenów per wariant, następnie grupować i dopiero sortować/paginować.
   Bez wyszukiwania można wykonać grupowanie w zapytaniu/RPC, ale publiczny
   limit 1000 dla wyszukiwania pozostaje limitem kandydatów przed grupowaniem.
   `totalItems` i `hasMore` liczyć po grupach; sortowanie datą bierze najnowszy
   pasujący wariant. `public.handlers.ts` pozostaje tylko walidacją i mapowaniem.
3. **Recipes/RPC** — przebudować `get_recipes_list` migracją addytywnie albo
   dodać wersję funkcji bez niejawnej zmiany sygnatury. Filtry widoczności,
   właściciela, kolekcji, cech i osobiste muszą być zastosowane do wariantów,
   a `total_count` do grup. Obsłużyć zarówno `getRecipes`, jak i
   `getRecipesFeed`: kursor zawiera i sprawdza `filtersHash`, sortowanie,
   offset po grupach oraz stabilny reprezentant. Po migracji jawnie `revoke`
   `public, anon, authenticated`, `grant` wyłącznie wymaganej roli i test
   `has_function_privilege`.
4. **Kolekcje** — w `collections.service.ts` grupować warianty zapisane w
   kolekcji przed `limit`, według R7; `totalCount`, `returned` i `truncated`
   liczyć po grupach. Reprezentant pozostaje zapisanym domyślnym albo
   pierwszym wg `sort_order`, a usunięcie przez istniejące
   `recipe_id` dotyczy wyłącznie reprezentanta. Sidebar zwraca tę samą
   jednostkę grupowania.
5. **Wyszukiwarka** — w `search.service.ts` wyszukiwać nazwę grupy i wariantu
   (techniczne nazwy wykluczone), zwrócić jeden wiersz na grupę z nazwą
   `Nazwa · wariant` dla `N >= 2` i id reprezentanta. Limit 10 liczyć po
   grupach; bez nowego rankingu. Rozszerzyć `search.types.ts` i kontrakt.
6. **Mapowanie i testy** — zaktualizować lokalne typy bazowe ręcznie tylko dla
   używanych pól; naprawić addytywnie znane typy `explore`, jeżeli dotkną
   zmienianych pól. Dodać testy `deno test` czystego grupowania oraz handlerów/
   serwisów dla GWT 1–13, 18–22: flaga, widoczność, R2–R6, nazwy techniczne,
   paginacja/kursor, kolekcje, limit wyszukiwarki i brak treści rodzeństwa.
   Uruchomić `deno lint`/`deno check` zmienionych funkcji; bez E2E.

## Kontrakt

Nowe pola są obecne wyłącznie przy aktywnej fladze; przy `disabled`/`admin`
dla nieuprawnionego użytkownika listy, liczniki i kształt odpowiedzi pozostają
jak dziś. `matching_variant_names` zawiera maksymalnie trzy nazwy, a nadmiar
jest reprezentowany przez `matching_variant_overflow` (liczba); oba pola są
opcjonalne i używane tylko, gdy aktywny filtr/wyszukiwanie daje `K < N`.
Karta zawsze dostaje dane reprezentanta, jego wskaźniki i link generowany z
jego id; API nie zwraca pełnych danych pozostałych wariantów.

## Założenia

- Grupowanie i wybór reprezentanta wykonuje backend; frontend nie deduplikuje.
- Najmniejszy bezpieczny wariant to wspólny algorytm na rekordach kandydatów
  oraz RPC dla paginacji `recipes`; osobny widok `recipe_details` nie jest
  przebudowywany pod `search_vector`.
- Explore bez wyszukiwania może przejść na grupowanie DB-level, a przy
  wyszukiwaniu zachowuje limit 1000 wariantów przed grupowaniem.
- W kolekcji licznik obejmuje zapisane warianty grupy; usunięcie nie zmienia
  znaczenia istniejącego endpointu.
- Wskaźniki osobiste i ocena dotyczą reprezentanta; filtr/sortowanie po ocenie
  nie jest dodawane. `SHARED` poza właścicielem i tryb `all` pozostają
  zablokowane zgodnie z PS-108/110.
- Jeśli istniejące RPC nie pozwoli bezpiecznie uzyskać grup przed limitem,
  powstaje nowe RPC o jawnych uprawnieniach zamiast grupowania po stronie
  klienta.

## Czynności ręczne

1. Po `supabase db reset` sprawdzić funkcję/RPC, indeks
   `recipe_family_id`, uprawnienia (`anon`/`authenticated` bez `execute`) oraz
   zgodność kopii `name`/`visibility`.
2. Ustawić flagę `admin`, przygotować grupy A/B/C i wykonać żądania Explore,
   `recipes`, feedu, kolekcji i `search`: bez filtra, po nazwie wariantu,
   filtrem osobistym/cechy, z równymi wynikami oraz z usuniętym wariantem.
   Potwierdzić N/K, reprezentanta, brak duplikatów, liczniki grup i linkowe id.
3. Sprawdzić właściciela, innego użytkownika i gościa dla `PRIVATE`, `PUBLIC`
   i `SHARED`; potwierdzić brak przecieku oraz zachowanie odpowiedzi przy
   `disabled`/`admin` dla zwykłego użytkownika.
4. Zweryfikować stronowanie 25 grup (12/12/1), kursor i kolekcję ponad limit,
   a wynik zapisać jako `PASS`, `FAIL`, `NIE_WYKONANO` albo
   `WYMAGA_WERYFIKACJI`. Nie wdrażać zdalnie.
