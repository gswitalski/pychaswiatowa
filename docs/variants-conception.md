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
- słownik powodów wariantowości z możliwością przypisania wielu powodów,
- działania użytkownika przypisane do wybranego wariantu,
- istniejące przepisy migrowane jako grupy z jednym wariantem.

Dokument opisuje koncepcję produktu, UI, architektury oraz kolejność
przyszłych historyjek. Nie jest planem implementacji ani specyfikacją API.

## 2. Model pojęciowy

### Grupa przepisu

Grupa jest tożsamością logiczną przepisu, którą użytkownik rozpoznaje na
liście i w wyszukiwaniu. Przechowuje przede wszystkim:

- wspólną nazwę, np. „Lasagne”,
- właściciela,
- stan usunięcia lub archiwizacji grupy,
- reguły widoczności grupy, jeśli przyjęta zostanie wspólna widoczność,
- identyfikator używany do grupowania wyników.

Grupa nie powinna przechowywać składników ani kroków. Te dane należą do
wariantu.

### Wariant

Wariant pozostaje pełnym przepisem. Przechowuje własne:

- nazwę wariantu, np. „Klasyczna”,
- składniki, kroki i wskazówki,
- zdjęcie,
- liczbę porcji i czasy,
- dietę, kuchnię, trudność i cechy typu termorobot,
- tagi oraz pozostałe istniejące atrybuty przepisu,
- identyfikator źródłowego przepisu, jeśli system zachowa kompatybilność
  z obecnym modelem.

Nazwa wyświetlana może być składana jako:

> Lasagne · Klasyczna

Jeśli grupa ma tylko jeden wariant, można pokazywać dotychczasowe „Lasagne”
bez wymuszania widocznego sufiksu. Wariant powinien jednak mieć nazwę także
wewnętrznie, aby później bezpiecznie obsłużyć dołączenie drugiej wersji.

### Powód wariantowości

Powód powinien być osobną wartością słownikową, a nie tylko tekstem. Wstępny
słownik może zawierać:

- urządzenie lub sposób przygotowania,
- dieta lub styl odżywiania,
- alergeny i wykluczenia,
- składnik albo zamiennik,
- ograniczenia żywieniowe, np. bezglutenowe,
- wielkość lub liczba porcji,
- poziom trudności,
- inny.

Wariant może mieć wiele powodów. Na przykład wariant „Bezglutenowy
z termorobotem” ma dwa powody. Pozycja „Inny” powinna dopuszczać krótki opis
uzupełniający, ale nie zastępować słownika w typowych przypadkach.

Słownik powinien mieć stabilny klucz techniczny i tłumaczoną etykietę.
Dzięki temu zmiana nazwy widocznej dla użytkownika nie zmieni danych
historycznych ani filtrów.

## 3. Zachowanie wyszukiwania i list

### Zasada wyszukiwania

Wyszukiwanie powinno obejmować każdy wariant tak, jak obecnie obejmuje
pojedynczy przepis. Dopasowanie może nastąpić do:

- wspólnej nazwy grupy,
- nazwy wariantu,
- składników, kroków, wskazówek i tagów wariantu,
- pól klasyfikacyjnych wariantu.

Wynik wyszukiwania powinien jednak zostać zgrupowany po grupie przepisu.
Jedna grupa zajmuje jedno miejsce na liście, nawet jeśli pasuje kilka jej
wariantów.

### Reprezentant wyniku grupy

Każda grupa na liście potrzebuje reprezentanta wizualnego. Rekomendowane
zachowanie:

1. pokaż wariant najlepiej dopasowany do zapytania;
2. jeśli dopasowanie jest równorzędne, pokaż wariant domyślny;
3. jeśli nie ma domyślnego wariantu, pokaż najstarszy lub pierwszy aktywny;
4. dodaj informację „2 warianty” oraz krótkie etykiety innych wariantów.

Karta może wyglądać następująco:

```text
Lasagne
Klasyczna
[zdjęcie]
2 warianty: Klasyczna · Wegetariańska
```

Jeżeli użytkownik wyszuka „bezglutenowe”, karta nadal prowadzi do grupy
„Lasagne”, ale jako wybrany wariant otwiera wariant bezglutenowy. Nie wolno
po cichu przełączyć go na reprezentanta, bo użytkownik straciłby kontekst
wyszukiwania.

### Filtry i sortowanie

Filtry dotyczące cech przepisu powinny działać na wariantach, a grupowanie
następować dopiero po wyszukaniu. W ten sposób filtr „termorobot” pokaże
grupę, jeśli choć jeden jej wariant spełnia filtr.

Na karcie i po wejściu w szczegóły trzeba zaznaczyć, że pokazany wariant
spełnił filtr. W przeciwnym razie użytkownik może zobaczyć wariant klasyczny
po wyszukaniu wariantu wegetariańskiego i uznać wynik za błędny.

Sortowanie wymaga jawnej reguły. Rekomendowane jest sortowanie grupy według
najlepszego wariantu, który spełnił wyszukiwanie, a w trybie feedu według
daty ostatniej aktywności grupy lub utworzenia grupy. Nie należy liczyć
każdego wariantu jako osobnego wyniku paginacji.

### Liczniki i paginacja

`total` i paginacja powinny liczyć grupy, nie warianty. Backend musi wykonać
grupowanie przed zastosowaniem limitu strony. Pobranie dwunastu wariantów,
a następnie usunięcie duplikatów w przeglądarce prowadziłoby do krótkich
stron, niestabilnych wyników i błędnych liczników.

## 4. UI

### Tworzenie i edycja

Formularz istniejącego przepisu powinien pozostać prosty dla przypadku
jednego wariantu:

- obecny formularz tworzy grupę i jej pierwszy wariant,
- użytkownik może wybrać „Dodaj wariant” po zapisaniu lub w ramach osobnego
  przepływu,
- dodanie wariantu może zacząć od pustego formularza albo skopiować wybrany
  wariant jako punkt wyjścia,
- kopiowanie musi być jawne, aby użytkownik nie nadpisał przypadkiem
  oryginału.

W formularzu wariantu powinny znaleźć się:

- nazwa wspólna grupy, edytowana na poziomie grupy,
- nazwa wariantu,
- powody wariantowości,
- komplet obecnych pól przepisu,
- informacja, czy wariant jest domyślny.

Na poziomie grupy przyda się ekran lub sekcja „Warianty”, gdzie właściciel
może zmienić wariant domyślny, zmienić kolejność, edytować wariant, utworzyć
kopię i usunąć wariant.

Nie należy pozwolić na usunięcie ostatniego wariantu bez utworzenia nowego
albo wyraźnego usunięcia całej grupy.

### Lista przepisów

Na kartach i w tabelach:

- pokazuj nazwę grupy jako główny tytuł,
- pokazuj nazwę reprezentowanego wariantu jako podtytuł,
- pokazuj liczbę wariantów,
- opcjonalnie pokazuj maksymalnie kilka powodów jako chipy,
- stosuj jeden link do grupy z parametrem wskazującym wybrany wariant.

W widoku „Moje przepisy” warto dodać szybki filtr „ma warianty”, ale nie jest
to konieczne do pierwszej wersji. Panel administracyjny powinien odróżniać
grupę od wariantu, aby administrator nie widział pozornie zduplikowanych
przepisów bez informacji o relacji.

### Widok szczegółów

Przełącznik wariantów powinien być widoczny wysoko, bezpośrednio pod nazwą
grupy lub w nagłówku przepisu. Rekomendowany układ:

```text
Lasagne
[ Wariant: Klasyczna v ]
Klasyczna · 1 z 2
Powody: klasyczna wersja
```

Dla dwóch lub trzech wariantów można użyć zakładek albo segmentowanego
przełącznika. Dla większej liczby lepsza będzie lista rozwijana z nazwą,
powodami i krótkimi cechami wariantu.

Po przełączeniu:

- zmienia się cała treść przepisu, nie tylko etykieta,
- aktualizuje się URL, aby można było udostępnić konkretny wariant,
- pozostaje widoczna nazwa grupy,
- zachowany zostaje kontekst powrotu do wyszukiwania i filtrów,
- stan ładowania nie powinien powodować pustego białego widoku.

Akcje „Dodaj do kolekcji”, „Dodaj do planu”, ulubione, ocena i notatka muszą
jasno odnosić się do wybranego wariantu. Przykładowy tekst pomocniczy:
„Zapisujesz wariant: Wegetariańska”. W kolekcji i planie należy pokazywać
zarówno nazwę grupy, jak i nazwę wariantu.

### Dostępność i mobile

Przełącznik musi działać klawiaturą i mieć nazwę odczytywaną przez czytnik
ekranu. Na telefonie nie powinien zajmować całego pierwszego ekranu ani
przesuwać głównej akcji „Dodaj do planu” poza kontekst przepisu.

## 5. Architektura systemu

### Baza danych

Rekomendowany kierunek to osobna tabela grup, np. `recipe_families`, oraz
powiązanie `recipes.recipe_family_id`. Alternatywnie grupa może zostać
zbudowana jako osobny typ rekordu, ale tabela grup upraszcza reguły
integralności i zapytania.

Koncepcyjnie:

```text
recipe_families
  id
  user_id
  name
  default_recipe_id
  visibility / status, jeśli grupa ma własny stan
  created_at
  updated_at

recipes
  id
  recipe_family_id
  variant_name
  ... wszystkie obecne dane wariantu ...

variant_reasons
  id
  key
  label / dane tłumaczeń
  active

recipe_variant_reasons
  recipe_id
  reason_id
  custom_description, opcjonalnie dla „Inny”
```

Nazwy tabel są robocze i nie przesądzają nazewnictwa implementacyjnego.

Wartość `default_recipe_id` powinna mieć ograniczenie gwarantujące, że
wskazuje wariant należący do tej samej grupy. Usunięcie wariantu domyślnego
musi w jednej operacji wybrać nowy domyślny albo zablokować usunięcie.

### Widoki, DTO i kontrakty

Obecny model pojedynczego przepisu powinien zostać rozszerzony o:

- dane grupy,
- listę lub skrót dostępnych wariantów,
- identyfikator wybranego wariantu,
- informację o dopasowaniu wariantu w wynikach wyszukiwania.

Warto rozdzielić:

- `RecipeFamilyListItemDto` — jedna karta grupy z reprezentantem,
- `RecipeVariantSummaryDto` — nazwa, id, powody, cechy potrzebne do
  przełącznika,
- `RecipeDetailDto` — pełne dane wybranego wariantu wraz z grupą i listą
  wariantów.

Nie należy zwracać pełnej treści wszystkich wariantów na liście ani na
starcie widoku szczegółów. Zwiększałoby to payload i komplikowało cache.

### API i backend

Warstwa Edge Functions pozostaje jedynym miejscem logiki domenowej. Backend
powinien:

- wyszukiwać warianty,
- grupować wyniki po grupie,
- wybierać reprezentanta i wynik dopasowania,
- kontrolować własność zarówno grupy, jak i wariantu,
- walidować, że wariant nie może zostać przypisany do cudzej grupy,
- wykonywać utworzenie grupy i pierwszego wariantu transakcyjnie,
- wykonywać operacje grupowe i usuwanie wariantów transakcyjnie.

Istniejące operacje odnoszące się do `recipe_id` powinny nadal działać dla
konkretnego wariantu. Operacje grupowe, takie jak pobranie listy wariantów,
ustawienie domyślnego wariantu i zarządzanie grupą, powinny mieć osobne
kontrakty zamiast ukrywać zmianę znaczenia obecnego endpointu.

### RLS i widoczność

Należy ustalić spójny wariant reguł:

- grupa i wariant mają tego samego właściciela,
- prywatna grupa nie ujawnia żadnego wariantu,
- publiczna grupa udostępnia publiczne warianty,
- warianty niepubliczne mogą być widoczne właścicielowi,
- usunięta grupa wyklucza wszystkie warianty z list i wyszukiwania.

Rekomendowane na początek jest dziedziczenie widoczności grupy przez warianty.
Pojedyncza widoczność wariantu daje większą elastyczność, ale rodzi
nieintuicyjne przypadki: grupa publiczna z prywatnym wariantem, różne zasady
udostępniania i trudniejsze wyniki wyszukiwania. Jeśli produkt potrzebuje
takiej elastyczności, należy potraktować ją jako osobną funkcję.

### Istniejące zależności

Wariantowość wpływa na wszystkie miejsca, które dziś zakładają, że jeden
przepis to jeden wynik:

- wyszukiwanie i feed Explore,
- listy „Moje przepisy” i kolekcje,
- „Mój plan” oraz lista zakupów,
- ulubione i „chcę wypróbować”,
- oceny i notatki,
- import i tworzenie przez AI,
- obrazy w Storage,
- linki, slugi i przekierowania,
- panel administracyjny,
- widoki i kontrakty współdzielone.

Największe ryzyko dotyczy „Mojego planu” i listy zakupów. Użytkownik powinien
dodać do planu konkretny wariant, a lista zakupów musi pobrać składniki tego
wariantu. Nie wolno grupować ich po nazwie, bo dwa warianty mogą mieć różne
składniki.

### URL i kompatybilność

URL powinien identyfikować grupę i wybrany wariant albo jednoznacznie
identyfikować wariant z możliwością odczytania jego grupy. Rekomendowane jest
zachowanie obecnych adresów dla istniejących przepisów i dodanie parametru
lub segmentu wariantu dopiero wtedy, gdy grupa ma więcej niż jeden wariant.

Każdy link z wyników wyszukiwania musi otwierać wariant, który był
reprezentantem wyniku. Udostępnienie adresu nie może otwierać losowo wariantu
domyślnego.

## 6. Proponowany podział na historyjki

Poniższy podział jest backlogiem funkcjonalnym, a nie planem technicznym.
Kolejność ogranicza ryzyko zmiany znaczenia istniejących funkcji.

### Historyjka 1 — Model grupy i migracja istniejących przepisów

Wprowadzić pojęcie grupy oraz powiązanie każdego obecnego przepisu z grupą
jednoelementową. Zachować dotychczasowe identyfikatory, właścicieli,
widoczność, linki i działania użytkownika.

Kryterium koncepcyjne: po migracji użytkownik nie widzi różnicy w zachowaniu
przepisów bez wariantów.

### Historyjka 2 — Metadane wariantu i słownik powodów

Dodać nazwę wariantu, wariant domyślny oraz słownik powodów z obsługą wielu
powodów. Udostępnić te dane w kontraktach i walidacji.

Kryterium koncepcyjne: każdy przepis może być wariantem, ale stary przepis
jednoelementowy nie wymaga ręcznego uzupełniania danych.

### Historyjka 3 — Zarządzanie wariantami przez właściciela

Dodać utworzenie wariantu, utworzenie przez kopiowanie, edycję, zmianę
wariantu domyślnego, zmianę kolejności i usunięcie wariantu. Uwzględnić
ochronę przed usunięciem ostatniego wariantu.

Kryterium koncepcyjne: właściciel może zbudować pełną grupę bez ręcznego
tworzenia niezależnych przepisów i późniejszego łączenia ich.

### Historyjka 4 — Przełącznik wariantów na szczegółach

Pokazać wspólną nazwę, wybrany wariant, powody i listę pozostałych wariantów
na prywatnym oraz publicznym widoku szczegółów. Aktualizować URL i utrzymać
kontekst nawigacji.

Kryterium koncepcyjne: użytkownik zawsze wie, który wariant ogląda i może
przejść do innego bez powrotu do wyszukiwania.

### Historyjka 5 — Grupowanie wyników Explore i wyszukiwania

Zmienić wyszukiwanie tak, aby dopasowywało warianty, ale zwracało grupy.
Dodać reprezentanta najlepszego dopasowania, liczbę wariantów i poprawną
paginację oraz sortowanie.

Kryterium koncepcyjne: warianty zachowują wyszukiwalność, a grupa nie zajmuje
kilku miejsc na jednej stronie wyników.

### Historyjka 6 — Działania użytkownika na wariancie

Zweryfikować i ujednolicić kolekcje, plan, ulubione, ocenę i notatkę, tak aby
odnosiły się do wybranego wariantu. Dodać czytelne oznaczenie wariantu na
liście kolekcji i w planie.

Kryterium koncepcyjne: zapisanie wariantu wegetariańskiego nie zapisuje
przypadkiem wariantu mięsnego tej samej grupy.

### Historyjka 7 — Lista zakupów i integracje zależne od treści

Zapewnić, że składniki, normalizacja i lista zakupów korzystają z konkretnego
wybranego wariantu. Sprawdzić import, AI, obrazy i kopiowanie przepisu.

Kryterium koncepcyjne: operacje na treści nigdy nie mieszają danych
wariantów.

### Historyjka 8 — Widoczność, uprawnienia i panel administracyjny

Dostosować RLS, autoryzację, endpointy administracyjne i prezentację grup
oraz wariantów w panelu. Uwzględnić soft delete i przypadki niepełnych lub
usuniętych grup.

Kryterium koncepcyjne: wariant nie może ujawnić prywatnych danych przez
publiczną grupę, wyszukiwanie ani link bezpośredni.

### Historyjka 9 — Jakość, migracja UX i obsługa kompatybilności

Uzupełnić testy jednostkowe kontraktów, backendu i komponentów, zweryfikować
stare URL-e oraz przygotować komunikaty dla przypadków granicznych:
usunięty wariant, brak wariantu domyślnego, nieaktualny link i zmiana
widoczności.

Kryterium koncepcyjne: wdrożenie nie powoduje regresji dla jednoelementowych
grup i jest zrozumiałe dla użytkownika.

## 7. Otwarte decyzje przed szczegółowym planowaniem

1. Czy widoczność jest zawsze wspólna dla grupy, czy pojedynczy wariant może
   mieć własną widoczność?
2. Czy jedna grupa może mieć warianty wielu autorów, czy właściciel grupy
   zawsze kontroluje wszystkie warianty?
3. Czy grupa ma własne zdjęcie domyślne, czy karta zawsze korzysta ze zdjęcia
   reprezentanta?
4. Czy oceny wariantów mają być całkowicie oddzielne, czy grupa ma również
   zbiorczą ocenę?
5. Czy „Mój plan” może zawierać dwa warianty tej samej grupy?
6. Czy powody „Inny” wymagają moderacji lub późniejszego mapowania do
   słownika?
7. Czy użytkownik może przenieść już istniejący, niezależny przepis do
   istniejącej grupy, czy tylko utworzyć nowy wariant?

Najbezpieczniejszy zakres pierwszej wersji to: jeden właściciel grupy,
wspólna widoczność, oddzielne działania użytkownika, oddzielne oceny,
konkretny wariant w planie oraz słownik powodów bez publicznego filtrowania
po powodach. Pozostałe decyzje można wtedy rozstrzygnąć na podstawie
rzeczywistego użycia funkcji.
