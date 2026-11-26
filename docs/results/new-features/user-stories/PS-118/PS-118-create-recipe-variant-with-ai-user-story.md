# PS-118: Wariant przepisu utworzony przez AI

## Opis

Jako **właściciel przepisu z włączonymi wariantami**,
chcę **dodać kolejną wersję z tekstu, zdjęć albo linku przez AI, przejrzeć ją i dopiero wtedy zapisać**,
aby **mieć trzecią drogę obok pustego formularza i kopii, bez ręcznego przepisywania składników i kroków**.

## Kontekst

Sekcja „Warianty” na edycji własnego przepisu (`:id/edit`) ma dziś dwa przyciski: „Dodaj pusty” i „Utwórz kopię”. Oba od razu tworzą wersję (nazwa z dialogu, kopia bierze treść otwartej wersji). Sekcja jest tylko przy fladze `recipe_variants` włączonej dla tego użytkownika (`disabled` / `admin` / `all` w `/me`). Grupa ma 1–10 aktywnych wersji; nazwa wersji ma 1–150 znaków i jest unikalna bez względu na wielkość liter. Nowa wersja nie jest domyślna i dostaje kolejność na końcu. Nazwa przepisu i widoczność należą do grupy.

Asysta nowego przepisu (`/recipes/new/assist`, tytuł „Dodaj przepis (AI)”) przyjmuje tekst, do pięciu zdjęć albo link i woła `POST /ai/recipes/draft` (pula `draft`: konto darmowe dożywotnio, Premium co miesiąc, administrator bez limitu). „Dalej” przy pustym tekście otwiera pusty formularz nowego przepisu. Udany szkic zużywa 1 kredyt; odrzucenie treści i błąd modelu albo sieci zwracają kredyt; walidacja rozmiaru zdjęcia jest przed rezerwacją. Szkic wypełnia formularz `/recipes/new`, a „Zapisz” prowadzi do szczegółów nowego, niezależnego przepisu. Ta asysta nie zna grupy wariantów i nie dostaje treści otwartego przepisu.

## Zakres

1. Trzeci przycisk „Dodaj z AI” w sekcji „Warianty”, obok „Dodaj pusty” i „Utwórz kopię”.
2. Ekran „Dodaj wariant przepisu (AI)” z tymi samymi trybami co asysta nowego przepisu: tekst, obraz, link URL.
3. Po „Dalej” formularz przeglądu szkicu w grupie otwartego przepisu. Wersja powstaje w bazie i na liście dopiero po „Zapisz”.
4. Zapis tej wersji: pola ze szkicu, nazwa wersji z tytułu AI, wspólna nazwa i widoczność grupy bez podmiany przez AI, brak okładki ze zdjęć źródłowych.
5. Rozliczenie istniejącej puli `draft` oraz te same komunikaty kredytów, odrzucenia treści, rozmiaru zdjęcia i sieci co przy nowym przepisie.
6. Testy jednostkowe zmienianego UI i API.

## Poza zakresem

- Polecenie przebudowy otwartej wersji (np. „zrób wegetariańską”) i wysyłanie jej treści do modelu.
- Nowe generowanie okładki, import Markdown, nowa pula kredytów, zmiana domyślnego stanu flagi wariantów.
- Zmiana zachowania „Dodaj pusty”, „Utwórz kopię” i `/recipes/new/assist`.

## Zależności

PS-108 (grupa), PS-109 (flaga, limit 10, unikalna nazwa, pusty formularz i kopia), PS-64 (pula `draft`), PS-91 / PS-97 / PS-100 (szkic: metadane, link, do pięciu zdjęć).

## Kryteria akceptacji

### Wejście i zapis

1. **Tekst, przegląd, zapis.** *Given* właściciel edytuje własną wersję, flaga jest dla niego włączona, w grupie jest mniej niż 10 wersji i ma kredyt `draft`, *When* wybiera „Dodaj z AI”, wkleja tekst jednego przepisu, klika „Dalej”, a na formularzu „Zapisz”, *Then* ekran ma tytuł „Dodaj wariant przepisu (AI)” i podtytuł, że powstanie kolejna wersja tego przepisu; model dostaje tylko ten tekst; po „Dalej” otwiera się formularz, a listy wersji jeszcze nie przybywa; „Zapisz” dodaje wersję na końcu, bez znacznika domyślnej, i otwiera jej szczegóły (`/recipes/{id}-{slug}`). Udane generowanie zużywa 1 kredyt `draft` także wtedy, gdy użytkownik później nie zapisze.
2. **Co trafia do nowej wersji.** *Given* szkic z scenariusza 1, *When* formularz się otwiera, *Then* pole „Wariant” ma tytuł ze szkicu; „Nazwa przepisu” i widoczność zostają jak w grupie; opis, składniki, kroki, wskazówki, tagi, porcje, czasy, dieta, kuchnia i trudność pochodzą wyłącznie ze szkicu, a brakujące teksty i liczby są puste. Kategoria ustawia się tylko przy dopasowaniu nazwy do istniejącej kategorii (bez wielkości liter). Termorobot i grill są zaznaczone tylko, gdy szkic je podał. Zdjęcia źródłowe nie są okładką. Otwarta wcześniej wersja, jej kolekcje, oceny, plan, lista zakupów i notatki pozostają bez zmian; pozostałe wersje zachowują swoje nazwy.
3. **Obraz i link.** *Given* ten sam właściciel na ekranie z scenariusza 1, *When* wybiera „Obraz” albo „Link URL”, *Then* limity, wklejanie ze schowka, kompresja, kolejność do pięciu zdjęć, walidacja adresu, ostrzeżenia o nieczytelnym zdjęciu oraz 1 kredyt za całe wywołanie działają jak na `/recipes/new/assist`. Model dostaje tylko te zdjęcia albo ten link. „Dalej” nie otwiera pustego formularza nowego przepisu.

### Nawigacja

4. **„Wróć” i nieaktywne „Dalej”.** *Given* ekran AI wariantu bez udanego generowania, *When* użytkownik klika „Wróć” albo nie podał tekstu, gotowego zdjęcia ani poprawnego linku, *Then* „Wróć” wraca do edycji wersji, z której wyszedł, bez nowej wersji i bez kredytu; „Dalej” jest nieaktywne. W trakcie generowania ponowne „Dalej” i zmiana źródła są zablokowane, jak na asyście nowego przepisu.
5. **Niezapisana edycja.** *Given* formularz otwartej wersji ma niezapisane zmiany, *When* użytkownik klika „Dodaj z AI”, *Then* dostaje ten sam wybór co przy przejściu do innej wersji: „Zapisz zmiany”, „Odrzuć” albo „Anuluj”. Zapis otwiera ekran AI po udanym zapisie; niepoprawny formularz zostaje na edycji i jest oznaczony, jak przy zmianie wersji. Odrzucenie otwiera ekran AI bez zapisu. Anulowanie zostawia edycję.
6. **Wyjście z przeglądu.** *Given* formularz przeglądu po udanym generowaniu nie został zapisany, *When* użytkownik wychodzi z niego, *Then* nowa wersja nie powstaje, a kredyt zostaje zużyty. Przy brudnym formularzu wybór jest ten sam co w scenariuszu 5: zapis tworzy wersję, odrzucenie wraca do edycji źródłowej bez wersji, anulowanie zostawia przegląd.

### Nazwa, limit, kredyty

7. **Pole „Wariant”.** *Given* w grupie jest jedna albo więcej wersji, *When* otwiera się przegląd, *Then* pole „Wariant” jest widoczne i wymagane także przy jednej dotychczasowej wersji. Pusty tytuł AI zostawia je puste i blokuje „Zapisz”. Nazwa zajęta w grupie (bez wielkości liter, po obcięciu spacji, 1–150 znaków) blokuje zapis; użytkownik poprawia pole, a system nie dopisuje „(2)”. Ręczna zmiana „Nazwy przepisu” albo widoczności przy tym zapisie obejmuje całą grupę, jak dziś.
8. **Dziesięć wersji.** *Given* grupa ma już 10 aktywnych wersji, *When* użytkownik klika „Dodaj z AI” albo „Dalej”, *Then* model nie startuje, kredyt nie schodzi, ekran generowania się nie otwiera przy kliknięciu przycisku, a komunikat jest ten sam co przy odrzuconym „Dodaj pusty” lub „Utwórz kopię”. *Given* limit zapadnie dopiero przy „Zapisz”, *Then* wersja nie powstaje, formularz zostaje, a kredyt za wcześniejsze udane generowanie pozostaje zużyty.
9. **Kredyty i błędy ekranu AI.** *Given* właściciel na ekranie AI wariantu, *When* kończą się kredyty, treść nie jest jednym przepisem, zdjęcie jest za duże albo sieć lub model zawiedzie, *Then* zostaje na tym ekranie: wskaźnik, baner wyczerpania i dialog braku kredytów jak przy nowym przepisie; „Dalej” nie woła modelu przy pustej puli. Zbyt duże zdjęcie nie rezerwuje kredytu. Odrzucenie treści oraz błąd sieci lub modelu po rezerwacji zwracają kredyt. Tekst, zdjęcia i link zostają do poprawki.

### Dostęp i regresja

10. **Kto widzi przycisk.** *Given* flaga wyłączona, tryb „tylko administrator” dla zwykłego konta, gość albo przepis cudzy, *When* użytkownik otwiera edycję, *Then* przycisku „Dodaj z AI” nie ma, a wywołanie zapisu wersji z tego przepływu nie tworzy wiersza i nie pobiera kredytu. Właściciel korzysta ze swojej puli `draft` (darmowe dożywotnio, Premium co miesiąc, administrator bez limitu).
11. **Bez regresji.** *Given* „Dodaj pusty”, „Utwórz kopię” oraz `/recipes/new/assist`, *When* użytkownik z nich korzysta, *Then* puste i kopia nadal tworzą wersję od razu, a pusty tekst na asyście nowego przepisu nadal otwiera pusty formularz `/recipes/new`.

## Przypadki brzegowe

- Lista wersji jeszcze się ładuje: „Dodaj z AI” nie woła modelu, dopóki liczba wersji nie jest znana.
- Jedyna istniejąca wersja nazywa się „Wariant podstawowy”: zapis AI jej nie przemianowuje.
- Wartość diety, kuchni albo trudności spoza słownika zostaje pusta, jak przy szkicu nowego przepisu.
- Na przeglądzie użytkownik może dodać okładkę dotychczasowymi polami formularza (plik albo zdjęcie AI z puli `image`). To nie jest nowe generowanie okładki i nie używa zdjęć z asysty.
- Na przeglądzie nie ma „Dodaj pusty”, „Utwórz kopię” ani „Dodaj z AI”.
- Wąski ekran używa układu asysty i formularza. Przycisk ma dostępną nazwę „Dodaj z AI”.
- Grupa `PUBLIC`: nowa wersja jest publiczna razem z grupą, bez osobnego przełącznika.

## Decyzje i założenia

### Decyzje użytkownika

1. Wersja pojawia się na liście dopiero po „Zapisz”. „Dalej” tylko otwiera przegląd. Odejście bez zapisu nic nie dodaje. Kredyt za udane generowanie zostaje zużyty.
2. Tytuł AI jest nazwą nowego wariantu. Wspólna nazwa przepisu i widoczność zostają do ręcznej zmiany. Pozostałe wersje zachowują dotychczasowe nazwy wariantów.

### Założenia z rundy pytań

1. Przycisk jest w sekcji „Warianty” na edycji istniejącego przepisu, z etykietą „Dodaj z AI”, tylko przy fladze włączonej dla tego użytkownika.
2. Ekran ma tytuł „Dodaj wariant przepisu (AI)” i tryby: tekst, obraz (do pięciu zdjęć, schowek, te same limity rozmiaru), link URL. Podtytuł mówi o kolejnej wersji tego przepisu. Wskaźnik kredytów, baner i dialog braku kredytów działają jak przy nowym przepisie.
3. „Wróć” wraca do edycji wersji źródłowej bez nowej wersji. „Dalej” czeka na tekst, gotowe zdjęcie albo poprawny link.
4. AI nie dostaje treści otwartej wersji. Nowa wersja dostaje wyłącznie pola szkicu wymienione w scenariuszu 2. Zdjęcia źródłowe służą do odczytu.
5. Bieżąca wersja i jej kolekcje, oceny, plan, lista zakupów oraz notatki zostają. Nowa wersja nie jest domyślna i ląduje na końcu. Widoczność grupy zostaje.
6. Wyjście z edycji z niezapisanymi zmianami ma wybór: zapisz, odrzuć albo zostań.
7. Przy 10 wersjach AI nie startuje i kredyt nie schodzi. Zajęta nazwa (1–150, bez wielkości liter) blokuje zapis; użytkownik poprawia „Wariant”; system nie dopisuje „(2)”. Pusty tytuł zostawia pole puste.
8. Pole „Wariant” jest widoczne i wymagane także przy jednej dotychczasowej wersji. Po „Zapisz” użytkownik przechodzi do szczegółów tej wersji.
9. Dostęp ma właściciel, na tej samej puli `draft`. Błąd „to nie jest jeden przepis”, zbyt duże zdjęcie i błąd sieci zostają na ekranie AI; przy odrzuceniu treści kredyt wraca.

### Założenia doprecyzowane przy zapisie

1. Podtytuł: „Powstanie kolejna wersja tego przepisu. AI odczyta tylko wklejony tekst, zdjęcia albo link.” Ekran nie jest `/recipes/new/assist`; adres ustala plan implementacji.
2. Ręczna zmiana wspólnej nazwy lub widoczności na przeglądzie, zapisana razem z nową wersją, obejmuje całą grupę tak jak dzisiejszy zapis przepisu.
3. Wybór zapisz / odrzuć / zostań dotyczy też wyjścia z brudnego formularza przeglądu (scenariusz 6), bo kredyt jest już zużyty.
4. Istniejące pola okładki na formularzu zostają. Historyjka nie dodaje generowania okładki ze zdjęć asysty.
5. Nazwa techniczna „Wariant podstawowy” jedynej istniejącej wersji nie jest wymuszana do zmiany.
6. Zbyt duże zdjęcie nie rezerwuje kredytu (jak dzisiejsza walidacja przed rezerwacją). Zwrot po rezerwacji dotyczy odrzucenia treści oraz błędu modelu lub sieci.

## Definition of Done

- Scenariusze 1–11 mają testy jednostkowe Vitest (przycisk, nieaktywne „Dalej”, przejście na przegląd, pola szkicu, nazwa wersji, brak zapisu przy wyjściu, limit 10, kredyty) oraz `deno test` tam, gdzie zapis wersji lub szkic dostaje nową ścieżkę. Bez testów E2E.
- `ng lint` i `ng build` przechodzą. `deno lint` / `deno check` dla zmienianych funkcji bez nowych błędów.

## Historia zmian

| Data | Etap | Zmiana | Powód |
|---|---|---|---|
