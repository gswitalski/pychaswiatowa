# PS-110 — plan implementacji widoków

## Cel i zakres

Dodać wspólny przełącznik wariantów do prywatnego `/recipes/:id` i
`/explore/recipes/:id`, obsłużyć parametr `?variant`, ratunek, zachowanie
kontekstu URL oraz akcje na faktycznie wyświetlanym wariancie. Zmiany
koncentrują się w `RecipeDetailViewComponent` i dwóch stronach szczegółów;
nie zmieniać list, wyszukiwania, `/public` ani widoku edycji.

## Etapy i pliki

1. **Dane i ładowanie**
   - rozszerzyć `RecipesService.getRecipeById` oraz
     `ExploreRecipesService.getExploreRecipeById` o opcjonalny `variant`;
   - strony obserwują `paramMap` i `queryParamMap`, przekazują parametr do
     właściwego endpointu, zachowują poprzedni `recipe` przy ładowaniu i
     ustawiają `isLoading` bez białego ekranu;
   - po odpowiedzi z ratunkiem poprawić ścieżkę do `recipe.id` tylko dla
     usuniętego `{id}`, a przy błędnym `variant` usunąć parametr; zawsze
     używać `replaceUrl` i `queryParamsHandling: 'merge'`;
   - zmodyfikować redirect gościa `/recipes/:id` tak, aby przenosił wszystkie
     query params, w szczególności `variant`.
2. **Wspólny przełącznik**
   - w `recipe-detail-view` dodać komponent/sekcję przełącznika pod nazwą
     przepisu, z `role`/kontrolką Material, etykietą „Wariant przepisu” i
     `aria-live` dla zmiany;
   - dla 1 wariantu nie renderować przełącznika, sufiksu tytułu ani tekstu
     „Zapisujesz wariant”; dla 2–3 użyć segmentów/zakładek, dla ≥4 listy
     rozwijanej z nazwą i chipami;
   - aktywny wariant wyznaczać z `recipe.id`, nie z id ścieżki; kliknięcie
     emituje wybór, strona ładuje pełne dane i aktualizuje `?variant=id`;
   - podczas przełączania pozostawić poprzednią treść z `opacity: 0.5`,
     zablokować kolejne wybory i po błędzie przywrócić aktywne zaznaczenie,
     URL oraz komunikat.
3. **Tytuł, ratunek i akcje**
   - `pageTitle` budować jako `Nazwa · variant_name` tylko przy co najmniej
     dwóch aktywnych wariantach; przekazać ten tytuł do nagłówka i `Title`;
   - nad przełącznikiem wyświetlić odrzucalny baner na podstawie
     `variant_resolution`, po przełączeniu go ukryć;
   - dodać tekst „Zapisujesz wariant: X” przy akcjach i oznaczyć akcje
     bieżącym `recipe.id`; `onEdit` przechodzi na `/recipes/{recipe.id}/edit`;
   - usuwanie grupy pokazać z liczbą aktywnych wariantów, zachowując istniejącą
     akcję backendową i przekierowanie po sukcesie.
4. **Notatka i dostępność**
   - przed przełączeniem zapytać `RecipeNoteComponent`, czy ma niezapisany
     draft; dialog Material ma akcje „Zapisz”, „Odrzuć”, „Anuluj”;
   - „Zapisz” zapisuje przez istniejący serwis, „Odrzuć” pozwala zmienić
     wariant, „Anuluj” nie zmienia zaznaczenia ani URL; po zmianie
     zresetować stan formularza notatki do danych nowego wariantu;
   - użyć klawiatury Material (strzałki/Enter/Spacja), skracania długich nazw,
     `title`/`aria-label`, responsywnego układu poniżej 600 px i zachować
     główną akcję planu w pierwszym kontekście przepisu.
5. **Testy Vitest**
   - testy serwisów parametrów i redirectu query params;
   - testy widoku dla GWT 13–27: progi, tytuł, wybór i URL, zachowanie
     poprzedniej treści, błąd, ratunek, gość, właściciel `SHARED`/`PRIVATE`,
     flaga bez listy, akcje na bieżącym id, usuwanie i dialog notatki;
   - testy dostępności: nazwa kontrolki, obsługa klawiatury, `aria-live`,
     długie nazwy oraz mobile w zakresie DOM/stylów;
   - uruchomić Vitest dla zmienionych komponentów/serwisów, `ng lint` i
     `ng build`; bez Playwrighta i bez `e2e/**`.

## Zmiany w komponentach

- `RecipeDetailViewComponent` otrzyma listę wariantów, stan wyboru,
  callback wyboru oraz sygnał/stan ratunku; pozostanie komponentem standalone
  z `OnPush`.
- `RecipeNoteComponent` dostanie mały interfejs przygotowania do zmiany
  przepisu, który atomowo rozstrzyga dirty draft i zwraca wynik
  `save`/`discard`/`cancel`; istniejący guard `unsavedChanges` nadal chroni
  opuszczenie strony.
- Obie strony szczegółów utrzymają własny stan ładowania i błędu, ale
  współdzielą identyczne reguły query params i wybór id z odpowiedzi.
- `RecipeHeaderComponent` pozostaje odpowiedzialny za nazwę/treść nagłówka;
  przełącznik nie powinien być ukryty w jego prezentacji, aby zachować
  osobny test zachowania URL i dostępności.

## Założenia

- Nazwa grupy jest w `recipe.name`, nazwa wariantu w `variant_name`; tytuł
  karty przeglądarki jest ustawiany przez istniejący mechanizm strony po
  `pageTitle`, bez nowego systemu metadanych.
- Przełączenie zawsze zapisuje `?variant={recipeId}`, także gdy wybrany id
  równa się id ścieżki; ścieżka pozostaje bez zmiany poza ratunkiem
  usuniętego `{id}`.
- Pozostałe parametry query są scalane, a nie zastępowane. Nie wolno
  przenosić danych z poprzedniej odpowiedzi do nowej poza wizualnym stanem
  ładowania.
- Przy fladze wyłączonej widok nie renderuje nowych elementów i zachowuje
  dotychczasowy układ; pola `variants`/`variant_resolution` są traktowane
  jako nieobecne.
- Baner ratunku jest zamykany lokalnie, ale ponowne pobranie z tym samym
  błędnym adresem może go ponownie wyświetlić; po wyborze wariantu znika.
- Zmiana widoczności w trakcie działania jest obsługiwana przez odpowiedź
  API: pozostanie na A przy błędzie lub pokaże standardowe `403`/`404`.
- „Usuń przepis” oznacza całą rodzinę wyłącznie na szczegółach; plan
  korzysta z istniejącego endpointu, a tekst dialogu opiera na
  `active_variant_count`.

## Ręczne sprawdzenie widoku

Po zakończeniu API ustawić flagę na `admin` i lokalnie sprawdzić jako
administrator: 1, 2, 4 warianty; przełączenie z dodatkowymi parametrami;
ratunek błędnego/usuniętego wariantu; akcje planu, kolekcji, flag, oceny,
notatki i edycji. Następnie sprawdzić gościa na `/recipes/:id?variant=B`,
`PUBLIC` oraz właściciela `PRIVATE`/`SHARED`. Zweryfikować błąd przełączenia,
dialog niezapisanej notatki, mobile, klawiaturę, fokus, czytnik ekranu,
opacity podczas ładowania i dialog usuwania z liczbą wariantów. Zapisać
status jako `PASS`, `FAIL`, `NIE_WYKONANO` albo `WYMAGA_WERYFIKACJI`.
