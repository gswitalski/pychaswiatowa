# PS-115 — plan implementacji API

## Cel i zakres

Zwracać pełne, oczyszczone nazwy pasujących wariantów w istniejących listach
grupowanych oraz ustawiać `matching_variant_overflow` na `0`. Nie dodawać
endpointu ani pola DTO. Zakres API obejmuje GWT 1–8, 12; usunięcie napisów
stanu szczegółów należy do planu widoków.

## Pliki i etapy

1. **Wspólny model i kontrakty**
   - Zaktualizować `supabase/functions/_shared/recipe-list-grouping.ts`:
     po odfiltrowaniu nazw pustych po `trim()` budować pełną listę w kolejności
     `sort_order`, następnie `id`; nie ograniczać jej do trzech elementów.
     Zachować wybór reprezentanta i `matching_variant_count`.
   - Zmienić testy `recipe-list-grouping.test.ts` oraz testy
     `public.service.test.ts` i `collections.service.test.ts`, aby sprawdzały
     pełną listę i overflow `0`.
   - Zachować pola `matching_variant_names` i
     `matching_variant_overflow` w `shared/contracts/types.ts` oraz typach
     bazowych; ich znaczenie zmieni się wyłącznie z „skrót + nadmiar” na
     „pełna lista + zawsze 0”.
2. **Lista „Moje przepisy”**
   - Dodać migrację
     `supabase/migrations/<timestamp>_ps115_full_variant_names.sql`
     przebudowującą `public.get_recipes_list` bez zmiany parametrów.
   - W podzapytaniu nazw użyć wszystkich pasujących rekordów z rodziny,
     `order by sort_order, id`, pominąć `variant_name` puste po `trim()` i
     zwrócić `greatest(..., 0)` jako `0`; limit rodziny (10) pozostaje
     istniejącym ograniczeniem domenowym.
   - Zachować filtrowanie widoczności, kolekcji, wyszukiwania, flagi,
     paginację po grupach, `?variant=` przez id reprezentanta oraz pozostałe
     kolumny odpowiedzi. `recipes.service.ts` nadal mapuje pola addytywnie.
3. **Eksploruj, wyniki publiczne i kolekcje**
   - W `public.service.ts` i `collections.service.ts` użyć wspólnego
     grupowania po zastosowaniu istniejących filtrów. Zastąpić każde
     `.slice(0, 3)`/wyliczenie overflow pełną listą nazw w kolejności rodziny.
   - Nie zmieniać list bocznych, omniboxu, wyszukiwania poza źródłem danych
     wspólnej karty ani etykiet `Nazwa · wariant` reprezentanta.
4. **Warstwa typów i mapowania**
   - Zaktualizować lokalne typy funkcji oraz mapowania w
     `recipes.service.ts`, `public.service.ts`, `collections.types.ts` i
     `shared/contracts/types.ts` tylko jeśli kompilator wymaga zmian.
   - Nie usuwać `matching_variant_count`, `in_plan`, `my_rating` ani żadnego
     pola akcji osobistych z odpowiedzi.

## Endpointy, role i błędy

Nie powstaje nowy endpoint. Zmieniane odpowiedzi obsługują istniejące:

- `GET /functions/v1/recipes` — użytkownik zalogowany; przez
  `get_recipes_list` działa wyłącznie `service_role`.
- `GET /functions/v1/public/recipes` oraz feed — gość lub zalogowany, tylko
  przepisy publiczne.
- `GET /functions/v1/collections/{id}/recipes` — właściciel kolekcji.
- `GET /functions/v1/search/global` — zgodnie z dotychczasową autoryzacją.

Walidacja Zod, JWT i własność pozostają bez zmian; rola pochodzi z
`app_metadata.app_role`. Nie wprowadzać nowych kodów. Utrzymać istniejące
mapowanie: 200 sukces, 400 nieprawidłowe parametry, 401 brak uwierzytelnienia,
403 brak dostępu, 404 brak zasobu, 500 błąd RPC/serwera; 201/204/402/409/422
nie dotyczą tej zmiany.

## Migracja, RPC i uprawnienia

Migracja ma odtworzyć aktualną sygnaturę `get_recipes_list`, wykonać
`revoke all ... from public, anon, authenticated`, przyznać `execute`
wyłącznie `service_role` i zachować kontrolę `has_function_privilege`.
Nie dodawać RLS ani nowych tabel. Po migracji wygenerować typy Supabase i
sprawdzić zgodność obu kopii `database.types.ts`.

## Testy i weryfikacja

- `deno test supabase/functions/_shared/recipe-list-grouping.test.ts`
  — GWT 1, 3, 4, 5, 7, 8, 12: dwa/cztery warianty, filtr, techniczna nazwa,
  puste nazwy, kolejność rodziny, pełna lista i overflow `0`.
- Testy usług `public`, `collections` i `recipes` — GWT 6–8, 12:
  kolekcja zawiera tylko zapisane warianty, wspólna karta na wszystkich
  listach, zachowanie stanów i flagi.
- Test migracji/RPC — GWT 12: kolejność `sort_order,id`, limit 10,
  brak `execute` dla `anon`/`authenticated`, `service_role` ma dostęp.
- Uruchomić `deno lint` i `deno check` dla zmienionych funkcji oraz
  `supabase db reset`/migracje lokalnie. Bez E2E.

## Założenia

- „Pełna lista” oznacza wszystkie nazwy po `trim()` niepuste, maksymalnie do
  limitu rodziny 10; nazw technicznych nie wyklucza się z wyświetlania.
- `matching_variant_count` i dane reprezentanta pozostają kompatybilne,
  choć karta nie renderuje już licznika.
- Brak nazw po oczyszczeniu nie tworzy wiersza w UI, ale nie zmienia linku
  ani reprezentanta.
- Nie zmienia się struktura odpowiedzi, routing, RLS tabel ani kody błędów.

## Czynności ręczne

1. Uruchomić lokalny Supabase, wykonać `supabase db reset` i potwierdzić,
   że migracja tworzy `get_recipes_list`, a `anon` i `authenticated` nie
   mają `execute`; `service_role` ma `execute`.
2. Włączyć flagę wariantów dla administratora i przygotować rodzinę z
   1, 2, 4 oraz 11 wariantami, w tym nazwą techniczną i nazwą pustą po
   `trim()`. Wykonać żądania listy „Moje przepisy” bez filtra i z filtrem
   wariantu.
3. Potwierdzić `matching_variant_names` w kolejności `sort_order, id`,
   pełną listę do 10 nazw oraz `matching_variant_overflow: 0`; przy jednym
   wariancie brak danych powodujących wiersz.
4. Powtórzyć sprawdzenie w Eksploruj, wynikach publicznych i kolekcji,
   gdzie kolekcja zawiera tylko część rodziny. Potwierdzić brak duplikatów,
   zachowanie reprezentanta i istniejącego id `?variant=`.
5. Sprawdzić flagę wyłączoną/admin dla nieuprawnionego użytkownika, gościa,
   `PRIVATE`, `SHARED` i `PUBLIC`; potwierdzić brak przecieku wariantów.
6. Zweryfikować pustą listę, błąd RPC i paginację po grupach. Wynik zapisać
   jako `PASS`, `FAIL`, `NIE_WYKONANO` albo `WYMAGA_WERYFIKACJI`. Nie
   wdrażać zdalnie.
