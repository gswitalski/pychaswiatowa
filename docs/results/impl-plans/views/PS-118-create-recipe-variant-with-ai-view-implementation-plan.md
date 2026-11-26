# PS-118 — plan implementacji widoków

## Cel i routing

Dodać przepływ „Dodaj z AI” z edycji własnego wariantu, z przeglądem
formularza i zapisem dopiero po `Zapisz`. Istniejące `/recipes/new/assist`,
„Dodaj pusty”, „Utwórz kopię” i formularz niezależnego przepisu zachowują
obeczne zachowanie.

Nowa trasa, przed `:id/edit`:

```text
/recipes/:id/edit/assist → RecipeVariantAiAssistPageComponent
/recipes/:id/edit        → RecipeFormPageComponent (tryb przeglądu przez stan draftu)
```

Trasa wymaga uwierzytelnienia tak jak edycja. `id` jest wariantem źródłowym;
backend i formularz pozostają źródłem prawdy dla własności oraz flagi.
`Wróć` wraca do `/recipes/:id/edit`. Po udanym generowaniu kredyt jest
odświeżany, szkic trafia do istniejącego `RecipeDraftStateService` wraz z
`variantContext`, a nawigacja prowadzi z powrotem do edycji źródła w trybie
przeglądu — bez wywołania zapisu wariantu.

## Pliki i komponenty

- `src/app/pages/recipes/recipes.routes.ts`
- nowy standalone
  `recipe-variant-ai-assist/recipe-variant-ai-assist-page.component.ts`,
  `.html`, `.scss`, `.spec.ts` (selector `pych-recipe-variant-ai-assist-page`)
- `recipe-new-assist` — wydzielenie wspólnego kontrolera/fragmentów źródeł
  tekst/obraz/URL albo współdzielenie serwisu; nie kopiować logiki kredytów,
  walidacji obrazów i komunikatów
- `recipe-form/recipe-form-page.component.ts/.html/.scss/.spec.ts`
- `recipe-form/components/recipe-variants-section/*`
- `services/recipe-draft-state.service.ts`
- `services/recipes.service.ts`
- `shared/contracts/types.ts` według planu API

## Widok wejściowy AI

Nowa strona używa tych samych trybów i elementów co istniejąca asysta:
tekst, obraz do 5 zdjęć ze schowkiem/kompresją/kolejnością oraz link URL;
wskaźnik, baner i dialog wyczerpania puli `draft`; komunikaty 400/402/413/422
oraz błędy sieci/modelu. Podtytuł:
„Powstanie kolejna wersja tego przepisu. AI odczyta tylko wklejony tekst,
zdjęcia albo link.”

`Dalej` jest nieaktywne przy pustym wejściu, nieznanej liczbie wariantów,
10 aktywnych wariantach, generowaniu lub błędzie walidacji. W trakcie
generowania blokowane są zmiana źródła i ponowne `Dalej`. Model dostaje
wyłącznie dane z bieżącego wejścia, nigdy treść wariantu źródłowego.
Przy powrocie bez udanego generowania nie ma wywołania API zapisu i nie
schodzi kredyt. Po udanym generowaniu kredyt jest zużyty również po wyjściu
bez zapisu.

Stan obrazów i komunikaty powinny reuse’ować stałe/serwisy PS-100; UI nie
tworzy okładki z przesłanych zdjęć.

## Przegląd w formularzu przepisu

`RecipeDraftStateService` przechowuje:

- `draft` i `meta` istniejącego kontraktu;
- `variantContext: { sourceRecipeId, familyName, visibility }`.

`RecipeFormPageComponent` rozpoznaje kontekst po wejściu w edycję i po
załadowaniu źródłowego przepisu:

- pozostawia `Nazwa przepisu` i widoczność z rodziny, ale pozwala je ręcznie
  zmienić; ich zapis dotyczy całej rodziny jak dziś;
- pokazuje wymagane pole `Wariant` także przy jednej wersji i ustawia je
  tytułem AI; pusty/duplikat po trim i bez względu na wielkość liter blokuje
  `Zapisz` bez dopisywania „(2)”;
- wypełnia opis, składniki, kroki, wskazówki, tagi, porcje, czasy, dietę,
  kuchnię, trudność i flagi wyłącznie szkicem; brakujące wartości są puste;
- mapuje kategorię wyłącznie przez dopasowanie nazwy bez wielkości liter;
- nie przenosi obrazu źródłowego do nowego wariantu, ale zachowuje istniejące
  pole okładki formularza, jeśli użytkownik świadomie doda plik/obraz;
- nie zmienia danych źródłowego wariantu ani jego kolekcji, ocen, planu, listy
  zakupów i notatek.

W trybie przeglądu sekcja „Warianty” nie pokazuje przycisków tworzenia.
`Wróć`/anulowanie nie zapisuje nowego wiersza. Jeśli formularz jest brudny,
wyjście pokazuje istniejący wybór „Zapisz zmiany” / „Odrzuć” / „Anuluj”:
zapis używa nowego endpointu AI jako jednej operacji, odrzucenie wraca do
edycji źródła, anulowanie pozostawia przegląd. Po sukcesie nawigacja prowadzi
do `/recipes/{newId}-{slug}`.

## Sekcja wariantów

W `RecipeVariantsSectionComponent` dodać trzeci przycisk `Dodaj z AI` obok
istniejących akcji. Renderować go wyłącznie po potwierdzeniu flagi
`recipe_variants`, właściciela i zakończeniu ładowania listy. Przy nieznanej
liczbie wariantów akcja jest wyłączona; przy 10 wariantach nie otwiera AI i
pokazuje ten sam komunikat domenowy co pozostałe tworzenia.

Kliknięcie emituje `aiVariantRequest`. `RecipeFormPageComponent` obsługuje
go tak samo jak zmianę wariantu: przy formularzu czystym przechodzi od razu,
przy brudnym otwiera wybór zapisu/odrzucenia/anulowania; niepoprawny zapis
zostaje na edycji z oznaczonymi polami. Dodać output/input tylko tam, gdzie
potrzebne (`input.required`, `output`), sygnały `busy/loading/error`; zachować
OnPush, standalone i prefiksy `pych`.

## API i błędy

`AiRecipeDraftService` nadal woła `POST /ai/recipes/draft` i mapuje te same
błędy kredytów, obrazów, 422 i sieci co asysta nowego przepisu. `RecipesService`
dodaje `createAiRecipeVariant(sourceId, command)` przez
`supabase.functions.invoke('recipes/{id}/variants/ai', { method: 'POST' })`,
mapując status i kod domenowy bez utraty `409`.

DTO zapisu i kody endpointu są opisane w planie API; plan widoku nie kopiuje
ich definicji. Formularz nie ufa lokalnemu limitowi ani nazwie: po odpowiedzi
API odświeża/opuszcza widok, a `400/404/409/422/500` pozostawia formularz,
listę i szkic do poprawki. Porażka zapisu nie zwraca kredytu, bo został
zużyty przy wcześniejszym udanym generowaniu.

## Responsywność, dostępność i stany

- układ asysty i formularza jak dla `/recipes/new/assist`, jednokolumnowy na
  wąskim ekranie;
- loading zachowuje istniejące dane, blokuje akcje i ma `aria-live`;
- pusta lista wariantów, lista ładowana, limit 10, błąd API i niepoprawny
  formularz mają czytelny komunikat inline;
- przycisk ma nazwę dostępną „Dodaj z AI”, wszystkie akcje mają fokus,
  `aria-label`, `disabled` i stan busy; pole `Wariant` ma komunikat
  wymagania/konfliktu;
- powrót i nawigacja nie mogą tworzyć wariantu ubocznie.

## Testy Vitest

- wejście: przycisk ukryty przy fladze wyłączonej/cudzym przepisie, widoczny
  dla właściciela, blokada przy ładowaniu listy i 10 wariantach —
  scenariusze **4, 8, 10**;
- AI: trzy źródła, tekst nie zawiera treści źródłowego wariantu, nieaktywne
  `Dalej`, blokada podczas generowania, limity zdjęć, 413/402/422/sieć,
  zwrot kredytu tylko dla błędów generowania —
  **1, 3, 4, 8, 9**;
- przejście do przeglądu: szkic trafia do formularza, lista nie rośnie,
  kredyt pozostaje rozliczony, wyjście bez zapisu nie tworzy wariantu —
  **1, 5, 6**;
- mapowanie formularza: pola szkicu, pusta kategoria/numerowe wartości,
  termorobot/grill, brak obrazu źródłowego, zachowanie danych rodziny i
  źródłowego wariantu — **2**;
- nazwa wariantu: widoczna przy jednej wersji, tytuł AI, wymaganie,
  trim/case-insensitive konflikt, brak „(2)”, limit zapisu —
  **2, 7, 8**;
- wyjście brudnego formularza: zapisz/odrzuć/anuluj, niepoprawny formularz
  zostaje na miejscu, udany zapis na końcu i nawigacja slugiem —
  **5, 6, 7**;
- serwis `RecipesService`: metoda, URL, body, mapowanie `201/400/404/409/500`;
  regresja pustego wariantu, kopii i `/recipes/new/assist` —
  **10, 11**.

Uruchomić Vitest dla zmienionych plików, `ng lint` i `ng build`. Bez E2E.

## Założenia

- Wspólny komponent asysty może zostać wydzielony z obecnej strony, aby
  przepływ nowego przepisu i wariantu nie rozjechał się funkcjonalnie; nie
  tworzyć drugiej implementacji kredytów/obrazów.
- Stan draftu wariantu jest jednorazowy i wygasa po wejściu do formularza albo
  opuszczeniu przepływu; nie trafia do URL ani Storage.
- „Zapisz zmiany” w brudnym przeglądzie oznacza jedną transakcję nowego
  endpointu, a nie najpierw update źródła i potem utworzenie wariantu.
- Widoczność `PUBLIC` jest wspólna dla rodziny; nie renderować przełącznika
  widoczności pojedynczego wariantu.
- Po błędzie zapisu kredyt nie jest zwracany, zgodnie z decyzją historyjki.

## Czynności ręczne

Po implementacji API i uruchomieniu aplikacji ustawić flagę `admin`.
Zweryfikować jako właściciel: wejście „Dodaj z AI”, tekst/obraz/link, limit
zdjęć i kredytów, przegląd bez nowej pozycji, zapis z nazwą wariantu, ręczną
zmianę nazwy/widoczności, wyjście bez zapisu, brudny formularz oraz nawigację
do szczegółów. Sprawdzić jako zwykły użytkownik bez dostępu, przy 10
wariantach i przy błędzie nazwy. Sprawdzić desktop/wąski ekran, klawiaturę,
fokus i etykiety czytnika ekranu. Zapisać status jako `PASS`, `FAIL`,
`NIE_WYKONANO` albo `WYMAGA_WERYFIKACJI`.
