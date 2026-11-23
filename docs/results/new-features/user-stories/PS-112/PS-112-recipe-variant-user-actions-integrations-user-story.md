# PS-112: Działania użytkownika na wariancie i integracje (plan, lista zakupów, limit Free, usuwanie, panel admina)

## Opis

Jako **użytkownik zapisujący i oceniający przepisy z wariantami**,
chcę **mieć pewność, że każda akcja (kolekcja, plan, ulubione, ocena, notatka, zakupy) dotyczy wybranego wariantu, i widzieć, który wariant jest już zapisany lub oceniony**,
aby **zapisanie wersji wegetariańskiej nie zapisało mięsnej, a usunięcie wariantu nie zostawiało „duchów” w planie i na liście zakupów**.

Jako **administrator** chcę **odróżniać warianty od grup w panelu**, aby nie widzieć pozornych duplikatów.

Źródło: `docs/variants-conception.md`, „Historyjka 5” (sekcje 5–8, po doprecyzowaniach z tej historyjki).

---

## Kontekst (stan obecny, sprawdzony w kodzie)

- PS-108…111: grupa `recipe_families`, kolumny wariantu w `recipes`, flaga `recipe_variants`
  (`disabled`/`admin`/`all`), przełącznik na szczegółach (`?variant=`), listy zwracają grupy.
- Oceny, flagi, notatki, `recipe_collections`, `plan_recipes`, `shopping_list_items` i kolejka składników są
  kluczowane po `recipe_id` (wariancie), ale UI nie pokazuje, który wariant jest zapisany/oceniony.
- **Limit Free** (PS-65, `PLAN_LIMIT_FREE`, domyślnie 7): `checkFreePlanLimit` liczy **wszystkie** wiersze
  `plan_recipes` (także przepisów, które przestały być dostępne); trigger `check_plan_limit` trzyma twardy limit 50.
- **Usuwanie:** `delete_recipe_variant` czyści plan, kolekcje i starą tabelę
  `shopping_list_recipe_contributions`, ale **nie** `shopping_list_items` (`kind = 'RECIPE'`) — pozycje zostają
  osierocone; `delete_recipe_family` nie czyści niczego. `recipe_variant_usage` (ostrzeżenie w dialogu) liczy po
  **całej grupie** i po starej tabeli wkładów. Ręczne usunięcie z planu czyści `shopping_list_items`.
- **Admin:** `admin_get_recipes_page` zwraca warianty bez informacji o wariancie (wyglądają jak duplikaty);
  `admin_get_users_page` liczy `recipes_count` jako aktywne wiersze `recipes` (warianty).
- Import i AI wstawiają do `recipes` bez grupy (trigger tworzy grupę 1:1); ścieżka obrazu zawiera `recipeId`.

---

## Zakres

### W zakresie

1. **Znaczniki stanu per wariant w przełączniku** na szczegółach (R3) wraz z danymi o stanie wariantów grupy.
2. **Weryfikacja i poprawki**, że kolekcje, plan, ulubione, „chcę wypróbować”, ocena i notatka dotyczą tylko
   wybranego wariantu; „Nazwa · wariant” w planie i tam, gdzie lista zakupów pokazuje przepis źródłowy.
3. **Lista zakupów i normalizacja składników** wyłącznie per wariant.
4. **Limit Free** (R4): wariant = slot; liczą się tylko wpisy dostępne dla użytkownika.
5. **Usuwanie wariantu/grupy** (R5): pełne czyszczenie u właściciela, poprawne ostrzeżenie, ukrycie (bez kasowania)
   wpisów innych użytkowników.
6. **Weryfikacja** importu, AI i obrazów (R7).
7. **Panel admina** (R6): kolumna „Wariant”, link do dokładnego wariantu, `recipes_count` = grupy + „N wariantów”.
8. Kontrakty addytywnie, migracje/RPC wg planu API, testy jednostkowe (Vitest, `deno test`).

### Poza zakresem

- Znaczniki na kartach list, kolekcji i wyników (karty bez zmian, jak PS-111); zbiorcza ocena grupy; akcje grupowe.
- Wariant z AI/importu do istniejącego przepisu, dołączanie/odłączanie, przywracanie, „szkic”, nowe limity,
  zmiana `PLAN_LIMIT_FREE`.
- Moderacja i akcje grupowe w panelu (dziś ich nie ma), filtr admina po nazwie wariantu.
- „Wariant spełnił filtr”/powrót do wyników, `SHARED` po linku, RLS na `recipes`, flaga `all`, E2E.

### Zależności

**PS-108…PS-111** — wymagane. Historyjka nie włącza flagi.

---

## Reguły

- **R1. Flaga.** Znaczniki, nowe liczenie limitu, nowe czyszczenie i zmiany w panelu działają tylko przy włączonej
  fladze dla pytającego (admin: `admin`/`all`). Przy fladze wyłączonej wszystko jest jak przed PS-112.
- **R2. Akcja = wariant.** Wszystkie akcje dotyczą `recipe_id` wyświetlanego wariantu; nie ma akcji grupowych.
  Nowy wariant (pusty lub kopia) startuje bez ulubionych, ocen, notatek, kolekcji i planu.
- **R3. Znaczniki.** Przy N ≥ 2 każdy wariant w przełączniku pokazuje **własny stan zalogowanego użytkownika**:
  ulubiony, „chcę wypróbować”, w planie, w ≥1 kolekcji, notatka (sam znacznik), własna ocena. Dotyczy wariantów
  dostępnych pytającemu; gość i flaga wyłączona — bez znaczników. Stan aktualizuje się po akcji bez przeładowania;
  znaczniki mają tekst dla czytnika ekranu i nie psują układu przełącznika z PS-110 na telefonie.
- **R4. Limit Free.** Każdy wariant to osobny slot. Liczą się wyłącznie wpisy planu **dostępne dla użytkownika**:
  przepis (grupa i wariant) nieusunięty, własny albo `PUBLIC`. Wpisy niedostępne zostają w bazie, nie są pokazywane
  ani liczone; gdy przepis znów będzie dostępny, wpis wraca (grandfathering PS-65, nadmiar nie jest kasowany).
- **R5. Usuwanie.** Usunięcie wariantu usuwa u **właściciela** jego wpisy w planie, kolekcjach i pozycje
  `shopping_list_items` (oraz starą tabelę wkładów) logiką ręcznego usunięcia z planu; usunięcie grupy — dla
  wszystkich jej wariantów. **Wpisy innych użytkowników** zostają w bazie, ale są ukryte i niepoliczone (R4).
  Oceny, flagi i notatki zostają, niewidoczne (jak dziś).
- **R6. Admin.** Lista przepisów: wiersz = wariant (total, paginacja, sortowanie po wariantach); kolumna „Wariant”
  z nazwą, „—” przy jednym aktywnym wariancie; link otwiera dokładnie ten wariant (adres `{id}`, bez „ratunku”).
  Lista użytkowników: `recipes_count` = aktywne grupy, obok „N wariantów”; sortowanie po `recipes_count` wg grup.
- **R7. Integracje.** Import i AI tworzą grupę z jednym wariantem; kopia wariantu ma własny plik zdjęcia, a
  usunięcie wariantu nie wpływa na zdjęcie innego.

---

## Kryteria akceptacji (Given-When-Then)

### Znaczniki i akcje

1. **Znaczniki per wariant.** *Given* flaga włączona, grupa z A, B, C, ulubiony B, w planie A, ocena C = 4, notatka
   w A, *When* użytkownik otwiera szczegóły, *Then* przełącznik pokazuje przy B „ulubiony”, przy A „w planie” i
   „notatka”, przy C „ocena 4”; każdy znacznik ma tekst dla czytnika ekranu.
2. **Akcja tylko na wybranym.** *Given* otwarty B, *When* użytkownik dodaje go do kolekcji/planu/ulubionych/„chcę
   wypróbować”, ocenia lub zapisuje notatkę, *Then* zmienia się wyłącznie stan B, a tekst pomocniczy podaje
   „Zapisujesz wariant: B”; znaczniki B odświeżają się bez przeładowania, a po przełączeniu na A widać stan A.
3. **Dane tylko własne.** *Given* gość, flaga wyłączona lub `PUBLIC` grupa innego autora, *Then* brak znaczników
   (gość, flaga) i brak cudzych ocen, notatek i flag w odpowiedzi.
4. **Kopia bez stanu.** *Given* A ulubiony, w planie i z notatką, *When* właściciel tworzy kopię A, *Then* kopia nie
   ma żadnego z tych stanów.
5. **Karty bez zmian.** *Given* Explore, „Moje przepisy” lub kolekcja, *Then* karty nie zyskują znaczników
   wariantów (wskaźniki reprezentanta jak PS-111).

### Plan, zakupy, kolekcje

6. **Dwa warianty w planie.** *Given* plan z A, *When* dodano B tej samej grupy, *Then* są dwa osobne wpisy z nazwą
   „Nazwa · wariant” (przy N ≥ 2); usunięcie A nie usuwa B.
7. **Zakupy per wariant.** *Given* A i B w planie o różnych składnikach, *Then* pozycje listy zakupów pochodzą z
   właściwych wariantów, nie są łączone po nazwie przepisu, źródło ma „Nazwa · wariant”; usunięcie A z planu usuwa
   tylko jego pozycje; kolejka składników znormalizowanych działa po `recipe_id`.
8. **Kolekcje.** *Given* kolekcja, *When* zapisano B, *Then* A nie jest zapisany; karta zgodna z PS-111.

### Limit Free

9. **Wariant = slot.** *Given* Free z 6 wpisami, *When* dodaje dwa warianty tej samej grupy, *Then* pierwszy się
   dodaje, drugi (7 → 8) kończy się błędem limitu Free z PS-65; równoległe dodania nie przekraczają limitu.
10. **Tylko dostępne.** *Given* Free z 7 wpisami, z których 2 dotyczą niedostępnych przepisów (usunięty wariant lub
    grupa, cudzy przepis już nie `PUBLIC`), *Then* limit liczy 5 i można dodać 2 wpisy; wiersze nie są kasowane, a po
    przywróceniu dostępności znów się liczą.
11. **Flaga wyłączona.** *Given* flaga wyłączona, *Then* limit liczy wiersze jak przed PS-112.

### Usuwanie

12. **Ostrzeżenie.** *Given* wariant B użyty w 1 wpisie planu, 2 kolekcjach i 3 pozycjach `shopping_list_items`
    oraz inny wariant grupy też użyty, *When* właściciel otwiera „Usuń wariant”, *Then* dialog podaje 1/2/3 tylko
    dla B; przy usuwaniu całej grupy liczby obejmują wszystkie warianty.
13. **Czyszczenie wariantu.** *Given* GWT 12, *When* właściciel potwierdza, *Then* wpisy B w planie, kolekcjach i
    zakupach znikają, inne warianty zostają, a zwolniony slot zmniejsza licznik limitu.
14. **Czyszczenie grupy.** *Given* wiele wariantów w planie/kolekcjach/zakupach właściciela, *When* usunięto
    cały przepis, *Then* wszystkie ich wpisy właściciela znikają, bez osieroconych `shopping_list_items`.
15. **Wpisy innych.** *Given* U2 ma w planie i kolekcji `PUBLIC` wariant autora, *When* autor usuwa wariant lub
    grupę, *Then* wpisy U2 zostają w bazie, ale są niewidoczne, niepoliczone w limicie i nie powodują błędów (plan,
    kolekcje, zakupy).
16. **Dane zostają.** *Given* usunięty wariant, *Then* jego oceny, flagi i notatki zostają w bazie, niewidoczne.

### Import, AI, obrazy

17. **Import i AI.** *Given* przepis z importu lub AI, *Then* ma grupę z jednym wariantem („Wariant podstawowy”),
    pole „Wariant” jest ukryte, a akcje (R2) działają jak dla zwykłego przepisu.
18. **Obrazy.** *Given* A ze zdjęciem i jego kopia B, *When* usunięto B lub zmieniono jego zdjęcie, *Then* zdjęcie A
    pozostaje i wyświetla się poprawnie.

### Panel admina

19. **Kolumna „Wariant”.** *Given* flaga włączona dla admina i „Lasagne” z „Klasyczna” i „Wegetariańska”, *When* admin
    otwiera listę przepisów, *Then* są dwa wiersze z odpowiednimi nazwami wariantu; przepis z jednym wariantem ma
    „—”; total, paginacja, sortowanie i filtry działają jak dziś.
20. **Link do wariantu.** *Given* wiersz „Lasagne · Wegetariańska”, *When* admin kliknie „Otwórz”, *Then* otwiera się
    dokładnie ten wariant (zaznaczony w przełączniku), bez komunikatu „ratunku”.
21. **Licznik użytkowników.** *Given* użytkownik z 12 grupami i 17 aktywnymi wariantami, *Then* tabela pokazuje
    `recipes_count` = 12 i „17 wariantów”, sortowanie wg grup; przy fladze wyłączonej tabela jest jak dziś.

### Uprawnienia i regresja

22. **Uprawnienia RPC.** *Given* nowe lub przebudowane funkcje `security definer`, *Then* mają `revoke` dla
    `public`/`anon`/`authenticated` i `grant` dla `service_role`, a migracja sprawdza to `has_function_privilege`.
23. **Brak regresji.** *Given* przepisy z jednym wariantem lub flaga wyłączona, *Then* plan, zakupy, kolekcje,
    ocena, notatka, usuwanie i admin działają jak dotąd (poza poprawionym czyszczeniem `shopping_list_items` i
    ostrzeżeniem).

---

## Przypadki brzegowe i ograniczenia

- Przełącznik z 10 wariantami: znaczniki nie przepełniają listy (skrócona forma, pełny opis w `aria-label`).
- Zmiana widoczności grupy na `PRIVATE` po dodaniu przez innego użytkownika: wpis ukryty i niepoliczony (R4).
- Twardy trigger `check_plan_limit` (50) zostanie ujednolicony z regułą dostępności z A11.
- Filtr nazwy w panelu admina dopasowuje nazwę przepisu, nie wariantu.

## Decyzje i założenia

**Decyzje użytkownika (runda 1):**
1. **Znaczniki tylko na szczegółach:** per wariant (ulubiony, „chcę wypróbować”, w planie, w kolekcji, notatka,
   ocena); karty list bez zmian; dodatkowe zapytanie/dane o stanie wariantów grupy.
2. **Limit i usuwanie:** do limitu Free liczą się tylko wpisy dostępne dla użytkownika (dane zostają); usunięcie
   wariantu/grupy czyści u właściciela plan, kolekcje i pozycje listy zakupów (z poprawionym ostrzeżeniem, które
   dziś liczy starą tabelę wkładów zamiast `shopping_list_items`); wpisy innych użytkowników ukryte, nie kasowane.
3. **Admin — przepisy:** wiersz = wariant, kolumna „Wariant” („—” przy jednym), link otwiera dokładnie ten wariant.
4. **Admin — użytkownicy:** `recipes_count` = grupy + „N wariantów” (nowa sygnatura RPC).

**Założenia (wariant rekomendowany):**
- A1. Cały zakres działa tylko przy włączonej fladze (R1).
- A2. Nowe pola kontraktów addytywne i opcjonalne; stan znaczników liczy backend (klient serwisowy) z własnych
  danych zalogowanego pytającego.
- A3. „Ocena” = własna ocena użytkownika (nie średnia); „notatka” = znacznik obecności, bez treści.
- A4. Brak akcji grupowych; nowy wariant nie dziedziczy ulubionych, ocen, notatek, kolekcji ani planu.
- A5. Dodanie drugiego wariantu tej samej grupy do planu nie jest blokowane ani ostrzegane.
- A6. Ukryte wpisy innych użytkowników nie są czyszczone w tle; wracają, gdy przepis znów jest dostępny.
- A7. Usunięcie całego przepisu z „Moich przepisów” (`soft_delete_recipe`) ma skutek jak usunięcie grupy (R5), o ile
  dziś go nie ma — plan API potwierdza w kodzie.
- A8. Panel admina: sortowanie i filtry listy przepisów bez zmian; „N wariantów” i kolumna „Wariant” tylko przy
  fladze włączonej dla admina.
- A9. Import, AI, obrazy i normalizacja są weryfikowane testami; poprawki tylko przy wykrytej rozbieżności, wynik
  w weryfikacji.
- A10. Bez nowych limitów, ról i opcji płatnych; `PLAN_LIMIT_FREE` bez zmian.
- A11. „Dostępny” dla limitu i planu oznacza aktywny wariant własny albo aktywny wariant grupy `PUBLIC`; ukryte
  wpisy pozostają w bazie, nie są liczone i wracają po odzyskaniu dostępności. Trigger 50 stosuje tę samą regułę.
- A12. Stan znaczników jest addytywnie zwracany w odpowiedzi szczegółów i zawiera wyłącznie dane zalogowanego
  użytkownika; przy gościu, niedozwolonej fladze lub cudzym `PUBLIC` stanie osobistym pola są pomijane.
- A13. RPC admina otrzymują nowe, jawnie zabezpieczone sygnatury; stara ścieżka odpowiedzi pozostaje niezmieniona
  przy fladze wyłączonej.
- A14. Wspólny helper czyszczenia działa transakcyjnie i usuwa dane operacyjne wyłącznie właścicielowi wpisu;
  dane historyczne ocen, flag i notatek pozostają.
- A15. Na planie, w kolekcji i przy źródle pozycji zakupowej wyświetla się `Nazwa · wariant` dla grup z co najmniej
  dwoma aktywnymi wariantami; karty list zachowują układ PS-111, ale ich podtytuł wariantu pozostaje czytelny.

## Do rozstrzygnięcia w planach

1. **Zliczanie dostępnych wpisów — założenie A11:** dostępny jest aktywny wariant własny albo aktywny wariant
   grupy `PUBLIC`; licznik planu i widok planu używają tej samej definicji. Twardy trigger 50 zostaje dostosowany
   do tej definicji.
2. **Źródło znaczników — założenie A12:** stan jest addytywną częścią `GET /recipes/{id}` i
   `GET /explore/recipes/{id}`, bez osobnego endpointu; backend zwraca wyłącznie stan pytającego i maksymalnie
   10 wariantów.
3. **Sygnatury RPC admina — założenie A13:** powstają addytywne, jawnie zabezpieczone wersje RPC; dotychczasowe
   warianty pozostają dla flagi wyłączonej.
4. **Wspólna logika czyszczenia — założenie A14:** jeden transakcyjny helper jest używany przez usuwanie
   wariantu/grupy i ręczne usunięcie z planu; obejmuje plan, kolekcje, zakupy, starą tabelę wkładów i kolejkę.
5. **Weryfikacja integracji — założenie A15:** import, AI, obrazy i normalizacja dostają testy regresyjne; kod
   zmienia się tylko przy rozbieżności z R7 albo działaniem per `recipe_id`.

## Definition of Done

- GWT 1–23 pokryte testami jednostkowymi: `deno test` (znaczniki, limit, czyszczenie, ostrzeżenie, RPC admina,
  flaga, uprawnienia) i Vitest (przełącznik ze znacznikami, plan/zakupy, tabele admina). Bez E2E.
- Kontrakty addytywne w `shared/contracts/types.ts`; brak regresji bez flagi (GWT 11, 23).
- `ng lint` i `ng build` przechodzą; `deno lint`/`deno check` dla zmienionych funkcji bez nowych błędów; migracje
  przechodzą lokalnie z kontrolą uprawnień.
- Test ręczny (admin z flagą `admin`): znaczniki, plan z dwoma wariantami, limit Free, usunięcie wariantu i grupy,
  panel admina, mobile, czytnik ekranu — wynik w weryfikacji.
- Aktualizacja `docs/variants-conception.md` (sekcja 8: stan PS-112, wiersz „5” w tabeli) po implementacji.

## Historia zmian

| Data | Etap | Zmiana | Powód |
|---|---|---|---|
| 2026-11-23 | plany | Rozstrzygnięto punkty 1–5 z sekcji „Do rozstrzygnięcia w planach”; doprecyzowano oznaczenie `Nazwa · wariant` na planie, w kolekcji i przy źródle zakupów. | Ujednolicenie kontraktu API, czyszczenia danych i prezentacji wariantu przed implementacją. |
