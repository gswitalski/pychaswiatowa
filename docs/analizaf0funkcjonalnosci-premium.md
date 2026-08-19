# Analiza funkcjonalności dla modelu premium

## 1. Cel dokumentu

Celem dokumentu jest wskazanie, jakie funkcjonalności powinny być dostępne dla trzech segmentów użytkowników aplikacji PychaŚwiatowa:

- użytkownika niezalogowanego,
- zalogowanego użytkownika zwykłego,
- zalogowanego użytkownika premium.

Analiza opiera się na `docs/results/project-summary.md` oraz na dodatkowych założeniach produktowych przekazanych przed przygotowaniem dokumentu:

- główny model monetyzacji: subskrypcja miesięczna lub roczna,
- strategia freemium: zbalansowana, czyli darmowy produkt ma realną wartość, a premium usuwa limity i dodaje wygodę,
- najważniejsza persona biznesowa: domowy pasjonat gotowania gromadzący własne przepisy,
- główny haczyk premium: AI oraz import przepisów z URL, zdjęć i tekstu,
- dokument zapisany w katalogu `docs/`.

## 2. Rekomendacja biznesowa

Najbardziej opłacalny model dla PychaŚwiatowa to freemium z subskrypcją premium. Wersja darmowa powinna pozwalać użytkownikowi realnie korzystać z aplikacji jako prywatnej książki kucharskiej. Premium powinno sprzedawać przede wszystkim oszczędność czasu, wygodę i automatyzację, a nie samo prawo do podstawowego przechowywania przepisów.

Najsilniejszym argumentem sprzedażowym powinien być import AI: użytkownik ma wiele przepisów w zdjęciach, linkach, notatkach, PDF-ach, social mediach lub starych dokumentach. Jeżeli aplikacja pozwala szybko zamienić te źródła w uporządkowane przepisy, dostarcza natychmiastową wartość i uzasadnia cykliczną płatność.

Rekomendowany kierunek:

- gość powinien odkrywać wartość aplikacji i trafiać do rejestracji,
- użytkownik zwykły powinien zbudować przyzwyczajenie i bibliotekę przepisów,
- użytkownik premium powinien płacić za szybkie dodawanie, automatyzację, wyższe limity i wygodę codziennego gotowania.

## 3. Użytkownik niezalogowany

Użytkownik niezalogowany powinien mieć dostęp do funkcji, które pokazują wartość aplikacji, ale nie pozwalają jeszcze budować prywatnej bazy danych. Jego główna rola biznesowa to wejście do lejka rejestracji.

Funkcjonalności, które powinien mieć:

- przeglądanie landing page z jasnym opisem wartości aplikacji,
- wyszukiwanie publicznych przepisów w katalogu `/explore`,
- filtrowanie publicznych przepisów po podstawowych kryteriach, takich jak dieta, kuchnia, trudność, grill i termorobot,
- przeglądanie szczegółów publicznego przepisu pod kanonicznym URL,
- dostęp do sekcji z najnowszymi i popularnymi publicznymi przepisami,
- rejestracja konta,
- logowanie,
- ponowna wysyłka linku weryfikacyjnego,
- obsługa potwierdzenia adresu e-mail,
- dostęp do stron prawnych: regulamin, polityka prywatności, wydawca serwisu.

Rekomendowane ograniczenia:

- brak możliwości dodawania przepisów,
- brak możliwości zapisywania przepisu do kolekcji,
- brak dostępu do planu i listy zakupów,
- brak dostępu do funkcji AI,
- brak prywatnych danych i personalizacji.

Rekomendowane funkcje dodatkowe, których może jeszcze nie być:

- CTA "Zapisz do swojej książki kucharskiej" na publicznym przepisie, które prowadzi do rejestracji,
- podgląd korzyści premium na stronie przepisu, np. "Zaimportuj podobny przepis ze zdjęcia w Premium",
- limitowany tryb demonstracyjny importu AI bez zapisu, np. jeden przykładowy import pokazujący wynik, ale wymagający konta do zapisania,
- publiczne strony SEO dla wybranych kategorii i kuchni, np. `/explore/kuchnia/wloska`, aby pozyskiwać ruch organiczny.

Uzasadnienie biznesowe:

Gość powinien zobaczyć, że aplikacja ma realną zawartość i może rozwiązać jego problem, ale moment zapisania, organizacji lub automatyzacji powinien wymagać konta. Najważniejszy cel to konwersja do rejestracji bez ukrywania całej wartości produktu.

## 4. Zalogowany użytkownik zwykły

Zwykły użytkownik powinien mieć komplet podstawowych funkcji prywatnej książki kucharskiej. To buduje przyzwyczajenie, zaufanie i koszt zmiany narzędzia. Jednocześnie funkcje czasochłonne, automatyczne i kosztowe powinny być ograniczone albo przeniesione do premium.

Funkcjonalności, które powinien mieć:

- dashboard "Moja Pycha" po zalogowaniu,
- tworzenie przepisu ręcznie,
- edycja własnych przepisów,
- usuwanie własnych przepisów przez soft-delete,
- przeglądanie listy własnych przepisów,
- przeglądanie publicznych przepisów dodanych do swoich kolekcji,
- wyszukiwanie w swoich przepisach,
- sortowanie i podstawowe filtrowanie przepisów,
- dodawanie kategorii z listy predefiniowanej,
- dodawanie własnych tagów,
- tworzenie i zarządzanie kolekcjami,
- dodawanie przepisów do kolekcji,
- ustawianie widoczności przepisu: prywatny, współdzielony, publiczny,
- import przepisu z Markdown,
- upload zdjęcia przepisu z pliku, schowka lub drag and drop,
- dodawanie publicznego przepisu do kolekcji,
- dodawanie przepisu do "Mojego planu",
- korzystanie z listy zakupów generowanej na podstawie planu,
- ręczne dodawanie pozycji do listy zakupów,
- odhaczanie posiadanych produktów,
- czyszczenie listy zakupów,
- zarządzanie profilem i ustawieniami konta.

Rekomendowane limity dla wersji darmowej:

- limit liczby prywatnych przepisów, np. 50-100,
- limit liczby kolekcji, np. 5-10,
- limit liczby zdjęć lub limit przestrzeni na zdjęcia,
- limit planu zgodny z MVP, np. do 50 przepisów,
- brak albo bardzo mały limit asystowanego importu AI, np. 3 próby miesięcznie,
- brak generowania zdjęć AI,
- brak importu z URL,
- brak masowego importu przepisów,
- brak zaawansowanych funkcji planowania posiłków.

Rekomendowane funkcje dodatkowe, których może jeszcze nie być:

- ekran pokazujący wykorzystanie limitów darmowego konta,
- delikatne komunikaty upgrade przy osiągnięciu 70-80% limitu,
- możliwość eksportu pojedynczego przepisu, ale bez masowego eksportu całej biblioteki,
- podstawowe udostępnianie przepisu linkiem publicznym,
- zapis ostatnich wyszukiwań i filtrów lokalnie dla wygody.

Uzasadnienie biznesowe:

Zwykły użytkownik musi poczuć, że aplikacja jest użyteczna bez płatności. Jeżeli doda kilkadziesiąt przepisów, uporządkuje je w kolekcjach i zacznie korzystać z listy zakupów, wzrasta prawdopodobieństwo przejścia na premium. Limity powinny pojawiać się dopiero wtedy, gdy użytkownik rozumie wartość produktu.

## 5. Zalogowany użytkownik premium

Użytkownik premium powinien otrzymać funkcje, które oszczędzają czas, zmniejszają tarcie przy dodawaniu przepisów i wspierają codzienne gotowanie. Premium nie powinno być tylko "większą wersją darmową". Powinno dawać poczucie, że aplikacja wykonuje za użytkownika nudną pracę.

Funkcjonalności, które powinien mieć:

- wszystkie funkcje użytkownika zwykłego,
- wyższe albo nielimitowane limity przepisów,
- wyższe albo nielimitowane limity kolekcji,
- większa przestrzeń na zdjęcia,
- asystowane dodawanie przepisu z tekstu bez niskich limitów,
- import przepisu ze zdjęcia,
- import przepisu z URL,
- import przepisu ze zrzutu ekranu lub skanu,
- generowanie zdjęcia AI do przepisu,
- generowanie zdjęcia AI z referencją,
- automatyczna normalizacja składników z wyższym priorytetem,
- inteligentne porządkowanie zaimportowanego przepisu do składników, kroków i wskazówek,
- sugestie kategorii, tagów, kuchni, diety i trudności na podstawie treści przepisu,
- automatyczne przeliczanie porcji i składników,
- zaawansowana lista zakupów z grupowaniem, scalaniem i lepszym rozpoznawaniem jednostek,
- historia importów AI i możliwość powrotu do szkicu,
- masowy import wielu przepisów,
- priorytetowe przetwarzanie zadań AI.

Rekomendowane funkcje premium do rozwoju po MVP:

- planer posiłków na tydzień z ręcznym układem dni,
- automatyczna lista zakupów z planera tygodniowego,
- propozycje posiłków na podstawie własnych przepisów,
- współdzielona rodzinna książka kucharska,
- role w rodzinie, np. właściciel i współdomownik,
- prywatne kolekcje współdzielone z wybranymi osobami,
- automatyczne wykrywanie duplikatów przepisów,
- wersjonowanie przepisu i historia zmian,
- eksport całej biblioteki do PDF lub Markdown,
- kopia zapasowa biblioteki przepisów,
- zaawansowane wyszukiwanie po składnikach, czasie, diecie i okazji,
- zamienniki składników generowane przez AI,
- skalowanie przepisu do liczby osób,
- analiza wartości odżywczych jako osobny, droższy moduł premium w przyszłości.

Rekomendowane ograniczenia mimo premium:

- uczciwy limit miesięczny kosztownych operacji AI, np. generowania zdjęć,
- osobne limity dla taniego importu tekstowego i droższego importu obrazów,
- komunikaty o wykorzystaniu limitu AI,
- możliwość dokupienia pakietu dodatkowych operacji AI, jeżeli koszty modeli będą istotne.

Uzasadnienie biznesowe:

Premium powinno monetyzować funkcje, które mają bezpośredni koszt infrastrukturalny lub bardzo wysoką wartość użytkową. Import z URL, zdjęć i tekstu jest najlepszym kandydatem, bo rozwiązuje największy problem: użytkownik nie chce ręcznie przepisywać swojej kolekcji. Generowanie zdjęć AI jest atrakcyjne wizualnie, ale powinno być dodatkiem, nie głównym powodem subskrypcji.

## 6. Proponowany podział funkcji według priorytetu biznesowego

Priorytet najwyższy:

- import AI z tekstu, zdjęcia i URL jako kluczowa funkcja premium,
- jasne limity darmowego konta,
- ekran upgrade pokazujący konkretne korzyści premium,
- generowanie zdjęć AI tylko dla premium,
- wyższe limity przepisów, kolekcji i zdjęć dla premium.

Priorytet wysoki:

- automatyczne sugestie tagów, kategorii i klasyfikacji przepisu,
- przeliczanie porcji,
- ulepszona lista zakupów,
- masowy import przepisów,
- historia szkiców AI.

Priorytet średni:

- planer tygodniowy,
- współdzielenie rodzinne,
- wykrywanie duplikatów,
- eksport biblioteki,
- kopie zapasowe.

Priorytet niższy na obecnym etapie:

- pełne funkcje społecznościowe, takie jak komentarze, oceny i znajomi,
- zaawansowana analiza wartości odżywczych,
- zarządzanie spiżarnią,
- rozbudowany marketplace przepisów.

## 7. Rekomendowana ścieżka konwersji

Najlepsza ścieżka biznesowa dla aplikacji:

1. Użytkownik niezalogowany znajduje publiczny przepis z wyszukiwarki lub SEO.
2. Chce zapisać przepis do swojej książki kucharskiej i zakłada konto.
3. Dodaje pierwsze przepisy ręcznie lub przez Markdown.
4. Trafia na naturalny problem: ma więcej przepisów w linkach, zdjęciach i notatkach.
5. Aplikacja pokazuje, że Premium importuje te przepisy automatycznie.
6. Użytkownik kupuje subskrypcję, bo płaci za oszczędność czasu, a nie za sam dostęp do aplikacji.

## 8. Wnioski

Najbardziej opłacalny podział funkcji to taki, w którym darmowy użytkownik może zbudować wartościową prywatną książkę kucharską, ale premium staje się oczywistym wyborem dla osób, które chcą szybko przenieść większą liczbę przepisów do aplikacji.

Najważniejsze funkcje premium powinny koncentrować się wokół AI/importu:

- import z URL,
- import ze zdjęcia,
- import z tekstu,
- porządkowanie przepisu przez AI,
- generowanie zdjęć,
- automatyczne sugestie metadanych,
- masowy import.

Takie podejście najlepiej łączy wartość dla użytkownika z opłacalnością biznesową, ponieważ premium finansuje funkcje kosztowe, a jednocześnie odpowiada na realny problem domowego pasjonata gotowania.
