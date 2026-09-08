<conversation_summary>
<decisions>
1.  **Grupa docelowa:** Aplikacja w wersji MVP jest skierowana do pasjonatów gotowania.
2.  **Platforma:** MVP zostanie wdrożone jako responsywna aplikacja webowa, z priorytetem dla widoku desktopowego (desktop-first).
3.  **Dodawanie przepisów:** Użytkownik będzie dodawał przepisy poprzez prosty formularz z `textarea` dla składników i kroków. System automatycznie podzieli każdą linię na osobny element. Nagłówki sekcji (np. `#ciasto`) będą interpretowane do grupowania składników i kroków.
4.  **Struktura przepisu:** Minimalny zestaw danych dla przepisu to: nazwa, opis, składniki, kroki wykonania oraz jedno zdjęcie.
5.  **Edycja przepisu:** Po pierwszym zapisie i sparsowaniu, edycja przepisu będzie odbywać się na ustrukturyzowanych już elementach, a nie na surowym tekście.
6.  **Kategoryzacja:** Aplikacja będzie posiadać stałą, predefiniowaną listę kategorii. Użytkownicy będą mogli dodatkowo grupować przepisy w ramach własnych, dowolnie tworzonych kolekcji.
7.  **Monetyzacja:** Długoterminowym modelem biznesowym są subskrypcje, co powinno być uwzględnione w architekturze (np. poprzez planowanie funkcji premium jak planer posiłków).
8.  **Uwierzytelnianie:** Rejestracja i logowanie będą oparte na minimalnym zestawie danych: e-mail i hasło.
9.  **Interfejs użytkownika (UI):**
    *   **Widok przepisu:** Na desktopie zastosowany będzie układ dwukolumnowy. Góra: nazwa i opis po lewej, zdjęcie po prawej. Dół: kroki po lewej, składniki po prawej.
    *   **Zdjęcia:** Będą automatycznie skalowane i przycinane (`zoom`), aby wypełnić przeznaczony dla nich kontener.
    *   **Nawigacja:** Prosty, górny pasek nawigacyjny z linkami do "Moje przepisy", "Moje kolekcje" i przyciskiem "Dodaj przepis".
    *   **Akcje:** Przyciski "Edytuj" i "Usuń" będą umieszczone w nagłówku widoku przepisu. Usunięcie będzie wymagało prostego potwierdzenia w oknie modalnym.
10. **Kwestie pominięte w MVP:** Analiza konkurencji, obsługa trybu offline, zaawansowane udostępnianie (poza ewentualnym linkiem "read-only"), szczegółowe planowanie harmonogramu i budżetu, definiowanie mierzalnych wskaźików sukcesu (KPI).
</decisions>

<matched_recommendations>
1.  **Doświadczenie użytkownika (UX):** Zamiast pozostawiać pustą listę przepisów dla nowych użytkowników, zostanie zaimplementowany przyjazny "stan pusty" (empty state) z zachętą do działania i wyraźnym przyciskiem.
2.  **Edycja przepisu:** Zgodzono się, że po jednorazowym sparsowaniu przepisu z `textarea`, dalsza edycja powinna odbywać się na poszczególnych, ustrukturyzowanych elementach, co zapewnia większą przewidywalność i stabilność interfejsu.
3.  **Wyszukiwarka:** Wyszukiwarka w MVP będzie prostym wyszukiwaniem tekstowym, obejmującym tytuł, tagi oraz listę składników, odkładając bardziej zaawansowane funkcje na później.
4.  **Tagowanie:** Interfejs do dodawania tagów będzie oparty na nowoczesnym wzorcu, gdzie użytkownik wpisuje tag i zatwierdza go (np. klawiszem Enter), co wizualnie przedstawia go jako "pigułkę".
5.  **Kolejność elementów:** W MVP kolejność kroków i składników będzie zdeterminowana przez kolejność ich wprowadzenia w formularzu. Mechanizm "przeciągnij i upuść" do rearanżacji jest rozważany jako przyszłe usprawnienie.
6.  **Pola opcjonalne:** Mimo że dane takie jak czas przygotowania czy liczba porcji są wartościowe, pominięto je w MVP na rzecz maksymalnego uproszczenia formularza, skupiając się na zdjęciu jako kluczowym elemencie wizualnym.
7.  **Architektura pod przyszłość:** Podjęto decyzję o projektowaniu systemu kont i danych w sposób, który w przyszłości ułatwi wprowadzenie funkcji premium (np. planera posiłków) w ramach modelu subskrypcyjnego.
</matched_recommendations>

<prd_planning_summary>
Na podstawie przeprowadzonej sesji planistycznej, określono wymagania dla MVP aplikacji PychaŚwiatowa, cyfrowej książki kucharskiej dla pasjonatów gotowania.

**a. Główne wymagania funkcjonalne:**
*   **System kont:** Użytkownicy mogą tworzyć konta i logować się za pomocą adresu e-mail i hasła.
*   **Zarządzanie przepisami (CRUD):**
    *   **Tworzenie:** Użytkownik może dodać nowy przepis przez formularz akceptujący surowy tekst dla składników i kroków, z obsługą nagłówków sekcji (`#nazwa`). Wymagane pola to: nazwa, opis, składniki, kroki, zdjęcie.
    *   **Odczyt:** Przepisy są wyświetlane w czytelnym, dwukolumnowym układzie na desktopie.
    *   **Aktualizacja:** Użytkownik może edytować istniejące przepisy.
    *   **Usuwanie:** Użytkownik może usuwać swoje przepisy po potwierdzeniu akcji.
*   **Organizacja przepisów:**
    *   Użytkownik może przypisać przepis do jednej ze stałych, predefiniowanych kategorii.
    *   Użytkownik może dodawać do przepisu dowolne, własne tagi.
    *   Użytkownik może tworzyć własne kolekcje (np. "Ulubione ciasta") i dodawać do nich przepisy.
*   **Wyszukiwanie i przeglądanie:**
    *   Użytkownik może przeszukiwać swoją bazę przepisów po nazwie, składnikach i tagach.
    *   Użytkownik może przeglądać listę wszystkich swoich przepisów, z opcją sortowania (alfabetycznie, po dacie dodania) i filtrowania (po kategorii, po tagu).

**b. Kluczowe historie użytkownika i ścieżki korzystania:**
*   **Digitalizacja przepisu:** "Jako pasjonat gotowania, chcę szybko dodać przepis ze swojego notatnika do aplikacji, wklejając listę składników i kroków, aby system automatycznie je uporządkował, oszczędzając mój czas."
*   **Gotowanie z przepisem:** "Jako użytkownik, chcę na moim komputerze widzieć listę składników obok instrukcji gotowania, abym mógł łatwo śledzić postępy bez ciągłego przewijania strony."
*   **Planowanie tematyczne:** "Jako użytkownik, chcę stworzyć kolekcję 'Dania na święta', aby w jednym miejscu zebrać wszystkie potrzebne przepisy i łatwiej zaplanować świąteczne menu."
*   **Odnajdywanie przepisu:** "Jako użytkownik, chcę szybko znaleźć przepis na 'szarlotkę', wpisując tę frazę w wyszukiwarkę, która przeszuka tytuły i składniki moich przepisów."

**c. Ważne kryteria sukcesu:**
*   Na obecnym, hobbystycznym etapie projektu świadomie zrezygnowano z definiowania mierzalnych wskaźników sukcesu (KPIs). Za sukces MVP uznane zostanie wdrożenie opisanych powyżej funkcjonalności w działającej, responsywnej aplikacji webowej, która spotka się z pozytywnym odbiorem pierwszych użytkowników z docelowej grupy pasjonatów gotowania.

</prd_planning_summary>

<unresolved_issues>
1.  **Szczegółowa obsługa błędów parsowania:** Nie zdefiniowano, jak system ma się zachować, gdy użytkownik wprowadzi tekst w `textarea` w sposób, który jest niejednoznaczny lub niemożliwy do automatycznego podzielenia na składniki i kroki.
2.  **Mechanizm przesyłania i edycji zdjęć:** Poza decyzją o automatycznym przycinaniu, nie określono szczegółów interfejsu przesyłania zdjęć, np. obsługiwanych formatów, limitu rozmiaru czy narzędzi do kadrowania po stronie użytkownika.
3.  **Projekt "stanu pustego" i onboardingu:** Zgodzono się co do potrzeby istnienia "stanu pustego", ale jego dokładny wygląd, treść i ewentualne dodatkowe kroki wprowadzające (onboarding) wymagają dalszego projektowania.
4.  **Lista predefiniowanych kategorii:** Wstępnie zaproponowano listę 8 kategorii, ale wymaga ona ostatecznego potwierdzenia lub ewentualnej modyfikacji przed implementacją.
</unresolved_issues>
</conversation_summary>
