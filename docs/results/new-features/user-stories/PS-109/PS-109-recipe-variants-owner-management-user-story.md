# PS-109: Zarządzanie wariantami przepisu przez właściciela (backend, flaga funkcji, ekran „Warianty”)

## Opis

Jako **właściciel przepisu**,
chcę **tworzyć warianty (pusty lub kopię), edytować je, ustawiać domyślny i kolejność, zmieniać nazwę i widoczność grupy oraz usuwać warianty lub grupę**,
aby **zbudować pełną grupę (np. „Lasagne” — klasyczna i wegetariańska) bez ręcznego tworzenia niezależnych przepisów**.

Źródło: `docs/variants-conception.md`, „Historyjka 2 — Zarządzanie wariantami przez właściciela” (z blokiem
„Dodatkowo (z sekcji 8)”). Historyjki 3–5 są poza zakresem.

---

## Kontekst (stan obecny, sprawdzony w kodzie i migracjach PS-108)

- PS-108: grupa `recipe_families` (nazwa i widoczność = źródła prawdy), kolumny wariantu w `recipes`; każdy przepis
  ma grupę 1:1, a żaden endpoint nie tworzy drugiego wariantu. Triggery bazy pilnują jednego domyślnego wariantu,
  unikalności nazwy wariantu (bez wielkości liter, tylko aktywne), właściciela i kopii `name`/`visibility`/`deleted_at`.
  **Limitu wariantów w bazie nie ma.**
- Edge Function `recipes` używa klienta anon z JWT. `create_recipe_with_tags` i `update_recipe_with_tags`
  (`security definer`) biorą `p_user_id` od wywołującego, a `authenticated` ma `EXECUTE` — **zalogowany użytkownik
  może wywołać je z cudzym `p_user_id`**. `soft_delete_recipe` używa `auth.uid()` i usuwa całą grupę.
- **Mechanizmu flag funkcji nie ma** (są tylko `app_role` z JWT i uprawnienia w `/me`).
- Zdjęcie: `recipe-images/{userId}/{recipeId}/cover_{ts}.{ext}`, zapis robi Edge Function (poza transakcją bazy).
- UI: `recipe-form-page` (`:id/edit`) i `recipe-detail-page` bez sekcji wariantów (przełącznik to H3).

---

## Zakres

### W zakresie

1. **Flaga funkcji.** Tabela flag w bazie (nazwy robocze), tryby `wyłączona` / `tylko admin` / `wszyscy`, zmiana SQL-em
   lub migracją (bez panelu); stan domyślny po migracji: **wyłączona**. `/me` zwraca stan flagi dla zalogowanego.
   Backend odrzuca nowe endpointy, gdy flaga jest wyłączona dla użytkownika; UI ukrywa sekcję „Warianty”.
2. **Operacje właściciela** (nowe endpointy i kontrakty; obecnych nie zmieniamy znaczeniowo): utworzenie wariantu
   pustego lub kopii (kopia wspólnych treści jednorazowa; zdjęcie jako osobny plik), edycja wariantu (dane —
   dotychczasowe `PUT /recipes/{id}`; nazwa wariantu — osobna operacja), zmiana nazwy i widoczności grupy, zmiana
   wariantu domyślnego i kolejności, usunięcie wariantu i grupy z odczytem „użycia” przed usunięciem (plan, kolekcje,
   lista zakupów), lista wariantów grupy właściciela (id, nazwa, domyślny, kolejność, miniatura, chipy cech z
   `diet_type`, `is_termorobot`, `is_grill`, `difficulty`, `servings`).
3. **Reguły w backendzie:** limit **10 aktywnych wariantów** w grupie, mapowanie błędów unikalności, ochrona ostatniego
   wariantu.
4. **Domknięcie uprawnień RPC:** nowe RPC tylko dla `service_role`; `EXECUTE` odebrane `authenticated` w
   `create_recipe_with_tags`, `update_recipe_with_tags`, `soft_delete_recipe`; `recipes.service` (także import i AI)
   przechodzi na klienta serwisowego, a Edge Function weryfikuje JWT i własność. `soft_delete_recipe` dostaje jawny
   parametr użytkownika (przy `service_role` `auth.uid()` jest puste).
5. **UI:** sekcja „Warianty” przy edycji przepisu (lista, dodaj pusty/kopia, edytuj, domyślny, kolejność, usuń, nazwa
   i widoczność grupy, ostrzeżenie o użyciu), widoczna tylko przy włączonej fladze.
6. Kontrakty i typy bazy **addytywnie**; testy jednostkowe.

### Poza zakresem

- **`SHARED` po linku** (decyzja: osobna historyjka, np. z H3) — `SHARED` działa jak dziś.
- Przełącznik wariantów i `?variant=` (H3); grupowanie list, wyszukiwanie po `variant_name`, `search_vector`,
  `total`/paginacja po grupach (H4); działania użytkownika na wariancie, plan Free, import/AI ponad dzisiejsze
  zachowanie, panel admina (H5). Do czasu H4 warianty `PUBLIC` mogą wyglądać na listach jak osobne przepisy — stąd
  flaga wyłączona dla zwykłych użytkowników.
- **RLS na `recipes`** i `security_invoker` na `recipe_details` (warunki z PS-108) — nadal blokują tryb `wszyscy`.
- Panel flag, flagi per użytkownik, limit zależny od planu, przywracanie, dołączanie/odłączanie przepisów, warianty
  z AI, zmiana wektora wyszukiwania, E2E.

### Zależności

**PS-108** (model grupy i wariantu, triggery) — wymagana. Włączenie flagi dla wszystkich wymaga też H3–H5 i
osobnej historyjki RLS/`SHARED`.

---

## Reguły

- **R1.** Istniejące endpointy działają jak po PS-108 niezależnie od flagi; nowe — tylko przy fladze włączonej dla
  użytkownika.
- **R2.** Edge Function sprawdza własność grupy **i** wariantu w kodzie (baza dodatkowo kluczem `(id, user_id)`).
- **R3.** Grupa ma 1–10 aktywnych wariantów, jeden domyślny, unikalne nazwy. Limit egzekwuje backend pod blokadą
  wiersza grupy; triggery PS-108 są ostatnią linią obrony.
- **R4.** Widoczność należy do grupy; nowy wariant w grupie `PUBLIC` jest od razu publiczny.
- **R5.** Każda operacja grupowa to jedna transakcja (deferred triggery PS-108 widzą spójny stan).
- **R6.** Zdjęcie wariantu to zawsze własny plik pod ścieżką jego `recipeId`.
- **R7.** Nowe i zmienione funkcje `security definer`: `revoke` od `public/anon/authenticated`, `grant` tylko dla
  `service_role` (`has_function_privilege`); `p_user_id` wyłącznie z JWT zweryfikowanego w Edge Function.

---

## Kryteria akceptacji (Given-When-Then)

### Flaga funkcji

1. **Tryby.** *Given* flaga w trybie `wyłączona`, `tylko admin` lub `wszyscy`, *When* admin i zwykły użytkownik
   wywołują nowy endpoint, *Then*: `wyłączona` — odmowa dla obu (kod ustala plan API, jednolity); `tylko admin` —
   dostęp tylko admina; `wszyscy` — dostęp właściciela do swoich grup. `/me` zwraca stan zgodny z odpowiedzią
   backendu, a UI pokazuje sekcję „Warianty” tylko przy stanie „włączona”.
2. **Gość, brak wiersza.** *Given* gość lub brak wiersza flagi, *When* wywołanie nowego endpointu, *Then* `401` dla
   gościa, a brak wiersza = „wyłączona”; zmiana trybu SQL-em działa bez redeployu.

### Tworzenie wariantu

3. **Pusty wariant.** *Given* grupa właściciela, *When* tworzy pusty wariant „Wegetariańska”, *Then* powstaje aktywny
   wariant (`is_default = false`, `sort_order` = max + 1, nazwa i widoczność grupy); odpowiedź zwraca nowy
   `recipes.id` i listę wariantów.
4. **Kopia.** *Given* wariant źródłowy, *When* tworzy kopię z nową nazwą, *Then* nowy wariant ma skopiowane treści
   (opis, składniki, kroki, porady, tagi, kategoria, cechy, czasy) i **własny plik zdjęcia**; późniejsze edycje źródła
   i kopii są niezależne.
5. **Nieudana kopia zdjęcia.** *Given* błąd kopiowania w Storage, *When* tworzona jest kopia, *Then* wariant powstaje
   **bez zdjęcia**, odpowiedź niesie ostrzeżenie (UI je pokazuje), osierocone pliki są czyszczone best-effort, a błąd
   czyszczenia nie psuje odpowiedzi.
6. **Limit i unikalność.** *Given* grupa z 10 aktywnymi wariantami lub wariantem „Klasyczna”, *When* dodawany jest
   11. wariant lub „klasyczna”, *Then* `409` z komunikatem domenowym; równoległe dodania nie przekraczają limitu;
   usunięte warianty nie liczą się do limitu ani unikalności.
7. **Nazwa „Podstawowa”.** *Given* grupa z jednym wariantem „Podstawowa”, *When* użytkownik dodaje drugi, *Then* UI
   wymusza zmianę nazwy pierwszego (backend: osobna operacja zmiany nazwy wariantu).

### Edycja, nazwa i widoczność grupy

8. **Edycja wariantu.** *Given* wariant, *When* właściciel edytuje go dotychczasową ścieżką, *Then* zmienia się tylko
   ten wariant (także wspólne treści nie są synchronizowane); zmiana nazwy wariantu na zajętą daje `409`.
9. **Nazwa grupy.** *Given* grupa z N wariantami, *When* właściciel zmienia nazwę grupy, *Then* w jednej transakcji
   zmienia się nazwa grupy i kopie `recipes.name` aktywnych wariantów; UI informuje, że zmiana dotyczy wszystkich.
10. **Widoczność grupy.** *Given* grupa z N wariantami, *When* właściciel zmienia widoczność, *Then* zmienia się
    widoczność grupy i kopie wszystkich aktywnych wariantów naraz; zmiana widoczności pojedynczego wariantu jest nadal
    odrzucana; `SHARED` jest zapisywane, ale nie daje dostępu po linku.
11. **Stare `PUT`.** *Given* grupa z 1 lub >1 wariantami, *When* klient wywoła `PUT /recipes/{id}` z `name`/
    `visibility`, *Then* działa jak po PS-108 (zmienia grupę i kopie).

### Domyślny i kolejność

12. **Wariant domyślny.** *Given* grupa z wariantami, *When* właściciel wskaże inny domyślny, *Then* w jednej
    transakcji poprzedni traci znacznik, a wskazany go dostaje; po operacji jest dokładnie jeden domyślny.
13. **Kolejność.** *Given* grupa z wariantami, *When* właściciel prześle nową kolejność, *Then* `sort_order` aktywnych
    wariantów jest przepisany spójnie (0..n-1); lista niekompletna, z duplikatami, cudzym lub usuniętym wariantem jest
    odrzucana w całości (`400`/`404`). Wariant cudzy, spoza grupy lub usunięty użyty jako domyślny → `404`.

### Usuwanie

14. **Użycie.** *Given* wariant użyty w planie, kolekcjach lub liście zakupów, *When* UI pyta o użycie, *Then* API
    zwraca liczby (dla wariantu lub grupy), a UI pokazuje ostrzeżenie i wymaga potwierdzenia.
15. **Usunięcie wariantu.** *Given* grupa z ≥2 wariantami, *When* właściciel potwierdza, *Then* wariant ma
    `deleted_at`, jest usunięty z planu i kolekcji właściciela, lista zakupów skorygowana logiką RPC planu; jeśli był
    domyślny, w tej samej transakcji domyślnym zostaje pierwszy aktywny wg `sort_order`.
16. **Ostatni wariant.** *Given* grupa z jednym aktywnym wariantem, *When* próba usunięcia wariantu, *Then* `409` z
    propozycją usunięcia grupy; UI nie oferuje usunięcia wariantu.
17. **Usunięcie grupy.** *Given* grupa, *When* właściciel potwierdza (po ostrzeżeniu z 14), *Then* warianty i grupa mają
    `deleted_at`, wpisy właściciela są sprzątane, przepisy znikają z list i dostępu po ID jak dziś.
18. **Wpisy innych.** *Given* publiczny wariant użyty przez innych, *When* zostaje usunięty, *Then* zachowanie jak
    dziś przy usunięciu przepisu (odczyty filtrują `deleted_at`); oceny, flagi, notatki zostają w bazie; przywracania brak.

### Bezpieczeństwo

19. **Cudze zasoby.** *Given* użytkownik B, *When* wywoła operację na grupie lub wariancie A, *Then* `404` bez ujawniania
    istnienia i bez zmian w bazie.
20. **Uprawnienia RPC.** *Given* migracja, *When* sprawdzone zostanie `has_function_privilege`, *Then* nowe RPC oraz
    `create_recipe_with_tags`, `update_recipe_with_tags`, `soft_delete_recipe` mają `EXECUTE` tylko dla `service_role`;
    bezpośrednie wywołanie przez PostgREST (także z cudzym `p_user_id`) kończy się odmową.
21. **Brak regresji zapisu.** *Given* `recipes.service` na kliencie serwisowym, *When* użytkownik tworzy, edytuje lub
    usuwa przepis (formularz, szkic AI, import z URL), *Then* zachowanie i kształt odpowiedzi są jak dziś, `user_id`
    pochodzi z JWT, a brak ważnego JWT daje `401`.

### Zgodność i UI

22. **Bez wariantów bez zmian.** *Given* grupy 1:1 przy dowolnym stanie flagi, *When* użytkownik korzysta z przepisów,
    list, Explore, wyszukiwania, kolekcji, planu i panelu admina, *Then* widzi to samo co po PS-108; `/recipes/{id}`
    bez zmian.
23. **Sekcja „Warianty”.** *Given* flaga włączona, *When* właściciel edytuje własny przepis, *Then* widzi listę
    wariantów (nazwa, znacznik domyślnego, chipy) z akcjami: dodaj pusty/kopię, edytuj, domyślny, w górę/w dół, usuń,
    oraz edycję nazwy i widoczności grupy z informacją o zasięgu; informuje też, że nowy wariant w `PUBLIC` jest od
    razu publiczny. Przy wyłączonej fladze sekcji nie ma.
24. **Stany UI.** *Given* operacja w toku lub błąd, *When* użytkownik korzysta z sekcji, *Then* są: ładowanie
    (zablokowane przyciski), czytelne błędy domenowe (limit, nazwa zajęta, ostatni wariant), ostrzeżenie o zdjęciu,
    stan „jeden wariant”; na telefonie lista jednokolumnowa, obsługa klawiaturą i nazwy ARIA akcji.
25. **Kontrakty i typy.** *Given* zmiany w `shared/contracts/types.ts` i typach bazy, *When* budowane są frontend i Edge
    Functions, *Then* kompilują się; zmiany addytywne.

---

## Przypadki brzegowe

- Współbieżność (dwa dodania na limicie, domyślny vs usunięcie): blokada wiersza grupy; przegrany dostaje `409`.
- Usunięcie przepisu w innej karcie: `404` z komunikatem, sekcja się odświeża.
- Kopia wariantu bez zdjęcia: bez ostrzeżenia. Nazwa wariantu przycinana; długość i znaki jak `recipes.name`.
- Zmiana flagi w trakcie sesji: UI odświeża stan z `/me` przy wejściu na ekran; backend egzekwuje flagę zawsze.

---

## Decyzje i założenia

### Decyzje użytkownika (runda 1, warianty rekomendowane)

1. **Zakres A:** backend i prosty ekran „Warianty” przy edycji przepisu (pełny zestaw operacji).
2. **Flaga B:** tabela flag w bazie (`wyłączona` / `tylko admin` / `wszyscy`), SQL/migracja bez panelu; `/me` zwraca
   stan; backend odrzuca nowe endpointy; UI ukrywa sekcję.
3. **`SHARED` po linku A:** poza zakresem (osobna historyjka); `SHARED` jak dziś.
4. **Luka `p_user_id` A:** nowe RPC tylko `service_role`; `authenticated` odebrane trzem istniejącym RPC;
   `recipes.service` na kliencie serwisowym z weryfikacją JWT i własności (także import i AI).
5. **Zdjęcie przy kopii A→B:** błąd ⇒ wariant bez zdjęcia + ostrzeżenie w UI; osierocone pliki best-effort.

### Założenia (do potwierdzenia przy planowaniu)

1. Limit 10 aktywnych wariantów (z domyślnym), niezależny od planu; egzekwowany w RPC pod blokadą grupy.
2. Wektor wyszukiwania nie wymaga odświeżania (kolumna generowana z `name`, trigger PS-108 synchronizuje `name`);
   `variant_name` w wyszukiwaniu to H4.
3. Unikalność nazw mapowana na `409`; UI wymusza zmianę „Podstawowa” przy drugim wariancie.
4. Usunięcie wariantu: soft delete; ostatniego nie wolno; domyślny zastępowany pierwszym aktywnym wg `sort_order`;
   przed usunięciem API zwraca użycie; po potwierdzeniu sprzątanie planu i kolekcji właściciela oraz korekta listy
   zakupów logiką `remove_recipe_from_plan_and_update_shopping_list`.
5. Usunięcie grupy: istniejąca ścieżka grupowa (kaskada `deleted_at` triggerem) z tym samym ostrzeżeniem.
6. Widoczność wspólna dla grupy; trigger nadal blokuje zmianę widoczności pojedynczego wariantu.
7. Stare `PUT /recipes/{id}` zmienia grupę przez `name`/`visibility` (zgodność z PS-108); operacje grupowe mają nowe
   endpointy.
8. Kopia: `is_default = false`, `sort_order` = max + 1; treści kopiowane jednorazowo.
9. Import i AI tworzą grupę z jednym wariantem (bez zmian); warianty z AI poza zakresem.
10. Kod odrzucenia przy wyłączonej fladze ustala plan API (jednolity).
11. Testy: `deno test`, Vitest, zapytania weryfikacyjne na lokalnej bazie; bez E2E.

### Otwarte kwestie

1. **Warunki trybu `wszyscy`** (RLS na `recipes`, `security_invoker`, `SHARED` po linku, H3–H5) niespełnione;
   PS-109 pozwala najwyżej na `tylko admin`.
2. **Kolekcje przy usunięciu wariantu** (RPC czy zapytanie) i zasada „jak dziś” dla wpisów innych użytkowników —
   sprawdzić przy planowaniu API.
3. **`database.types.ts`** aktualizować ręcznie i addytywnie (regeneracja gubi `| null`); dług `deno check` w
   `explore` poza zakresem.
4. **Rozmiar:** zakres A i domknięcie luki RPC to duża historyjka; plan dzieli ją na API i widoki, a przy planie
   >~10 KB orkiestrator rozważa podział etapów w obrębie PS-109.

---

## Definition of Done

- Migracje: tabela flag (domyślnie wyłączona), nowe RPC wariantów i grupy (limit, blokada, transakcje),
  `revoke`/`grant` dla `service_role`, odebranie `authenticated` trzem istniejącym RPC, `soft_delete_recipe` z
  jawnym parametrem użytkownika; `has_function_privilege` sprawdzone; przechodzą na lokalnej bazie (`db reset`).
- Edge Functions: nowe endpointy (flaga, własność, błędy, kopia zdjęcia z ostrzeżeniem), `/me` ze stanem flagi,
  `recipes.service` na kliencie serwisowym; formularz, AI i import bez regresji.
- Frontend: sekcja „Warianty” (stany ładowania/błędu/pusty, responsywność, dostępność) ukrywana flagą.
- Kontrakty i typy bazy addytywnie.
- Testy jednostkowe: `deno test` (handlery, serwisy, błędy, flaga, limit) i Vitest (komponenty, serwisy); zapytania
  weryfikacyjne bazy dla kryteriów 6, 12–13, 15–16, 20. Bez E2E.
- `ng lint`, `ng build`, `deno lint`/`deno check` zmienionych funkcji bez błędów.
- Weryfikacja ręczna lokalnie przy fladze `tylko admin` (grupa z pustego i kopii, kolejność, domyślny, usuwanie z
  ostrzeżeniem, brak sekcji dla zwykłego użytkownika); status `PASS`/`FAIL`/`NIE_WYKONANO`/`WYMAGA_WERYFIKACJI`.
- `project-summary.md` (wiersz PS-109) na etapie summary; `project-reference.md` odświeżony generatorem.

---

## Historia zmian

| Data | Etap | Zmiana | Powód |
|------|------|--------|-------|
| 2026-11-20 | Plany implementacji | Dodano plan API i plan widoków; rozdzielono implementację na etapy bezpieczeństwa, domeny wariantów i UI | Przygotowanie realizacji PS-109 bez blokujących pytań; nierozstrzygnięte szczegóły zapisano jako założenia |
