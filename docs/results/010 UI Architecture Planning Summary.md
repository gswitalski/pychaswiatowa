<conversation_summary>
<decisions>
Aplikacja będzie posiadać główny Dashboard dla zalogowanych użytkowników, służący jako centrum nawigacyjne do sekcji "Moje przepisy" i "Moje kolekcje".
Główna nawigacja zostanie zaimplementowana jako stały, boczny panel (sidebar) po lewej stronie, który na urządzeniach mobilnych będzie zwijany do ikony "hamburger menu".
Dla niezalogowanych użytkowników zostanie przygotowana prosta strona lądowania (landing page) z opcjami logowania i rejestracji.
Widok listy przepisów będzie wyświetlał kafelki zawierające zdjęcie, nazwę oraz kategorię przepisu.
Szczegóły przepisu na desktopie będą prezentowane w układzie dwukolumnowym (składniki i kroki obok siebie), który na urządzeniach mobilnych zmieni się w układ jednokolumnowy.
Dodawanie przepisu do kolekcji będzie realizowane poprzez modal, który pozwoli wybrać istniejącą kolekcję lub dynamicznie utworzyć nową.
Wyszukiwarka na liście przepisów będzie działać dynamicznie z opóźnieniem (debounce time 300ms).
Zakres MVP został świadomie rozszerzony o funkcjonalność zmiany kolejności składników i kroków za pomocą mechanizmu "przeciągnij i upuść" (drag & drop).
Do obsługi błędów i komunikatów o statusie operacji (sukces, błąd) będą używane komponenty typu "toast/snackbar".
Aplikacja będzie obsługiwać stany puste (np. brak przepisów, brak wyników wyszukiwania) za pomocą dedykowanych komunikatów i wezwań do akcji.
Zarządzanie profilem i wylogowanie będzie dostępne z rozwijanego menu pod ikoną awatara użytkownika w prawym górnym rogu.
Aplikacja za pomocą HttpInterceptor będzie automatycznie wylogowywać użytkownika i przekierowywać go do strony logowania w przypadku wygaśnięcia sesji (błąd 401).
</decisions>
<matched_recommendations>
Układ i Nawigacja: Zostanie zastosowany główny layout z bocznym, zwijanym panelem nawigacyjnym (sidebar), co zapewni spójny dostęp do kluczowych sekcji: Dashboardu, Listy Przepisów i Listy Kolekcji.
Formularz Przepisu: Formularz dodawania i edycji zostanie podzielony na logiczne sekcje (dane podstawowe, składniki, kroki). Listy składników i kroków będą edytowalne na poziomie pojedynczych elementów i będą wspierać zmianę kolejności za pomocą funkcji "przeciągnij i upuść" (Angular CDK Drag and Drop).
Zarządzanie Stanem Globalnym: Dane globalne, takie jak predefiniowane kategorie, zostaną pobrane jednorazowo przy starcie aplikacji i udostępnione w całej aplikacji za pomocą dedykowanego serwisu, co zminimalizuje liczbę zapytań do API.
Obsługa Błędów i Sesji: Zostanie zaimplementowany globalny HttpInterceptor, który będzie centralnym punktem obsługi błędów API. Będzie on odpowiedzialny za wyświetlanie komunikatów dla użytkownika oraz za automatyczne zarządzanie sesją (przekierowanie na stronę logowania po otrzymaniu statusu 401).
Responsywność (RWD): Wszystkie kluczowe widoki, w szczególności dwukolumnowy układ szczegółów przepisu, zostaną dostosowane do poprawnego wyświetlania na urządzeniach mobilnych, przechodząc na układy jednokolumnowe.
UX - Informacja Zwrotna: Aplikacja będzie na bieżąco informować użytkownika o swoim stanie za pomocą wskaźników ładowania (mat-spinner, mat-progress-bar) oraz komunikatów o wyniku operacji (toast/snackbar).
Optymalizacja Wydajności: Zostanie wdrożona optymalizacja ładowania obrazów na listach przepisów poprzez wykorzystanie miniaturek generowanych przez Supabase oraz zastosowanie techniki "lazy loading".
</matched_recommendations>
<ui_architecture_planning_summary>
a. Główne wymagania dotyczące architektury UI
Architektura UI aplikacji PychaŚwiatowa opierać się będzie na frameworku Angular 20 z biblioteką komponentów Angular Material. Głównym założeniem jest stworzenie aplikacji "desktop-first" z pełną responsywnością. Centralnym punktem dla zalogowanego użytkownika będzie Dashboard. Nawigacja oparta zostanie o boczny, zwijany panel (sidebar). Aplikacja będzie intensywnie wykorzystywać komponenty Angular Material do budowy formularzy, okien modalnych, paginacji, wskaźników postępu i powiadomień, co zapewni spójność wizualną i przyspieszy rozwój.
b. Kluczowe widoki, ekrany i przepływy użytkownika
Strona dla gości: Prosty landing page z opcją logowania i rejestracji.
Dashboard: Strona główna po zalogowaniu, z nawigacją do przepisów i kolekcji oraz sekcją "Ostatnio dodane".
Moje Przepisy: Widok listy wszystkich przepisów użytkownika w formie siatki kafelków. Strona ta będzie wyposażona w funkcje wyszukiwania, sortowania i filtrowania (po kategoriach i tagach).
Szczegóły Przepisu: Widok pojedynczego przepisu z dwukolumnowym layoutem (składniki/kroki) na desktopie. Zawiera opcje edycji, usunięcia i dodania do kolekcji.
Formularz Przepisu (Dodaj/Edytuj): Wielosekcyjny formularz do zarządzania danymi przepisu. Kluczowym elementem jest interaktywna lista składników i kroków z funkcją "przeciągnij i upuść".
Moje Kolekcje: Widok z listą kolekcji użytkownika. Umożliwia tworzenie, edycję i usuwanie kolekcji.
Szczegóły Kolekcji: Widok wyświetlający listę przepisów należących do danej kolekcji.
Ustawienia Konta: Strona pozwalająca na zmianę nazwy użytkownika, hasła oraz usunięcie konta.
c. Strategia integracji z API i zarządzania stanem
Komunikacja z backendem (Supabase) będzie odbywać się poprzez REST API. Kluczową rolę odegra globalny HttpInterceptor, który będzie dołączał token autoryzacyjny do każdego zapytania oraz centralnie obsługiwał błędy, w tym wygaśnięcie sesji (status 401). Zarządzanie stanem w aplikacji będzie realizowane głównie poprzez serwisy Angulara. Dane o zasięgu globalnym (np. lista kategorii, dane zalogowanego użytkownika) będą przechowywane w singletonowych serwisach i udostępniane komponentom za pomocą BehaviorSubject lub Observable, aby zapewnić reaktywność interfejsu.
d. Kwestie dotyczące responsywności, dostępności i bezpieczeństwa
Responsywność: Wszystkie widoki zostaną zaprojektowane z myślą o poprawnym działaniu na różnych rozmiarach ekranu, od urządzeń mobilnych po duże monitory. Główne mechanizmy to zmiana układu z wielokolumnowego na jednokolumnowy oraz zwijany boczny panel nawigacyjny.
Dostępność: Wykorzystanie Angular Material pomoże w zapewnieniu podstawowego poziomu dostępności (ARIA attributes, nawigacja klawiaturą). Należy zwrócić uwagę na odpowiedni kontrast i etykiety dla elementów formularzy.
Bezpieczeństwo: Po stronie frontendu, bezpieczeństwo opiera się na zarządzaniu tokenem JWT. Aplikacja nie będzie przechowywać wrażliwych danych w localStorage. HttpInterceptor zapewni obsługę wygaśnięcia sesji, wymuszając ponowne logowanie. Dostęp do poszczególnych widoków (route'ów) będzie chroniony za pomocą AuthGuard.
</ui_architecture_planning_summary>
<unresolved_issues>
Brak nierozwiązanych kwestii. Wszystkie przedstawione rekomendacje zostały zaakceptowane, a zakres MVP został świadomie zaktualizowany.
</unresolved_issues>
</conversation_summary>
