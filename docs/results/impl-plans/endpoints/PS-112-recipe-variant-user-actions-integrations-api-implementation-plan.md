# PS-112 — plan implementacji API

## Cel i granice

Zapewnić, że akcje operacyjne są wykonywane na konkretnym `recipe_id`, dodać
stan użytkownika per wariant na szczegółach, poprawić plan/zakupy/usuwanie oraz
rozróżnić warianty w panelu administratora. Zakres obejmuje GWT 1–4, 6–23;
nie zmienia flagi na `all`, dostępu `SHARED` po linku, RLS `recipes`, nowych
limitów ani E2E.

## Rozstrzygnięcia i kontrakt

1. **Dostępność planu:** aktywny wariant własny lub aktywny wariant grupy
   `PUBLIC`. `getPlan`, `checkFreePlanLimit` i trigger limitu 50 stosują tę
   samą regułę. Niedostępne wiersze zostają w `plan_recipes`, lecz są ukryte i
   nie liczą się do limitu.
2. **Stan per wariant:** rozszerzyć addytywnie `RecipeDetailDto` o opcjonalne
   `user_action_state` w każdym `RecipeVariantSummaryDto` odpowiedzi
   `GET /recipes/{id}` i `GET /explore/recipes/{id}`. Stan zawiera tylko
   `is_favorite`, `wants_to_try`, `in_plan`, `in_collection`, `has_note`,
   `my_rating`; dla gościa, wyłączonej flagi i cudzych danych osobistych jest
   pominięty. Odczyt ograniczyć do maksymalnie 10 aktywnych, dostępnych
   wariantów i bieżącego użytkownika.
3. **Oznaczenie:** DTO planu, kolekcji i pozycji `RECIPE` zachowują
   `recipe_id`, a backend zwraca `variant_name`, `active_variant_count` oraz
   `display_name` tylko jako pole pomocnicze; frontend buduje `Nazwa · wariant`
   wyłącznie dla `active_variant_count >= 2`.
4. **RPC admina:** dodać wersje `admin_get_recipes_page_v2` i
   `admin_get_users_page_v2` albo równoważne nowe sygnatury, bez zmiany
   istniejących przeciążeń. Pierwsza zwraca wiersz wariantu, nazwę wariantu i
   `total_items`; druga `recipes_count` jako grupy oraz `variants_count`.
   Sortowanie użytkowników po `recipes_count` pozostaje sortowaniem po grupach.
5. **Czyszczenie:** jeden prywatny helper SQL wykonywany w transakcji usuwa
   operacyjne wpisy właściciela: `plan_recipes`, `recipe_collections`,
   `shopping_list_items` typu `RECIPE`, `shopping_list_recipe_contributions`
   i powiązane joby normalizacji. `delete_recipe_variant` używa go dla jednego
   wariantu, `delete_recipe_family` dla wszystkich, a ręczne RPC planu dla
   jednego `auth.uid()`. Oceny, flagi i notatki nie są usuwane.

## Etapy i pliki

1. **Kontrakty i wspólne mapowanie** — rozszerzyć
   `shared/contracts/types.ts` o stan akcji, pola planu, kolekcji, zakupów i
   admina. Uzupełnić lokalne typy bazy ręcznie/addytywnie; nie regenerować
   globalnie `database.types.ts`.
2. **Szczegóły i akcje użytkownika** — w
   `supabase/functions/_shared/recipe-variant-detail.ts` dodać bezpieczne
   zapytanie stanu zalogowanego użytkownika, a w `recipes`/`explore` mapować je
   do istniejących podsumowań. Zweryfikować endpointy kolekcji, ulubionych,
   „chcę wypróbować”, ocen i notatek: wejściem i kluczem pozostaje wybrany
   `recipe_id`; nie kopiować stanu grupowego.
3. **Plan i limit** — zmienić `checkFreePlanLimit` i `getPlan` w
   `supabase/functions/plan/plan.service.ts`; atomowe dodanie nadal odbywa się
   przez RPC. Migracja przebudowuje trigger 50 oraz RPC tak, by sprawdzały
   dostępność wariantu i nie usuwały grandfathered rows.
4. **Zakupy i normalizacja** — rozszerzyć select/mapowanie
   `shopping-list.service.ts` o `variant_name` i licznik aktywnych wariantów.
   Wspólny helper usuwa po `recipe_id`, a generowanie/łączenie składników
   pozostaje per wariant; import, AI i ścieżki obrazu dostają testy regresyjne,
   bez zmian jeśli już spełniają R7.
5. **Usuwanie i ostrzeżenie** — w migracji poprawić `recipe_variant_usage`:
   liczby planu, kolekcji i `shopping_list_items` tylko dla wskazanego
   wariantu; usuwanie rodziny agreguje wszystkie warianty. Zachować ukrywanie
   wpisów innych użytkowników i synchronizację soft delete.
6. **Admin** — dodać migrację nowych RPC z `revoke all` dla
   `public, anon, authenticated`, `grant` dla `service_role` i asercje
   `has_function_privilege`. Rozszerzyć `admin-recipes.service.ts`,
   `admin.service.ts` oraz typy o nazwę wariantu, `variants_count` i grupowy
   licznik; sortowanie/paginacja przepisów nadal odbywa się po wierszach
   wariantów.
7. **Testy** — `deno test` dla GWT 1–4, 6–18, 19–23: stan bez wycieku, akcje
   per id, dostępność limitu, wyścig dodawania, trigger 50, czyszczenie,
   osierocone zakupy, ukrycie cudzych wpisów, import/AI/obrazy/normalizacja,
   RPC admina i uprawnienia. Uruchomić `deno lint` oraz `deno check` zmienionych
   funkcji; bez E2E.

## Założenia planu

- Flaga działa jak w PS-109–111; nowe pola są pomijane przy wyłączeniu.
- `PUBLIC` jest jedyną widocznością cudzych wpisów, zgodnie z obecnym brakiem
  dostępu `SHARED` po linku.
- Limit Free pozostaje wartością `PLAN_LIMIT_FREE`; limit 50 jest tylko
  technicznym bezpiecznikiem i nie zmienia komunikatu biznesowego.
- Helper SQL nie wykonuje czyszczenia w tle i nie przywraca danych po zmianie
  widoczności; wpis wraca, gdy wariant znów spełnia regułę dostępności.
- Weryfikacja importu, AI, obrazów i normalizacji kończy się testem oraz
  wpisem w weryfikacji; naprawa jest częścią PS-112 tylko przy wykrytej
  rozbieżności.

## Czynności ręczne

1. Po `supabase db reset` sprawdzić sygnatury RPC, `has_function_privilege`,
   trigger limitu 50, indeksy po `recipe_id`/`recipe_family_id` i brak execute
   dla `anon`/`authenticated` tam, gdzie wymagany jest `service_role`.
2. Przy fladze `admin` przygotować A/B/C: różne akcje użytkownika, dwa warianty
   w planie, różne składniki i wpisy w kolekcji. Sprawdzić odpowiedzi obu
   szczegółów, planu, zakupów i kolekcji oraz `Nazwa · wariant`.
3. Dla Free z 7 wpisami, w tym niedostępnymi, sprawdzić możliwość dodania
   brakujących slotów, powrót wpisów po zmianie widoczności i równoległe
   dodania. Zweryfikować, że trigger 50 nie blokuje prawidłowego przypadku.
4. Usunąć wariant, potem rodzinę; potwierdzić zakres ostrzeżenia, brak
   osieroconych `shopping_list_items`, pozostawienie ocen/flag/notatek oraz
   niezmienione wpisy innego użytkownika.
5. W panelu admina sprawdzić dwa wiersze wariantów, link z `?variant=`,
   `recipes_count` jako grupy, tekst liczby wariantów, paginację i sortowanie.
   Wynik zapisać jako `PASS`, `FAIL`, `NIE_WYKONANO` albo
   `WYMAGA_WERYFIKACJI`; nie wdrażać zdalnie.
