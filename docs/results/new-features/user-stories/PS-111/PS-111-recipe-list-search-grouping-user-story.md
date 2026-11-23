# PS-111: Grupowanie list i wyszukiwania wariantów (Explore, „Moje przepisy”, kolekcje, wyszukiwarka)

## Opis

Jako **użytkownik przeglądający listy przepisów**,
chcę **widzieć przepis z kilkoma wariantami jako jedną kartę, znajdować go także po nazwie wariantu i trafiać od razu na pasujący wariant**,
aby **nie przeglądać „zduplikowanych” kart i nie tracić kontekstu wyszukiwania**.

Źródło: `docs/variants-conception.md`, „Historyjka 4 — Grupowanie list i wyszukiwania” (sekcje 3, 5, 8, po
doprecyzowaniach z tej historyjki). Historyjka 5 jest poza zakresem.

---

## Kontekst (stan obecny, sprawdzony w kodzie)

- PS-108/109/110: grupa `recipe_families`; `recipes` ma `recipe_family_id`, `variant_name` (nazwa techniczna
  „Wariant podstawowy”, starsze „Podstawowa”), `is_default`, `sort_order`; `recipes.name` i `visibility` to kopie
  z grupy; `recipe_details` ma te kolumny i `active_variant_count`. Flaga `recipe_variants`
  (`disabled`/`admin`/`all`) liczona dla pytającego; szczegóły obsługują `?variant=` (PS-110).
- **Explore** (`public`): widok `recipe_details`, `PUBLIC` lub własne; bez wyszukiwania paginacja i `total` w
  bazie; z wyszukiwaniem pobierane jest do **1000** najnowszych wierszy, a dopasowanie (tokeny, AND:
  nazwa/składniki/tagi/porady) i ranking liczy kod; tryb kursorowy ma `hasMore`.
- **„Moje przepisy”** (`recipes`, RPC `get_recipes_list`): `ilike` po `name`, strony, `total_count`, filtry cech i
  osobiste (ulubione, „chcę wypróbować”).
- **Kolekcje** (`collections`): lista przepisów kolekcji i pasek boczny, sortowanie + limit, `totalCount` +
  `truncated`; karta ma „Usuń z kolekcji” (dialog) i wskaźnik ulubionego, link z `recipeLink()`.
- **Wyszukiwarka globalna** (`search`): `ilike` po `recipes.name`, limit na typ. `search_vector` nie jest nigdzie
  używany. Dziś kilka wariantów grupy dałoby kilka wierszy o tej samej nazwie.

---

## Zakres

### W zakresie

1. **Grupowanie w backendzie** (Explore, „Moje przepisy”, listy kolekcji, wyszukiwarka globalna): jedna pozycja
   na grupę, **przed** paginacją/limitem; `total`/`totalItems`/`totalCount`/`hasMore` liczą grupy.
2. **Reprezentant** (R3) i metadane karty: liczba dostępnych i pasujących wariantów, nazwa reprezentanta.
3. **Wyszukiwanie po nazwie wariantu** (R4): Explore, „Moje przepisy”, wyszukiwarka globalna.
4. **Link karty** otwiera reprezentanta (`?variant={id}` przy ≥2 wariantach, R5).
5. **Kolekcje:** jedna karta na grupę; „Usuń z kolekcji” usuwa tylko pokazany wariant (R7).
6. Frontend (karta, modele, dialog), kontrakty addytywnie, testy jednostkowe (Vitest, `deno test`); migracje
   tylko jeśli wymaga ich plan API (bez zmiany `search_vector`).

### Poza zakresem (świadomie wyłączone)

- **Szczegóły przepisu bez zmian:** brak oznaczenia „wariant spełnił filtr” i powrotu do wyników z zachowanymi
  wyszukiwaniem/filtrami — **osobna kontynuacja**.
- Zmiana `search_vector`/indeksu GIN/`recipe_details` pod wyszukiwanie, wyszukiwanie pełnotekstowe, zniesienie
  limitu 1000 (znane ograniczenie).
- Plan, lista zakupów, ocena, notatka, limit planu Free, import/AI, panel admina (H5); zbiorcza ocena grupy,
  chipy cech na kartach, filtr „ma warianty”, `SHARED` po linku, RLS na `recipes`, flaga `all`, E2E.

### Zależności

**PS-108, PS-109, PS-110** — wymagane. Flaga pozostaje `disabled`/`admin` do zakończenia H5.

---

## Reguły

- **R1. Flaga.** Grupowanie i nowe pola działają tylko przy włączonej fladze `recipe_variants` dla pytającego
  (gość tylko przy `all`). Przy fladze wyłączonej listy, `total`, wyszukiwanie i linki są jak przed PS-111, bez
  nowych pól.
- **R2. M(g)** dla grupy g: aktywne warianty **dostępne pytającemu** (właściciel — wszystkie aktywne; pozostali —
  tylko `PUBLIC`), które spełniają **jednocześnie** wyszukiwanie i wszystkie filtry (cechy, ulubione, „chcę
  wypróbować”, kategoria/tagi). Grupa jest na liście, gdy M(g) ≠ ∅. N = wszystkie aktywne dostępne
  warianty grupy, K = |M(g)|.
- **R3. Reprezentant ∈ M(g):** (a) przy wyszukiwaniu najwyższa trafność; (b) przy remisie lub bez wyszukiwania —
  wariant domyślny, jeśli ∈ M(g); (c) inaczej pierwszy z M(g) wg `sort_order` (remis: niższe `id`).
- **R4. Nazwa wyświetlana** (do dopasowania) = nazwa przepisu + nazwa wariantu w jednym tekście. Nazwy techniczne
  („Wariant podstawowy”, „Podstawowa”; bez wielkości liter, po `trim`) **nie biorą udziału** w dopasowaniu.
  Mechanizm bez zmian (podciąg; w Explore tokeny z AND); składniki, tagi i porady liczone **per wariant**.
  `search_vector` bez zmian.
- **R5. Link karty:** N ≥ 2 → `/recipes/{reprezentant}?variant={reprezentant}` (analogicznie `/explore/recipes/…`);
  N = 1 → jak dziś, bez parametru. Parametr nie omija reguł widoczności (PS-110).
- **R6. Sortowanie po grupach:** trafność — najlepszy wariant z M(g); data — najnowszy wariant z M(g) (bez nowej
  kolumny); nazwa — nazwa przepisu. Sortowania ani filtra po ocenie listy dziś nie mają i nie powstają.
  Tie-breaker: malejące `id` reprezentanta.
- **R7. Kolekcje:** M(g) = warianty grupy zapisane w kolekcji. Reprezentant: zapisany wariant domyślny, inaczej
  pierwszy zapisany wg `sort_order`. „Usuń z kolekcji” dotyczy wyłącznie `recipe_id` reprezentanta.
- **R8. Etykiety karty** (tylko N ≥ 2): podtytuł = nazwa reprezentanta; „N wariantów”; przy aktywnym
  wyszukiwaniu/filtrze i K < N także „pasują K z N: nazwa · nazwa” (max 3 nazwy, reszta „+X”); w kolekcji
  „zapisano K z N”. Pełne dane pozostałych wariantów nie trafiają na listę.

---

## Kryteria akceptacji (Given-When-Then)

### Grupowanie, paginacja i licznik (backend)

1. **Jedna karta na grupę.** *Given* flaga włączona i `PUBLIC` grupa „Lasagne” z 3 wariantami, *When* użytkownik
   otwiera Explore bez filtrów, *Then* jest jedna pozycja „Lasagne” z N = 3 i reprezentantem = wariant domyślny.
2. **Paginacja i stabilność.** *Given* 25 grup po 2 warianty, limit strony 12 i równe wyniki sortowania, *When*
   pobrano strony 1–3, *Then* strony mają 12/12/1 pozycji, bez duplikatów i pominięć, `totalItems` = 25,
   `totalPages` = 3; analogicznie „Moje przepisy” (`total_count`), tryb kursorowy (`hasMore`) i kolekcje
   (`totalCount`, `truncated`).
3. **Flaga wyłączona.** *Given* flaga `disabled` (lub `admin` dla zwykłego użytkownika), *When* otwarta dowolna
   lista, *Then* odpowiedź i `total` są jak przed PS-111, bez nowych pól.
4. **Widoczność i usunięcie.** *Given* grupa `PRIVATE`/`SHARED` innego właściciela, *Then* nie trafia do
   Explore, wyszukiwarki ani liczników; właściciel widzi swoje grupy ze wszystkimi aktywnymi wariantami; usunięte
   warianty i grupy nie liczą się do N, K ani wyników. Pozycja nie zawiera składników, kroków ani notatek
   pozostałych wariantów.

### Reprezentant i filtry

5. **Domyślny przy remisie.** *Given* wyszukiwanie „lasagne” pasujące równorzędnie do wszystkich wariantów,
   *Then* reprezentantem jest wariant domyślny.
6. **Najlepsze dopasowanie.** *Given* wyszukiwanie „bezglutenowa” pasujące tylko do wariantu „Bezglutenowa”,
   *Then* karta „Lasagne” ma reprezentanta „Bezglutenowa” (K = 1, N = 3) i link `?variant={jego id}`.
7. **Domyślny nie spełnia filtra.** *Given* filtr „termorobot” spełniony tylko przez wariant B, *Then* jest jedna
   karta z reprezentantem B; gdy filtr spełniają B i C — pierwszy wg `sort_order`.
8. **Filtry osobiste.** *Given* ulubiony jest tylko wariant B, *When* włączono „ulubione”, *Then* grupa jest na
   liście z reprezentantem B i wskaźnikiem ulubionego B; „chcę wypróbować” działa tak samo; grupa bez takiego
   wariantu nie występuje.
9. **Sortowanie.** *Given* grupa z wariantami o różnych datach i trafności, *Then* sortowanie po trafności, dacie i
   nazwie działa wg R6; wskaźniki karty (w tym ocena, o ile lista ją dziś zwraca) dotyczą reprezentanta, bez oceny
   grupy; sortowanie i filtr po ocenie nie są dodawane.

### Wyszukiwanie po nazwie wariantu

10. **Nazwa wariantu.** *Given* grupa „Lasagne” z wariantem „Wegetariańska”, *When* szukano „wegetariańska”
    lub „lasagne wegetariańska”, *Then* grupa jest znaleziona (Explore, „Moje przepisy”, wyszukiwarka) z
    reprezentantem „Wegetariańska”; „lasagne” nadal znajduje grupę.
11. **Nazwy techniczne.** *Given* grupa z jednym wariantem „Wariant podstawowy” (lub „Podstawowa”), *When*
    szukano „podstawowy”/„wariant”, *Then* grupa nie jest znaleziona z powodu nazwy technicznej.
12. **Pozostałe pola per wariant.** *Given* składnik „bakłażan” tylko w wariancie B, *When* szukano „bakłażan”,
    *Then* reprezentantem jest B (K = 1); pozostałe warianty nie liczą się jako pasujące.
13. **Wyszukiwarka globalna.** *Given* grupa pasująca do zapytania, *Then* lista rozwijana ma **jeden** wiersz na
    grupę z nazwą „Nazwa · wariant” (przy N ≥ 2) i linkiem wg R5; limit liczy grupy.

### Karta i nawigacja (frontend)

14. **Karta grupy.** *Given* N ≥ 2, *Then* karta pokazuje nazwę przepisu, podtytuł z nazwą reprezentanta i „N
    wariantów”; przy N = 1 wygląda jak dziś.
15. **Pasujące.** *Given* aktywne wyszukiwanie/filtr, N = 3, K = 2, *Then* karta pokazuje „pasują 2 z 3:
    Klasyczna · Wegetariańska”; przy K = N lub bez wyszukiwania/filtra — tylko „N wariantów”; długa lista nazw
    skraca się do 3 + „+X”.
16. **Link do reprezentanta.** *Given* karta z N ≥ 2, *When* użytkownik ją kliknie, *Then* otwiera się wariant
    reprezentanta (`?variant={id}`, zaznaczony w przełączniku PS-110); przy N = 1 adres bez parametru; gość
    zachowuje `variant` w przekierowaniu (PS-110).
17. **Stany i dostępność.** *Given* zmiana wyszukiwania, filtra, sortowania lub strony, *Then* lista pokazuje
    ładowanie/pusty/błąd jak dziś, bez zduplikowanych kart; nazwa dostępna dla czytnika ekranu zawiera nazwę
    przepisu, wariant i „N wariantów”, a skrócone nazwy mają pełną wartość w `title`/`aria-label`.

### Kolekcje

18. **Jedna karta w kolekcji.** *Given* kolekcja z zapisanymi wariantami A (domyślny) i B tej samej grupy (N = 3),
    *Then* jest jedna karta z reprezentantem A i „zapisano 2 z 3”.
19. **Domyślny niezapisany.** *Given* zapisane są B i C, a domyślny A nie, *Then* reprezentantem jest pierwszy
    z nich wg `sort_order`.
20. **Usuń z kolekcji.** *Given* karta z reprezentantem A i zapisanym B, *When* użytkownik wybiera „Usuń z
    kolekcji”, *Then* dialog podaje nazwę „Nazwa · wariant” A; po potwierdzeniu usunięty jest wyłącznie A, a po
    odświeżeniu karta pokazuje B; przy ostatnim zapisanym wariancie karta znika i `totalCount` maleje o 1.
21. **Sortowanie, limit, pasek boczny.** *Given* kolekcja przekraczająca limit, *Then* grupowanie następuje przed
    limitem, `truncated` dotyczy grup, sortowanie wg R6 (data = najnowszy zapisany), a pasek boczny szczegółów
    pokazuje jedną pozycję na grupę z linkiem wg R5.

### Zmiany stanu i granice zakresu

22. **Wariant usunięty / zmiana widoczności.** *Given* po wczytaniu listy reprezentant został usunięty lub grupa
    zmieniła widoczność, *When* użytkownik kliknie kartę, *Then* obowiązują „ratunek”/404/403 z PS-110, a
    odświeżona lista nie zawiera niedostępnych wariantów.
23. **Szczegóły bez zmian.** *Given* wejście z karty, *Then* szczegóły nie pokazują „wariant spełnił filtr” ani
    powrotu do wyników (poza zakresem); przełącznik PS-110 działa jak dotąd.

---

## Przypadki brzegowe (poza GWT wprost)

- K = 0 nie tworzy karty; pusty wynik jak dziś.
- Zmiana wariantu domyślnego lub nazwy przepisu między stronami: grupa wystąpi najwyżej raz.
- Reprezentant „Wariant podstawowy” przy N ≥ 2: podtytuł pokazuje nazwę techniczną (wykluczona tylko z dopasowania).
- Wskaźniki karty (ulubione, w planie, ocena) dotyczą reprezentanta, nie grupy.

## Znane ograniczenia

- Limit 1000 najnowszych **wariantów** przy wyszukiwaniu w Explore zostaje; grupowanie następuje po nim, więc
  przy dużej liczbie wariantów starsze grupy mogą nie wejść do wyników (jak dziś dla przepisów).
- Dopasowanie podciągiem (bez odmiany i literówek).

## Decyzje i założenia

**Decyzje użytkownika (runda 1):**
1. **Tylko listy.** Karta pokazuje, które warianty pasują; link otwiera reprezentanta; szczegóły bez zmian, a
   „wariant spełnił filtr” i powrót z filtrami to osobna kontynuacja.
2. **Wyszukiwanie:** dzisiejszy podciąg plus nazwa wariantu (nazwa wyświetlana); nazwy techniczne wykluczone;
   `search_vector` bez zmian; limit 1000 w Explore zostaje.
3. **Kolekcje:** jedna karta na grupę; reprezentant = zapisany domyślny, inaczej pierwszy wg `sort_order`;
   „Usuń z kolekcji” usuwa tylko pokazany wariant (dialog z jego nazwą).

**Założenia (wariant rekomendowany):**
- A1. Grupowanie tylko przy fladze `recipe_variants` (R1); flaga wyłączona = brak zmian.
- A2. Grupowanie i wybór reprezentanta wykonuje backend (klient serwisowy), nie przeglądarka; bez zmian RLS;
  `recipe_details` rozszerzany tylko jeśli plan API tego wymaga.
- A3. Wyszukiwarka globalna jest objęta minimalnie (jeden wiersz na grupę, nazwa „Nazwa · wariant”, link wg R5),
  bo inaczej duplikowałaby grupy; bez nowego rankingu.
- A4. „pasują K z N” tylko przy K < N i aktywnym wyszukiwaniu/filtrze; do 3 nazw + „+X”; bez chipów cech.
- A5. W linku id w ścieżce i `?variant=` to id reprezentanta (spójne z PS-110).
- A6. Wskaźniki karty dotyczą reprezentanta (sortowanie/filtr po ocenie nie istnieje i nie jest dodawany; sekcja 3
  koncepcji o „sortowaniu po ocenie” do skorygowania w sekcji 8); akcje kart poza kolekcjami bez zmian.
- A7. Admin i `public/recipes/{id}` bez zmian; kontrakty tylko addytywnie, nowe pola opcjonalne.
- A8. Plan implementacji używa wspólnej funkcji grupowania kandydatów oraz
  addytywnego RPC dla paginacji „Moich przepisów”; przy wyszukiwaniu Explore
  limit 1000 wariantów pozostaje limitem przed grupowaniem. Nowe pola list
  (`variant_name`, N/K, skrót nazw) są opcjonalne i nie trafiają do odpowiedzi
  przy fladze wyłączonej.

## Otwarte kwestie dla planisty

1. **Technika grupowania przed paginacją:** Explore bez wyszukiwania (DB-level) i z wyszukiwaniem (w pamięci
   ≤1000 wierszy); nowe RPC/widok vs rozszerzenie istniejących; kursor (`filtersHash`, offset po grupach).
2. **`get_recipes_list`:** dopasowanie do nazwy wyświetlanej, jeden wiersz na grupę, `total_count` po grupach;
   nowe/przebudowane RPC `security definer` — `revoke`/`grant` tylko dla `service_role` i test uprawnień.
3. **Licznik przepisów na liście kolekcji** (jeśli istnieje) — domyślnie bez zmian; wyrównać do grup przy
   niskim koszcie.
4. **`deno check explore`** — dług typów naprawiać addytywnie, tylko dla używanych pól.

## Definition of Done

- GWT 1–23 pokryte testami jednostkowymi: `deno test` (grupowanie, paginacja, reprezentant, R2–R6, nazwy
  techniczne, widoczność, flaga, kolekcje, wyszukiwarka) i Vitest (karta, link, etykiety, dialog usuwania, stany
  listy). Bez E2E.
- Kontrakty addytywne w `shared/contracts/types.ts`; brak regresji bez flagi (GWT 3).
- `ng lint` i `ng build` przechodzą; `deno lint`/`deno check` dla `public`, `recipes`, `collections`, `search`
  bez nowych błędów.
- Test ręczny (admin z flagą `admin`): grupowanie, wyszukiwanie po nazwie wariantu, kolekcje, mobile, czytnik
  ekranu — wynik w weryfikacji.
- Aktualizacja `docs/variants-conception.md` (sekcja 8: stan PS-111) po implementacji.

## Historia zmian

| Data | Etap | Zmiana | Powód |
|---|---|---|---|
| 2026-11-21 | Analiza | Usunięto sortowanie/filtr po ocenie (R2, R6, GWT 9, A6) | Listy nie mają takich opcji (sort: created_at/name/relevance) |
| 2026-11-21 | Planowanie | Doprecyzowano implementację: wspólne grupowanie backendowe, grupowe liczniki przed limitem, addytywne DTO/RPC i zachowanie limitu 1000 wariantów w Explore | Rozstrzygnięcie otwartych kwestii planisty bez zmiany zachowania użytkownika |
