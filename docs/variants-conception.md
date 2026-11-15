# Koncepcja wariantów przepisów

## 1. Cel i zakres

Przepis może mieć kilka pełnych wersji, które różnią się nie tylko etykietą,
ale również wszystkimi danymi operacyjnymi: składnikami, krokami, zdjęciem,
czasem, dietą, urządzeniem lub innymi cechami.

Przykłady:

- „Lasagne” — klasyczna i wegetariańska,
- „Ciasto czekoladowe” — zwykłe i bezglutenowe,
- „Zupa krem” — wariant z termorobotem i bez termorobota.

Wariant nie powinien być alternatywnym zestawem pól w jednym rekordzie.
Powinien być osobnym przepisem w sensie danych, ale należeć do wspólnej grupy
prezentowanej użytkownikowi jako jeden przepis.

Decyzje przyjęte w tej analizie:

- model „grupa przepisu + osobne warianty”,
- wspólna nazwa grupy oraz osobna nazwa każdego wariantu,
- powód wariantowości w wersji 1 to wyłącznie nazwa wariantu; chipy cech są
  wyliczane z istniejących pól przepisu, a słownik powodów jest przyszłym
  rozszerzeniem,
- działania użytkownika przypisane do wybranego wariantu,
- istniejące przepisy migrowane jako grupy z jednym wariantem,
- adres `/recipes/{id}` nie zmienia znaczenia: `{id}` jest zawsze
  identyfikatorem przepisu (wariantu),
- widoczność (`PRIVATE`, `SHARED`, `PUBLIC`) jest wspólna dla grupy,
- kopia „bez synchronizacji”: wspólne treści (opis, porady, tagi, kategoria)
  są kopiowane przy tworzeniu wariantu i potem edytowane niezależnie.

Dokument opisuje koncepcję produktu, UI, architektury oraz kolejność
przyszłych historyjek. Nie jest planem implementacji ani specyfikacją API.

### Zmiany względem poprzedniej wersji

- Dodano obsługę widoczności `SHARED` (istnieje w enumie `recipe_visibility`).
- Rozstrzygnięto adresy: `{id}` pozostaje identyfikatorem przepisu, wariant
  wybiera opcjonalny parametr. Usuwa to ryzyko kolizji ID grupy z ID przepisu.
- Wariant domyślny to kolumna `is_default` na przepisie z unikalnością,
  a nie `default_recipe_id` w grupie (brak cyklu kluczy).
- Jedno źródło prawdy dla nazwy i widoczności; `recipes.name` i
  `recipes.visibility` zostają jako kopie zarządzane przez backend.
- Wyszukiwanie po nazwie grupy ma jawny mechanizm (rozszerzony
  `search_vector`).
- Słownik powodów wariantowości odłożono; w v1 jest nazwa wariantu i chipy
  z istniejących pól.
- Dopisano zasady usuwania i przywracania, kopiowania zdjęć, ograniczeń
  danych, ocen na karcie i limitu planu.
- Zmieniono kolejność historyjek: zabezpieczenia przed ekspozycją, grupowanie
  wszystkich list przed włączeniem funkcji, testy w każdej historyjce.

## 2. Model pojęciowy

### Grupa przepisu

Grupa jest tożsamością logiczną przepisu, którą użytkownik rozpoznaje na
liście i w wyszukiwaniu. Przechowuje:

- wspólną nazwę, np. „Lasagne” (źródło prawdy),
- właściciela,
- widoczność grupy (`PRIVATE`, `SHARED`, `PUBLIC`) — źródło prawdy,
- stan usunięcia grupy,
- identyfikator używany do grupowania wyników.

Grupa nie przechowuje składników ani kroków. Te dane należą do wariantu.
Identyfikator grupy jest używany wyłącznie wewnętrznie (grupowanie, operacje
grupowe) i nie pojawia się w adresach przeglądarki.

### Wariant

Wariant pozostaje pełnym przepisem i nadal jest rekordem `recipes` z
dotychczasowym identyfikatorem. Przechowuje własne:

- nazwę wariantu, np. „Klasyczna”,
- składniki, kroki i wskazówki,
- zdjęcie (własny plik w Storage),
- liczbę porcji i czasy,
- dietę, kuchnię, trudność i cechy typu termorobot,
- tagi, kolekcje i pozostałe istniejące atrybuty przepisu,
- znacznik wariantu domyślnego i kolejność w grupie.

Pola, które dziś pełnią rolę wspólną, są zarządzane przez grupę:

- `recipes.name` pozostaje jako zdenormalizowana kopia nazwy grupy,
  ustawiana wyłącznie przez backend (trigger lub RPC) przy zmianie nazwy
  grupy. Dzięki temu widoki, plan, lista zakupów, panel admina i filtry po
  kolumnach działają bez zmian,
- `recipes.visibility` pozostaje jako kopia widoczności grupy, ustawiana
  wyłącznie przez operację grupową. Bezpośrednia zmiana widoczności wariantu
  jest blokowana.

Nazwa wyświetlana składa się jako:

> Lasagne · Klasyczna

Jeśli grupa ma tylko jeden wariant, widoczne jest dotychczasowe „Lasagne”
bez sufiksu. Wariant ma jednak nazwę zawsze. Wariant migrowany dostaje nazwę
techniczną „Podstawowa”. Gdy użytkownik dodaje drugi wariant, formularz
prosi o zmianę nazwy pierwszego, aby nazwa „Podstawowa” nie pozostała
w widocznych etykietach.

### Zasady danych

- Nazwa wariantu jest wymagana i unikalna w grupie (bez rozróżniania wielkości
  liter, z pominięciem usuniętych wariantów).
- Grupa ma limit liczby aktywnych wariantów (propozycja: 10), egzekwowany
  w backendzie.
- Wariant domyślny jest dokładnie jeden w grupie (aktywnych wariantów).
- Właściciel grupy i wariantu jest zawsze ten sam; spójność wymusza klucz
  złożony (grupa, właściciel).
- Wspólne treści są kopiowane przy tworzeniu wariantu i nie są później
  synchronizowane. Interfejs nie powinien sugerować, że zmiana opisu w jednym
  wariancie zmieni go w pozostałych.

### Cechy wariantu pokazywane użytkownikowi

W wersji 1 nie ma słownika powodów. Zamiast niego:

- użytkownik nadaje wariantowi nazwę wolnym tekstem („Wegetariańska”,
  „Bezglutenowa z termorobotem”),
- backend wylicza krótkie chipy z istniejących pól (`diet_type`,
  `is_termorobot`, `is_grill`, `difficulty`, `servings`), pokazując te
  cechy, które różnią wariant od pozostałych wariantów grupy.

Słownik powodów (stabilny klucz techniczny, tłumaczona etykieta, wiele
powodów na wariant, pozycja „Inny”) jest przyszłym rozszerzeniem. Warto go
wprowadzić dopiero, gdy pojawi się potrzeba filtrowania po powodach albo
spójnych etykiet w wielu językach. Do tego czasu wolna nazwa wariantu nie
wymaga dodatkowych tabel, RLS ani moderacji.

## 3. Zachowanie wyszukiwania i list

### Zasada wyszukiwania

Wyszukiwanie obejmuje każdy wariant tak, jak dziś obejmuje pojedynczy
przepis. Dopasowanie może nastąpić do:

- wspólnej nazwy grupy,
- nazwy wariantu,
- składników, kroków, wskazówek i tagów wariantu,
- pól klasyfikacyjnych wariantu.

Dopasowanie do nazwy grupy wymaga, aby wektor wyszukiwania wariantu zawierał
nazwę grupy i nazwę wariantu. Zmiana nazwy grupy przelicza wektory jej
wariantów; zdarza się to rzadko, więc koszt jest akceptowalny. Bez tego
zapytanie „Lasagne” nie znalazłoby wariantu o nazwie „Klasyczna”.

Wynik wyszukiwania jest zgrupowany po grupie przepisu. Jedna grupa zajmuje
jedno miejsce na liście, nawet jeśli pasuje kilka jej wariantów.

### Reprezentant wyniku grupy

Każda grupa na liście potrzebuje reprezentanta wizualnego:

1. pokaż wariant najlepiej dopasowany do zapytania i filtrów;
2. jeśli dopasowanie jest równorzędne, pokaż wariant domyślny (o ile spełnia
   filtry);
3. jeśli domyślny nie spełnia filtrów, pokaż pierwszy spełniający według
   kolejności w grupie;
4. dodaj informację o liczbie wariantów oraz krótkie etykiety pozostałych.

Reprezentant musi zawsze należeć do zbioru wariantów, które spełniły
wyszukiwanie i filtry. Dotyczy to także filtrów osobistych („ulubione”,
„chcę wypróbować”) i filtrów oceny.

Karta może wyglądać następująco:

```text
Lasagne
Klasyczna
[zdjęcie]
3 warianty (pasują 2): Klasyczna · Wegetariańska · Bezglutenowa
```

Liczba wariantów na karcie pokazuje wszystkie warianty dostępne
użytkownikowi, a w trybie wyszukiwania lub filtrowania dodatkowo informację,
ile z nich pasuje.

Jeżeli użytkownik wyszuka „bezglutenowe”, karta prowadzi do grupy „Lasagne”,
ale otwiera wariant bezglutenowy. Nie wolno po cichu przełączyć go na
reprezentanta, bo użytkownik straciłby kontekst wyszukiwania. Link z karty
zawsze zawiera parametr wskazujący reprezentanta.

### Filtry i sortowanie

Filtry dotyczące cech przepisu działają na wariantach, a grupowanie następuje
po wyszukaniu. Filtr „termorobot” pokaże grupę, jeśli choć jeden jej wariant
spełnia filtr.

Na karcie i po wejściu w szczegóły trzeba zaznaczyć, że pokazany wariant
spełnił filtr.

Reguły sortowania:

- w wyszukiwaniu: według rankingu najlepiej dopasowanego wariantu,
- w feedzie i listach: według najnowszej daty utworzenia spośród pasujących
  wariantów (wyliczane w zapytaniu grupującym, bez dodatkowej kolumny),
- po ocenie: według oceny reprezentanta.

### Oceny na karcie

Oceny pozostają osobne dla wariantów. Karta grupy pokazuje ocenę i liczbę
ocen reprezentanta. Zbiorcza ocena grupy nie występuje w wersji 1.
Ograniczenie „nie oceniaj własnego przepisu” działa bez zmian, ponieważ
właściciel grupy i wariantu jest ten sam.

### Liczniki i paginacja

`total` i paginacja liczą grupy, nie warianty. Backend wykonuje grupowanie
(np. jedno zapytanie wybierające jeden wiersz na grupę według rankingu)
przed zastosowaniem limitu strony. Pobranie dwunastu wariantów, a następnie
usunięcie duplikatów w przeglądarce prowadziłoby do krótkich stron,
niestabilnych wyników i błędnych liczników.

Zasada dotyczy wszystkich list: Explore, wyszukiwania, „Moje przepisy”
i kolekcji.

## 4. UI

### Tworzenie i edycja

Formularz istniejącego przepisu pozostaje prosty dla jednego wariantu:

- obecny formularz tworzy grupę i jej pierwszy wariant,
- użytkownik może wybrać „Dodaj wariant” po zapisaniu lub w osobnym
  przepływie,
- dodanie wariantu zaczyna się od pustego formularza albo od kopii wybranego
  wariantu,
- kopiowanie jest jawne, aby użytkownik nie nadpisał oryginału,
- kopia zdjęcia jest fizyczną kopią pliku w Storage; wariant nigdy nie
  współdzieli pliku z innym wariantem.

W formularzu wariantu znajdują się:

- nazwa wspólna grupy, edytowana na poziomie grupy (z informacją, że zmiana
  dotyczy wszystkich wariantów),
- nazwa wariantu,
- komplet obecnych pól przepisu,
- informacja, czy wariant jest domyślny.

Widoczność ustawia się dla grupy. Formularz wariantu pokazuje ją tylko do
odczytu z linkiem do zmiany na poziomie grupy.

Na poziomie grupy jest sekcja „Warianty”, gdzie właściciel może zmienić
wariant domyślny, zmienić kolejność, edytować wariant, utworzyć kopię
i usunąć wariant.

Nie wolno usunąć ostatniego wariantu bez usunięcia całej grupy.

### Usuwanie

- Usunięcie wariantu jest soft delete. Przed usunięciem interfejs pokazuje,
  w ilu miejscach właściciela wariant jest użyty (plan, kolekcje, lista
  zakupów), i prosi o potwierdzenie. Po potwierdzeniu wariant jest usuwany
  z planu i kolekcji właściciela, a odpowiadające mu pozycje listy zakupów
  są usuwane tą samą logiką co ręczne usunięcie przepisu z planu.
- Usunięcie wariantu domyślnego wybiera nowy domyślny w tej samej operacji
  (pierwszy aktywny według kolejności).
- Usunięcie grupy kaskadowo oznacza wszystkie jej warianty jako usunięte.
- Oceny, flagi i notatki usuniętego wariantu pozostają w bazie (jak dziś przy
  soft delete) i nie są widoczne.
- Wpisy innych użytkowników dla usuniętego wariantu publicznego zachowują
  się tak jak dziś przy usunięciu przepisu; zgodność tej zasady należy
  potwierdzić przy planowaniu implementacji.
- Przywracanie usuniętej grupy lub wariantu nie jest w zakresie wersji 1.

### Lista przepisów

Na kartach i w tabelach:

- nazwa grupy jest głównym tytułem,
- nazwa reprezentowanego wariantu jest podtytułem,
- pokazywana jest liczba wariantów (i liczba pasujących, gdy obowiązuje
  wyszukiwanie lub filtr),
- opcjonalnie kilka chipów cech wariantu,
- jeden link do przepisu z parametrem wskazującym reprezentanta.

W widoku „Moje przepisy” warto dodać szybki filtr „ma warianty”, ale nie jest
to konieczne do pierwszej wersji. Panel administracyjny odróżnia grupę od
wariantu, aby administrator nie widział pozornie zduplikowanych przepisów bez
informacji o relacji. Moderacja i usuwanie w panelu dotyczą wariantu; akcje
na całej grupie są osobne.

### Widok szczegółów

Przełącznik wariantów jest widoczny wysoko, bezpośrednio pod nazwą grupy.
Rekomendowany układ:

```text
Lasagne
[ Wariant: Klasyczna v ]
Klasyczna · 1 z 2
Cechy: klasyczna wersja
```

Dla dwóch lub trzech wariantów można użyć zakładek albo segmentowanego
przełącznika. Dla większej liczby lepsza jest lista rozwijana z nazwą
i krótkimi cechami wariantu.

Po przełączeniu:

- zmienia się cała treść przepisu, nie tylko etykieta,
- aktualizuje się parametr wariantu w URL (z `replaceUrl`), aby można było
  udostępnić konkretny wariant,
- pozostaje widoczna nazwa grupy,
- zachowany zostaje kontekst powrotu do wyszukiwania i filtrów,
- stan ładowania nie powoduje pustego białego widoku.

Akcje „Dodaj do kolekcji”, „Dodaj do planu”, ulubione, ocena i notatka
odnoszą się do wybranego wariantu. Przykładowy tekst pomocniczy:
„Zapisujesz wariant: Wegetariańska”. W kolekcji i planie pokazywana jest
zarówno nazwa grupy, jak i nazwa wariantu.

### Dostępność i mobile

Przełącznik działa klawiaturą i ma nazwę odczytywaną przez czytnik ekranu.
Na telefonie nie zajmuje całego pierwszego ekranu ani nie przesuwa głównej
akcji „Dodaj do planu” poza kontekst przepisu.

## 5. Architektura systemu

### Baza danych

Osobna tabela grup, np. `recipe_families`, oraz powiązanie
`recipes.recipe_family_id`. Nazwy są robocze i nie przesądzają nazewnictwa
implementacyjnego.

Koncepcyjnie:

```text
recipe_families
  id
  user_id
  name
  visibility          -- PRIVATE / SHARED / PUBLIC, źródło prawdy
  deleted_at
  created_at
  updated_at
  unique (id, user_id)

recipes
  id                  -- bez zmian
  recipe_family_id    -- NOT NULL po migracji, klucz złożony (id, user_id)
  variant_name        -- NOT NULL, „Podstawowa” po migracji
  is_default          -- boolean
  sort_order          -- smallint
  name                -- kopia nazwy grupy (ustawiana przez backend)
  visibility          -- kopia widoczności grupy (ustawiana przez backend)
  ... pozostałe obecne dane wariantu ...

unique (recipe_family_id) where is_default and deleted_at is null
unique (recipe_family_id, lower(variant_name)) where deleted_at is null
```

Wariant domyślny jest oznaczony kolumną na przepisie, a nie wskaźnikiem
w grupie. Dzięki temu nie ma cyklu kluczy obcych i osobnego ograniczenia
„domyślny należy do tej samej grupy”. Zmiana wariantu domyślnego oraz
usunięcie domyślnego odbywają się w jednej transakcji.

Zapytania grupujące wymagają indeksu po `recipe_family_id`. Polityki RLS
nadal opierają się na kolumnach przepisu (`user_id`, `visibility`,
`deleted_at`), a nie na JOIN-ie do grupy; to unika spadku wydajności po
poprawkach RLS dla soft delete.

### Widoki, DTO i kontrakty

Obecny model pojedynczego przepisu jest rozszerzony o:

- dane grupy,
- listę lub skrót dostępnych wariantów,
- identyfikator wybranego wariantu,
- informację o dopasowaniu wariantu w wynikach wyszukiwania.

Warto rozdzielić:

- `RecipeFamilyListItemDto` — jedna karta grupy z reprezentantem, liczbą
  wszystkich i pasujących wariantów,
- `RecipeVariantSummaryDto` — id, nazwa, chipy cech, kolejność, znacznik
  domyślnego,
- `RecipeDetailDto` — pełne dane wybranego wariantu wraz z grupą i listą
  wariantów.

Pełna treść wszystkich wariantów nie jest zwracana na liście ani na starcie
widoku szczegółów.

### API i backend

Warstwa Edge Functions pozostaje jedynym miejscem logiki domenowej. Backend:

- wyszukuje warianty i grupuje wyniki po grupie,
- wybiera reprezentanta i wynik dopasowania,
- kontroluje własność zarówno grupy, jak i wariantu,
- waliduje, że wariant nie może zostać przypisany do cudzej grupy,
- tworzy grupę i pierwszy wariant transakcyjnie,
- wykonuje operacje grupowe (zmiana nazwy, widoczności, wariantu domyślnego,
  usunięcie) transakcyjnie,
- kopiuje zdjęcie wariantu w Storage przy kopiowaniu wariantu,
- egzekwuje limit i unikalność nazw wariantów.

Istniejące operacje odnoszące się do `recipe_id` nadal działają dla
konkretnego wariantu. Operacje grupowe powinny mieć osobne kontrakty zamiast
zmieniać znaczenie obecnych endpointów. Nowe funkcje RPC typu
`security definer` muszą od razu mieć jawne `revoke` dla ról, które nie
powinny ich wywoływać (zgodnie z ostrzeżeniem z rejestru PS-204).

### RLS i widoczność

Zasady:

- grupa i wariant mają tego samego właściciela,
- wspólna widoczność grupy obowiązuje wszystkie jej warianty; kopia
  `recipes.visibility` jest zawsze równa widoczności grupy,
- `PRIVATE` — żaden wariant nie jest widoczny poza właścicielem,
- `SHARED` — wariant jest dostępny po linku; link pokazuje listę wariantów
  grupy, ponieważ widoczność jest wspólna, ale warianty nie trafiają do list
  i wyszukiwania,
- `PUBLIC` — wszystkie aktywne warianty są widoczne w Explore i wyszukiwaniu,
- usunięta grupa wyklucza wszystkie warianty z list i wyszukiwania.

Pojedyncza widoczność wariantu jest świadomie poza zakresem. Rodziłaby
nieintuicyjne przypadki (grupa publiczna z prywatnym wariantem, lista
rodzeństwa zdradzająca prywatne warianty) i wymagałaby osobnej funkcji.
W konsekwencji nie ma też stanu „szkic” wariantu: nowy wariant w grupie
publicznej jest od razu publiczny.

### Istniejące zależności

Wariantowość dotyka wszystkich miejsc, które dziś zakładają, że jeden przepis
to jeden wynik:

- wyszukiwanie i feed Explore,
- listy „Moje przepisy” i kolekcje,
- „Mój plan” oraz lista zakupów,
- ulubione i „chcę wypróbować”,
- oceny i notatki,
- import i tworzenie przez AI,
- obrazy w Storage,
- linki i przekierowania,
- panel administracyjny,
- widoki i kontrakty współdzielone.

Tabele działań użytkownika są kluczowane po `recipe_id`: oceny, flagi,
notatki, `plan_recipes`, wkłady listy zakupów, kolejka składników
znormalizowanych. Dlatego zasada „działanie dotyczy wariantu” wynika
z modelu i nie wymaga zmian danych. Prace dotyczą weryfikacji, oznaczeń
w UI oraz reguł usuwania.

Plan i lista zakupów:

- użytkownik dodaje do planu konkretny wariant,
- „Mój plan” może zawierać dwa warianty tej samej grupy; każdy wariant liczy
  się jako osobny slot w limicie planu dla konta Free (PS-65),
- lista zakupów pobiera składniki tego wariantu i nigdy nie grupuje po nazwie,
  ponieważ dwa warianty mogą mieć różne składniki.

Obrazy w Storage: ścieżka pliku zawiera `recipeId`, więc kopia wariantu
tworzy własny plik; usunięcie wariantu nie może wpływać na zdjęcie innego.

AI i import: tworzenie przepisu przez AI lub import tworzy grupę z jednym
wariantem. Generowanie wariantu przez AI na podstawie istniejącego przepisu
(np. wersja bezglutenowa) jest naturalnym przyszłym rozszerzeniem i nie
wchodzi do wersji 1.

### URL i kompatybilność

Dotychczasowy adres `/recipes/{id}` (oraz analogiczne adresy w Explore i na
widokach publicznych) pozostaje poprawny i nie zmienia znaczenia:

- `{id}` jest zawsze identyfikatorem przepisu (`recipes.id`). Identyfikator
  grupy nie występuje w adresach, więc nie ma kolizji przestrzeni ID i nie są
  potrzebne przekierowania ze starych adresów,
- adres bez parametru wariantu otwiera wariant domyślny grupy, do której
  należy przepis `{id}`; w grupie z jednym wariantem jest to dokładnie dzisiejsze
  zachowanie,
- opcjonalny parametr (np. `?variant={recipeId}`) wskazuje konkretny wariant
  tej samej grupy; jeśli wariant nie należy do grupy, jest usunięty albo
  niedostępny dla użytkownika, widok otwiera wariant domyślny i pokazuje
  komunikat,
- link z karty wyników zawsze zawiera parametr reprezentanta wyniku,
  a przełączenie wariantu w szczegółach aktualizuje parametr,
- udostępniony adres z parametrem otwiera dokładnie wskazany wariant;
  udostępniony adres bez parametru otwiera wariant domyślny.

Dla `SHARED` i `PUBLIC` obowiązuje ta sama zasada; parametr wariantu nie
omija reguł widoczności.

## 6. Proponowany podział na historyjki

Poniższy podział jest backlogiem funkcjonalnym, a nie planem technicznym.
Kolejność ogranicza ryzyko zmiany znaczenia istniejących funkcji i
gwarantuje, że zabezpieczenia powstają przed ekspozycją wariantów. Każda
historyjka zawiera własne testy (kontrakty, backend, komponenty).

Funkcja wariantów pozostaje wyłączona dla użytkowników (flaga funkcji) do
zakończenia historyjki 5. Dzięki temu nie powstają „zduplikowane” karty ani
niezabezpieczone widoki w trakcie wdrażania.

### Historyjka 1 — Model grupy, migracja i widoczność

Wprowadzić grupę, powiązanie każdego obecnego przepisu z grupą
jednoelementową oraz kolumny wariantu (`variant_name`, `is_default`,
`sort_order`). Przenieść widoczność do grupy z kopią na wariancie. Dostosować
RLS, autoryzację i reguły dla `PRIVATE`, `SHARED`, `PUBLIC` oraz soft delete.
Rozszerzyć wektor wyszukiwania o nazwę grupy i wariantu.

Kryterium koncepcyjne: po migracji użytkownik nie widzi różnicy w zachowaniu
przepisów bez wariantów, a żaden wariant nie ujawnia prywatnych danych przez
grupę, wyszukiwanie ani link bezpośredni.

### Historyjka 2 — Zarządzanie wariantami przez właściciela

Dodać utworzenie wariantu, utworzenie przez kopiowanie (z kopią zdjęcia),
edycję, zmianę nazwy grupy, zmianę widoczności grupy, zmianę wariantu
domyślnego, kolejności oraz usunięcie wariantu i grupy z ostrzeżeniem
o użyciu w planie i kolekcjach. Uwzględnić limit wariantów, unikalność nazw
i ochronę przed usunięciem ostatniego wariantu.

Kryterium koncepcyjne: właściciel może zbudować pełną grupę bez ręcznego
tworzenia niezależnych przepisów.

### Historyjka 3 — Przełącznik wariantów na szczegółach

Pokazać wspólną nazwę, wybrany wariant, chipy cech i listę pozostałych
wariantów na prywatnym oraz publicznym widoku szczegółów. Obsłużyć adres
`/recipes/{id}` z opcjonalnym parametrem wariantu, wariant domyślny oraz
przypadki graniczne (usunięty wariant, nieaktualny parametr, zmiana
widoczności).

Kryterium koncepcyjne: użytkownik zawsze wie, który wariant ogląda i może
przejść do innego bez powrotu do wyszukiwania.

### Historyjka 4 — Grupowanie list i wyszukiwania

Zmienić Explore, wyszukiwanie, „Moje przepisy” i kolekcje tak, aby
dopasowywały warianty, ale zwracały grupy. Dodać reprezentanta najlepszego
dopasowania (także dla filtrów osobistych), liczbę wariantów i pasujących
wariantów, poprawną paginację, `total` oraz sortowanie.

Kryterium koncepcyjne: warianty zachowują wyszukiwalność, a grupa nie zajmuje
kilku miejsc na jednej stronie wyników żadnej listy.

### Historyjka 5 — Działania użytkownika na wariancie i integracje

Zweryfikować kolekcje, plan, ulubione, ocenę i notatkę, tak aby odnosiły się
do wybranego wariantu, z czytelnym oznaczeniem na listach, w kolekcji i
w planie. Zweryfikować listę zakupów, normalizację składników, import, AI
i obrazy. Potwierdzić limit planu Free (każdy wariant to osobny slot).
Dostosować panel administracyjny (rozróżnienie grupy i wariantu).

Kryterium koncepcyjne: zapisanie wariantu wegetariańskiego nie zapisuje
przypadkiem wariantu mięsnego tej samej grupy, a operacje na treści nigdy nie
mieszają danych wariantów.

Po zakończeniu historyjek 1–5 i przeglądzie jakości można włączyć flagę
funkcji.

## 7. Otwarte decyzje i ograniczenia wersji 1

Rozstrzygnięte:

1. Widoczność jest zawsze wspólna dla grupy (`PRIVATE`, `SHARED`, `PUBLIC`).
2. Jedna grupa ma jednego właściciela; warianty innych autorów są poza
   zakresem.
3. Karta grupy korzysta ze zdjęcia reprezentanta; grupa nie ma własnego
   zdjęcia.
4. Oceny są osobne dla wariantów; zbiorcza ocena grupy nie występuje.
5. „Mój plan” może zawierać dwa warianty tej samej grupy; każdy liczy się
   jako osobny slot limitu.
6. Słownik powodów wariantowości jest odłożony; v1 używa wolnej nazwy wariantu
   i chipów z istniejących pól.
7. Użytkownik nie może przenieść istniejącego, niezależnego przepisu do
   grupy ani odłączyć wariantu; może tylko utworzyć nowy wariant. Istniejące
   duplikaty (np. „Lasagne” i „Lasagne wegetariańska”) pozostają osobnymi
   grupami. To świadome ograniczenie wersji 1; operacje „dołącz” i „odłącz”
   są kandydatem na kolejną funkcję, ponieważ w tym modelu sprowadzają się do
   zmiany powiązania z grupą.

Do potwierdzenia przy planowaniu implementacji:

- zachowanie wpisów innych użytkowników (plan, kolekcje) po usunięciu
  publicznego wariantu — zgodnie z dzisiejszym zachowaniem przy usunięciu
  przepisu,
- wartość limitu wariantów w grupie (propozycja: 10),
- sposób odświeżania wektora wyszukiwania po zmianie nazwy grupy (trigger
  czy operacja w RPC).

Przyszłe rozszerzenia (poza wersją 1): słownik powodów wariantowości
z filtrowaniem, warianty innych autorów (np. model rozwidlenia przepisu),
stan „szkic” wariantu, przywracanie usuniętych grup i wariantów,
operacje dołączania i odłączania wariantów, generowanie wariantu przez AI,
zbiorcza ocena grupy.
