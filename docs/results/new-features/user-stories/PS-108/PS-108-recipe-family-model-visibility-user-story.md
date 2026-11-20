# PS-108: Model grupy przepisu, migracja i widoczność (fundament wariantów przepisów)

## Opis

Jako **zespół produktowy PychaŚwiatowa**,
chcę **wprowadzić w bazie i backendzie „grupę przepisu” (rodzinę) oraz powiązać z nią każdy istniejący przepis jako grupę z jednym wariantem**,
aby **kolejne historyjki mogły dodać warianty przepisów, a użytkownicy po tej zmianie nie zauważyli żadnej różnicy w działaniu aplikacji**.

Źródło: `docs/variants-conception.md`, wyłącznie „Historyjka 1 — Model grupy, migracja i widoczność”.
Historyjki 2–5 (zarządzanie wariantami, przełącznik, grupowanie list, działania na wariancie i integracje) są **poza zakresem**.

---

## Kontekst

### Stan obecny (zweryfikowany w kodzie)

- `recipes` ma soft delete (`deleted_at`) i widoczność `recipe_visibility` (`PRIVATE`, `SHARED`, `PUBLIC`).
  Nazwa przepisu to `recipes.name`; **nie ma** pojęcia grupy ani wariantu.
- **RLS na `recipes` jest wyłączony** migracją `20251125121000_disable_rls_for_development.sql` (polityki z
  `20260210153000_update_public_recipe_collection_rls.sql` istnieją, ale nie działają bez włączonego RLS na tabeli).
  Widok `recipe_details` nie ma `security_invoker`. Widoczność przepisów egzekwuje więc dziś **backend**
  (Edge Functions) i logika zapytań, nie baza.
- `SHARED` jest przechowywane, ale **nie ma obsługi dostępu po linku**; `SHARED` zachowuje się dziś jak
  niepubliczne (poza Explore/wyszukiwaniem publicznym).
- Wyszukiwanie korzysta z `ilike` na `recipes.name` oraz kolumny `recipes.search_vector` (GIN).
- Tworzenie/edycja: RPC `create_recipe_with_tags` / `update_recipe_with_tags` (`security definer`, bez `revoke`).
- Tabele działań użytkownika (oceny, flagi, notatki, plan, kolekcje, lista zakupów, joby normalizacji) są
  kluczowane po `recipes.id`.

---

## Zakres

### W zakresie

- Nowa tabela grup (`recipe_families`; nazwa robocza): identyfikator, właściciel, **nazwa** i **widoczność**
  (źródła prawdy), `deleted_at`, `created_at`, `updated_at`; unikalność `(id, user_id)`.
- Nowe kolumny w `recipes`: `recipe_family_id` (`NOT NULL`, klucz złożony `(id, user_id)`), `variant_name`
  (`NOT NULL`), `is_default`, `sort_order`; indeks po `recipe_family_id`.
- Migracja danych: każdy obecny przepis (także usunięty, każda widoczność) trafia do własnej grupy
  z wariantem „Podstawowa”, `is_default = true`, `sort_order = 0`.
- Reguły w bazie: jeden aktywny wariant domyślny w grupie; unikalna nazwa wariantu w grupie (bez rozróżniania
  wielkości liter, tylko aktywne); wariant nie może należeć do cudzej grupy.
- `recipes.name` i `recipes.visibility` pozostają **kopiami** wartości grupy, ustawianymi wyłącznie przez backend
  (trigger/RPC); bezpośredni rozjazd jest odrzucany.
- Dostosowanie istniejących ścieżek zapisu (tworzenie, edycja nazwy/widoczności, soft delete — w tym AI i import
  z URL), aby każdy przepis miał grupę, a nazwa/widoczność/usunięcie były z nią spójne.
- RLS **tylko dla nowej tabeli grup** oraz `revoke`/`grant` nowych funkcji `security definer`.
- Typy bazy i kontrakty (`shared/contracts/types.ts`) zmieniane wyłącznie **addytywnie**.
- Testy jednostkowe (`deno test`; Vitest tylko dla zmienionych modeli/serwisów frontendu).

### Poza zakresem

- UI wariantów i operacje na wariantach (tworzenie, kopiowanie, usuwanie, domyślny, kolejność) oraz zmiana
  nazwy/widoczności grupy jako osobna operacja użytkownika (Historyjki 2–3); limit 10 wariantów (Historyjka 2).
- Grupowanie list, `total`/paginacja po grupach, reprezentant wyniku (Historyjka 4).
- Działania użytkownika na wariancie, plan Free, lista zakupów, import/AI/obrazy ponad dzisiejsze zachowanie,
  panel administracyjny (Historyjka 5).
- **Zmiana `search_vector` i wyszukiwania** (nazwa grupy + wariantu w wektorze) — odłożone do Historyjki 4.
- **Włączenie RLS na `recipes`** oraz `security_invoker` na `recipe_details` (patrz „Warunek przed włączeniem flagi”).
- Obsługa dostępu do `SHARED` po linku (rozbieżność z koncepcją, sekcja „Decyzje i założenia”).
- Flaga funkcji wariantów i jej mechanizm; przywracanie usuniętych grup.

### Zależności

- Brak zależności od innych historyjek; jest **fundamentem** Historyjek 2–5. Po wdrożeniu PS-108 samego
  funkcja wariantów jest nieosiągalna dla użytkownika (żaden endpoint nie tworzy drugiego wariantu).

---

## Reguły

- **R1.** Każdy przepis (`recipes`) należy do dokładnie jednej grupy tego samego właściciela; identyfikator przepisu
  (`recipes.id`) i adresy `/recipes/{id}` nie zmieniają się ani znaczenia.
- **R2.** Źródłem prawdy dla nazwy i widoczności jest grupa; `recipes.name` = `family.name` oraz
  `recipes.visibility` = `family.visibility` dla każdego wariantu w każdej chwili.
- **R3.** Grupa usunięta ⇒ wszystkie jej warianty mają `deleted_at`; usunięcie ostatniego aktywnego wariantu
  usuwa grupę. W PS-108 usunięcie przepisu = usunięcie grupy.
- **R4.** Widoczność wariantu wynika wyłącznie z grupy; wariant nie ma własnej.
- **R5.** Tabela grup nie ujawnia nazwy ani istnienia grupy `PRIVATE`/`SHARED`/usuniętej nikomu poza właścicielem
  (przez PostgREST/klienta Supabase).
- **R6.** Wszystkie nowe lub przebudowane funkcje `security definer` mają jawny `revoke` dla
  `public/anon/authenticated` i `grant` tylko dla roli, która ma je wywoływać; po migracji sprawdzane przez
  `has_function_privilege`.
- **R7.** Zachowanie dla przepisów z jednym wariantem (wszystkich w PS-108) jest **identyczne** jak przed migracją.

---

## Kryteria akceptacji (Given-When-Then)

### Migracja danych

1. **Backfill grup.** *Given* baza z przepisami `PRIVATE`, `SHARED`, `PUBLIC`, aktywnymi i usuniętymi, *When*
   migracja zostanie zastosowana, *Then* liczba grup = liczbie przepisów; każda grupa ma `user_id`, `name`,
   `visibility`, `deleted_at` i `created_at` skopiowane z przepisu, a przepis ma `recipe_family_id`,
   `variant_name = 'Podstawowa'`, `is_default = true`, `sort_order = 0`.
2. **Brak utraty i zmian identyfikatorów.** *Given* te same dane, *When* migracja się zakończy, *Then* `recipes.id`
   oraz wszystkie rekordy zależne (oceny, flagi, notatki, plan, kolekcje, lista zakupów, tagi, joby normalizacji)
   są nietknięte, a `recipe_family_id` i `variant_name` nie mają wartości `NULL`.
3. **Pusta baza i transakcyjność.** *Given* baza bez przepisów lub po `db reset`, *When* migracja zostanie
   zastosowana, *Then* kończy się bez błędu; błąd w połowie nie zostawia częściowo wypełnionych kolumn.

### Spójność i integralność modelu

4. **Wariant domyślny.** *Given* grupa z aktywnymi wariantami, *When* próbuje się zapisać drugi aktywny wariant
   domyślny lub grupę aktywną bez domyślnego (w tym przez dodatkowe wstawienie w teście bazy), *Then* baza
   odrzuca operację; usunięte warianty nie są liczone.
5. **Nazwa wariantu.** *Given* grupa z wariantem „Klasyczna”, *When* wstawiany jest aktywny wariant „klasyczna”
   (inna wielkość liter), *Then* operacja jest odrzucona; ta sama nazwa w innej grupie lub dla usuniętego wariantu
   jest dozwolona.
6. **Właściciel grupy = właściciel wariantu.** *Given* grupa użytkownika A, *When* ktoś próbuje wstawić/zmienić
   przepis użytkownika B z `recipe_family_id` tej grupy, *Then* klucz złożony `(id, user_id)` odrzuca operację.
7. **Kopie nazwy i widoczności.** *Given* wariant, *When* wykonywany jest bezpośredni `UPDATE` ustawiający
   `recipes.name` lub `recipes.visibility` na wartość różną od grupy, *Then* operacja jest odrzucona; zmiana
   wykonana przez operację grupową/backend ustawia grupę i kopie jednocześnie.

### Ścieżki zapisu (zgodność z dzisiejszym zachowaniem)

8. **Tworzenie przepisu.** *Given* zalogowany użytkownik, *When* utworzy przepis (formularz, zapis szkicu AI,
   import z URL), *Then* w jednej transakcji powstają grupa i przepis (`Podstawowa`, domyślny, `sort_order = 0`,
   nazwa i widoczność zgodne); odpowiedź API ma ten sam kształt co dziś; błąd walidacji lub zapisu nie zostawia
   osieroconej grupy.
9. **Zmiana nazwy.** *Given* istniejący przepis, *When* użytkownik zmieni jego nazwę dotychczasową ścieżką edycji,
   *Then* zmienia się nazwa grupy i kopia `recipes.name`; widoki, plan, lista zakupów i panel admina pokazują nową
   nazwę bez zmian w kodzie klienta.
10. **Zmiana widoczności.** *Given* istniejący przepis, *When* użytkownik zmieni widoczność dotychczasową ścieżką,
    *Then* zmienia się widoczność grupy i kopia `recipes.visibility`; zachowanie list (Explore, wyszukiwanie,
    „Moje przepisy”, widoki publiczne) jest takie jak dziś dla nowej wartości.
11. **Soft delete.** *Given* przepis (jedyny wariant), *When* zostanie usunięty dotychczasową ścieżką, *Then* `deleted_at`
    ma przepis i grupa (R3); nie pojawia się na żadnej liście, w wyszukiwaniu ani przy dostępie po ID — dokładnie jak
    dziś. Zachowanie wpisów innych użytkowników (plan, kolekcje) po usunięciu publicznego przepisu jest bez zmian.
12. **Ścieżki bez grupy.** *Given* dowolna inna ścieżka wstawiania do `recipes` niepodająca grupy (np. skrypt,
    test, stary kod), *When* wstawia przepis, *Then* przepis albo dostaje automatycznie grupę 1:1, albo operacja
    jest odrzucona — nigdy nie powstaje przepis bez grupy.

### Widoczność i bezpieczeństwo

13. **`PRIVATE`.** *Given* przepis `PRIVATE` użytkownika A, *When* użytkownik B lub gość próbuje go odczytać
    (lista, wyszukiwanie, Explore, dostęp po ID, endpoint publiczny, bezpośrednie zapytanie do tabeli grup),
    *Then* nie dostaje danych przepisu ani nazwy grupy; właściciel widzi go jak dziś.
14. **`PUBLIC`.** *Given* przepis `PUBLIC` aktywny, *When* odczytuje go dowolny użytkownik lub gość, *Then*
    widzi go w Explore, wyszukiwaniu i widoku publicznym jak dziś; przepis usunięty (R3) jest niewidoczny.
15. **`SHARED`.** *Given* przepis `SHARED`, *When* odczytuje go ktoś inny niż właściciel, *Then* zachowanie jest takie
    jak dziś (bez dostępu po linku); widoczność `SHARED` jest przechowywana w grupie i kopiowana na wariant.
16. **RLS tabeli grup.** *Given* włączony RLS na tabeli grup, *When* role `anon`/`authenticated` wykonają zapytania,
    *Then*: właściciel czyta własne grupy; wszyscy czytają wyłącznie aktywne grupy `PUBLIC`; `INSERT`/`UPDATE`/
    `DELETE` z ról `anon`/`authenticated` są niemożliwe (zapisy tylko przez backend/RPC/triggery).
17. **Uprawnienia funkcji.** *Given* nowe/przebudowane funkcje `security definer`, *When* sprawdzone zostaną
    uprawnienia po migracji, *Then* `public/anon/authenticated` nie mają `EXECUTE` tam, gdzie nie powinny
    (R6); przebudowane `create_recipe_with_tags`/`update_recipe_with_tags` zachowują dotychczasowy sposób wywołania
    (aplikacja działa bez zmian).

### Zgodność wsteczna

18. **Brak zmian dla użytkownika.** *Given* aplikacja po migracji, *When* użytkownik korzysta z przepisów, list,
    wyszukiwania, Explore, kolekcji, planu, listy zakupów, ocen, notatek, ulubionych i panelu admina, *Then* widzi
    te same dane i komunikaty co przed migracją (R7); `/recipes/{id}` działa bez zmian.
19. **Widok `recipe_details` i wyszukiwanie.** *Given* widok `recipe_details`, *When* odpytany jak dotychczas, *Then*
    zwraca te same wiersze i kolumny (nowe kolumny wyłącznie addytywne); `search_vector` i wyniki wyszukiwania są
    **niezmienione** (nazwa grupy/wariantu nie wchodzi do wektora w PS-108).
20. **Kontrakty i typy.** *Given* zaktualizowane `shared/contracts/types.ts` i typy bazy, *When* zbudowane zostaną
    frontend i Edge Functions, *Then* kompilują się bez zmian w kodzie klienta; nowe pola grupy są opcjonalne.

---

## Przypadki brzegowe

- **Przepisy usunięte** dostają grupę z `deleted_at` i nie wpływają na unikalność (dotyczy tylko aktywnych).
- **Nazwa:** ograniczenia nazwy grupy są takie same jak dzisiejsze `recipes.name`.
- **Współbieżna edycja/usunięcie** tego samego przepisu: wynik spójny (R2, R3); ostatni zapis wygrywa jak dziś.
- **Rollback aplikacji** (stary kod, nowa baza): stare ścieżki wstawiania tworzą spójne dane (kryterium 12).
- **Drugi wariant w grupie** (tylko w testach bazy): reguły 4–7 działają, ale żaden endpoint go nie tworzy ani
  nie pokazuje; zachowanie list przy >1 wariancie to Historyjka 4.

---

## Decyzje i założenia

### Decyzje użytkownika (rekomendowane warianty)

1. **RLS — opcja B:** RLS tylko dla nowej tabeli grup; widoczność wariantów egzekwuje backend i triggery. RLS na
   `recipes` i `security_invoker` na `recipe_details` są poza zakresem (zob. warunek niżej).
2. **Wektor wyszukiwania — opcja B:** bez zmiany `search_vector` w PS-108; odłożone do Historyjki 4.
   **Odejście od koncepcji (sekcja 6, Historyjka 1):** koncepcja każe rozszerzyć wektor o nazwę grupy i wariantu.
3. **`SHARED` — opcja A:** zachowanie bez zmian; widoczność w grupie i kopiowana na warianty; dostęp po linku
   poza zakresem. **Rozbieżność z koncepcją** (sekcja 5, „RLS i widoczność”: `SHARED` dostępne po linku) —
   do rozwiązania w osobnej historyjce.

### Założenia (do potwierdzenia przy planowaniu)

- Wpisy innych użytkowników (plan, kolekcje) po usunięciu publicznego przepisu — jak dziś (bez zmian).
- Limit wariantów w grupie (10) jest egzekwowany w Historyjce 2, nie tu.
- Brak osobnego triggera odświeżania wektora (wektor nie zmienia się w PS-108).
- Mechanizm spójności (trigger vs. RPC) wybiera plan API; wymagania to kryteria 7–12. Nazwy robocze.
- Przepis bez podanej grupy (kryterium 12): preferowany trigger tworzący grupę 1:1; alternatywa — odrzucenie.
- Przebudowane `create_recipe_with_tags`/`update_recipe_with_tags` zachowują dotychczasowe uprawnienia
  wywołania; luka „`security definer` bez `revoke`” jest odnotowana w warunku poniżej.
- Brak zmian UI.

### Warunek przed włączeniem flagi wariantów (osobna historyjka/zadanie)

Przed włączeniem funkcji wariantów użytkownikom **muszą być spełnione** (nie wchodzą w PS-108):
(a) RLS na `recipes` włączony i przetestowany **albo** udokumentowana, przetestowana egzekucja widoczności wariantów
w backendzie dla każdej ścieżki odczytu (listy, wyszukiwanie, dostęp po ID, widoki publiczne, plan, kolekcje);
(b) `security_invoker` na `recipe_details` (lub równoważne zabezpieczenie widoku);
(c) decyzja o `SHARED` po linku;
(d) `revoke` dla istniejących RPC `security definer`.
Dziś backend jest jedynym strażnikiem widoczności.

### Uwagi weryfikacyjne

- `select relname, relrowsecurity from pg_class where relname in ('recipes','recipe_families')` — oczekiwane:
  `recipes` `false` (znany stan, nie regresja), `recipe_families` `true`.
- `select reloptions from pg_class where relname = 'recipe_details'` — brak `security_invoker` (znany stan);
  zapisać wynik w weryfikacji.
- `has_function_privilege` dla nowych funkcji (R6) oraz test zapytań z ról `anon`/`authenticated`.

### Otwarte kwestie

1. Skontrolować dane przed migracją (przepisy z osieroconym `user_id`, nietypowe nazwy).
2. Czy `revoke` dla istniejących RPC wymaga zmiany wywołań (klient użytkownika vs. `service_role`).

---

## Definition of Done

- Migracja(e) w `supabase/migrations/`: tabela grup z RLS, kolumny wariantu, backfill, ograniczenia i indeks,
  triggery/funkcje z `revoke`/`grant` i kontrolą `has_function_privilege`; migracja przechodzi na lokalnej bazie
  (`db reset`) i na kopii danych z wszystkimi widocznościami i soft delete.
- Ścieżki tworzenia, edycji nazwy/widoczności i soft delete (w tym AI i import) utrzymują spójność grupy (kryteria 8–12).
- Kontrakty i typy bazy zaktualizowane addytywnie; frontend i Edge Functions kompilują się bez zmian zachowania.
- Testy jednostkowe: `deno test` (serwisy/handlery zmienionych funkcji, mapowanie nowych pól) oraz Vitest tylko dla
  zmienionych modeli/serwisów frontendu; testy bazy wykonywane jako zapytania weryfikacyjne na lokalnej bazie
  (kryteria 1–7, 13–17). Bez E2E.
- `ng lint`, `ng build`, `deno lint`/`deno check` dla zmienionych funkcji przechodzą bez błędów.
- Weryfikacja ręczna: smoke tworzenia/edycji/usuwania, list, Explore, wyszukiwania i widoku publicznego na
  lokalnej bazie; wyniki `rowsecurity`/`security_invoker` zapisane; status `PASS`/`FAIL`/`NIE_WYKONANO`/
  `WYMAGA_WERYFIKACJI`.
- `project-summary.md` (wiersz PS-108) na etapie summary; `project-reference.md` odświeżony generatorem.

---

## Historia zmian

| Data | Etap | Zmiana | Powód |
|------|------|--------|-------|
