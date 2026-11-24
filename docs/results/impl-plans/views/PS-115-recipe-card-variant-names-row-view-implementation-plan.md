# PS-115 — plan implementacji widoków

## Cel i zakres

Wspólna karta ma pokazywać przy co najmniej dwóch dostępnych wariantach jeden
wiersz pełnych nazw, połączonych separatorem ` · `. Szczegóły mają usuwać
wyłącznie napisy „w planie” i „ocena N” ze stanów przy przełączniku. Zakres
widoków obejmuje GWT 1–11; dane list i overflow opisuje plan API.

## Pliki i etapy

1. **Model i mapper karty**
   - W `src/app/shared/components/recipe-card/recipe-card.ts` zachować
     istniejące pola DTO, ale dodać computed dla oczyszczonej listy nazw,
     pełnego wiersza i warunku renderowania.
   - W `recipe-card.mapper.ts` nadal przekazywać `matching_variant_names`;
     nie deduplikować ani nie sortować danych po stronie klienta.
   - W `recipe-card.html` usunąć osobny wiersz `variantName` i licznik/
     podsumowanie. Renderować jeden `p.recipe-variant-summary` tylko dla
     `activeVariantCount >= 2` i co najmniej jednej niepustej nazwy.
     Tekst ma być `names.join(' · ')`, a `title` i `aria-label` mają zawierać
     pełny wiersz oraz nazwę przepisu.
   - W `recipe-card.scss` nadać wierszowi jedną linię, `overflow: hidden`,
     `text-overflow: ellipsis` i `white-space: nowrap`; zachować układ karty,
     kategorię, zdjęcie, chipy i responsywność.
2. **Wszystkie użycia karty**
   - Zweryfikować mapowanie w Moich przepisach, Eksploruj, kolekcjach,
     pulpicie i wynikach publicznych. Każdy kontekst ma korzystać z tego
     samego komponentu i pól planu API.
   - Nie zmieniać linku, zdjęcia ani `?variant=`: `recipe.id` pozostaje
     dotychczasowym reprezentantem. Nie przenosić pełnej listy do sidebaru,
     omniboxu, planu, listy zakupów, formularza ani tabeli administratora.
   - Zachować loading, error, empty, flagę funkcji, akcję kolekcji i
     wskaźniki karty.
3. **Stany szczegółów**
   - W `src/app/shared/components/recipe-detail-view/recipe-detail-view.component.html`
     w obu miejscach `variant-state` usunąć warunki `in_plan` i `my_rating`.
   - Sprawić, aby `span.variant-state` nie był tworzony, gdy nie ma żadnego
     z czterech pozostałych stanów: `is_favorite`, `wants_to_try`,
     `in_collection`, `has_note`. Nie zmieniać `user_action_state`, widgetu
     oceny, przycisku planu, przełącznika ani odświeżania aktywnego wariantu.
4. **Dostępność i responsywność**
   - Pełny tekst nazw i nazwy przepisu pozostają dostępne przez `title` oraz
     etykietę linku karty; techniczna nazwa wariantu jest traktowana jak
     każda inna, jeśli nie jest pusta.
   - Na wąskim ekranie wizualnie pozostaje jedna linia z wielokropkiem;
     brak nazw po `trim()` nie renderuje pustego elementu.

## Testy Vitest

- `recipe-card.spec.ts` i `recipe-card.mapper.spec.ts`:
  - GWT 1, 3, 4, 5, 6, 7 — dwa/cztery warianty, separator, kolejność
    otrzymana z API, filtr/kolekcja, techniczna nazwa, pełne `title` i
    `aria-label`, brak licznika, brak osobnego `variantName`, link i
    `?variant=`.
  - GWT 2 — jeden wariant, w tym „Wariant podstawowy”, bez wiersza i bez
    parametru wariantu.
  - GWT 8 — brak nazw/wyłączona flaga oraz brak pustego wiersza; istniejące
    stany ładowania, błędu i pustej listy pozostają bez zmian w testach stron.
- `recipe-detail-view.component.spec.ts`:
  - GWT 9 — przy 2–3 wariantach zostają cztery dozwolone stany, a „w planie”
    i „ocena N” nie są renderowane; pusty span nie istnieje.
  - GWT 10 — przy 4+ aktywny wariant z samym planem i oceną nie renderuje
    spanu, a wariant z kolekcją renderuje „w kolekcji”.
  - GWT 11 — widget oceny, przycisk planu i przełącznik nadal są obecne.
- Uruchomić Vitest dla zmienionych plików, następnie `ng lint` i `ng build`.
  Nie planować ani uruchamiać E2E.

## Odwołanie do API

Nazwy i `matching_variant_overflow` pochodzą wyłącznie z planu API; komponent
nie rekonstruuje listy i nie używa overflow do renderowania. DTO pozostaje
addytywne i bezpieczne dla odpowiedzi z wyłączoną flagą.

## Założenia

- Wiersz renderuje się, gdy grupa ma co najmniej dwa aktywne warianty i
  przynajmniej jedną nazwę niepustą po `trim()`; przy zerze nazw zostaje
  link/reprezentant bez pustego elementu.
- Wiersz pokazuje nazwy pasujące do filtra, a bez filtra nazwy rodziny;
  kolejność i limit 10 gwarantuje API.
- Nazwa reprezentanta nie jest wyróżniana, nawet gdy zdjęcie i link prowadzą
  do innego wariantu niż pierwsza nazwa.
- Stany osobiste pozostają w DTO i w logice akcji; zmienia się tylko tekst
  `variant-state`.
- Istniejące klasy CSS mogą zostać zachowane, o ile spełniają jednowierszowe
  ucięcie; nie tworzyć nowego komponentu ani routingu.

## Czynności ręczne widoku

Po uruchomieniu lokalnej aplikacji i API:

1. Ustawić flagę wariantów i sprawdzić kartę w Moich przepisach, Eksploruj,
   kolekcji, pulpicie i wynikach publicznych dla N=1, N=2, N=4 oraz rodziny
   z nazwą techniczną. Potwierdzić jeden wiersz, separator ` · `, brak liczby,
   brak osobnej nazwy reprezentanta i brak `+N`.
2. Wykonać wyszukiwanie/filtr, w którym pasują tylko dwa z trzech wariantów,
   oraz kolekcję zawierającą dwa z trzech. Potwierdzić odpowiednio tylko
   nazwy pasujące i tylko nazwy zapisane.
3. Sprawdzić długie nazwy na wąskim ekranie: jeden wiersz z wielokropkiem,
   pełny tekst w podpowiedzi i etykiecie czytnika ekranu razem z nazwą
   przepisu. Sprawdzić klawiaturę i link `?variant=`.
4. Na szczegółach sprawdzić 2–3 warianty oraz 4+ wariantów. Potwierdzić
   brak „w planie” i „ocena N”, brak pustego spanu oraz działanie widgetu
   oceny, przycisku planu i przełącznika.
5. Powtórzyć z wyłączoną flagą, gościem, pustą listą i błędem; potwierdzić
   dotychczasowe komunikaty. Wynik oznaczyć jako `PASS`, `FAIL`,
   `NIE_WYKONANO` albo `WYMAGA_WERYFIKACJI`. Nie wykonywać E2E.
