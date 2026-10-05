# PS-91: Uzupełnianie metadanych przepisu przez AI podczas importu z tekstu lub obrazu

## Opis

Jako użytkownik korzystający z asystowanego dodawania przepisów (AI), chcę aby przy imporcie przepisu ze swobodnego tekstu lub z obrazka AI automatycznie uzupełniło liczbę porcji, czas przygotowania, czas całkowity, typ diety, kuchnię, stopień trudności oraz flagi Termorobot i Grill, aby nie musieć uzupełniać tych pól ręcznie i od razu otrzymać prawie kompletny formularz przepisu.

## Kontekst

- Asystowane dodawanie (US-036) przyjmuje tekst lub obraz, wywołuje LLM (`POST /ai/recipes/draft`, format `pycha_recipe_draft_v1`) i wstępnie wypełnia formularz przepisu. Obecnie draft zawiera tylko: nazwę, opis, składniki, kroki, wskazówki, kategorię i tagi.
- Formularz przepisu ma już pola: liczba porcji (US-028), czasy przygotowania i całkowity (US-040), dieta, kuchnia i trudność (US-042), flagi Termorobot (US-029) i Grill (US-043). Po imporcie AI użytkownik musi je uzupełniać ręcznie, co obniża wartość asysty.
- Metadane są używane w filtrach, na kartach i badge'ach (listy, katalog `/explore`), więc ich brak pogarsza wyszukiwanie i prezentację przepisów.
- Wartość biznesowa: większa wartość płatnej funkcji AI (zużywa kredyty `draft`, UI dla `premium`/`admin`), mniej ręcznej pracy, lepsza jakość danych w katalogu.

## Założenia i ograniczenia

### Założenia (przyjęte z powodu braku informacji w wymaganiach)

1. **Zakres funkcji:** zmiana dotyczy wyłącznie importu AI (`POST /ai/recipes/draft`, tekst i obraz). Import Markdown bez LLM (US-013), edycja istniejącego przepisu i generowanie zdjęcia AI nie są objęte zakresem.
2. **Priorytet źródeł:** wartość jawnie podana w tekście lub na obrazie (np. „Porcje: 6”, „Czas przygotowania: 20 min”) **zawsze** ma pierwszeństwo przed wnioskiem AI. AI nigdy nie nadpisuje wartości z treści własnym szacunkiem.
3. **Wnioskowanie:** gdy dana nie występuje w źródle, AI samodzielnie ją wnioskuje na podstawie całego przepisu (składniki, kroki, nazwa). Dotyczy to także obrazu bez tekstu (zdjęcie gotowego dania) — wnioski są wtedy mniej pewne, co może obniżać `meta.confidence`.
4. **Pełne uzupełnienie:** AI powinno zwrócić wartość dla każdego pola. Wyjątki:
    - `cuisine` = `null`, jeśli żadna z 25 dozwolonych kuchni nie pasuje (np. kuchnia uniwersalna),
    - `is_termorobot` i `is_grill` = `false`, gdy brak wskazań na użycie urządzenia (flaga logiczna nie ma stanu „nieznane”).
5. **Termorobot:** `true`, gdy tekst wspomina o Thermomix, Termorobocie, Bimby, Cookeo lub podobnym urządzeniu, albo kroki wprost wymagają czynności typowych dla termorobota (np. „5 min / 100°C / obroty 1”). Pozostałe przypadki → `false`.
6. **Grill:** `true`, gdy tekst mówi o grillu, grillowaniu, barbecue lub rożnie/ruszcie ogrodowym; w pozostałych przypadkach → `false`. Piekarnik z funkcją „grill” nie jest sam w sobie wskazaniem na `true` (AI ocenia kontekst).
7. **Czasy:** wartości w minutach (liczby całkowite). Zapis typu „1 godz. 30 min” → 90. Czas całkowity obejmuje czas „bierny” (marynowanie, wyrastanie, chłodzenie), jeśli jest podany lub wynika z kroków.
8. **Zakresy liczb (spójne z walidacją formularza):** liczba porcji — całkowita 1–99; czasy — całkowite 0–999; czas całkowity ≥ czas przygotowania.
9. **Przedział porcji w tekście** (np. „4–6 porcji”) → przyjmowana jest dolna granica (4).
10. **Wartości niepoprawne nie powodują błędu całego draftu:** pole spoza zakresu lub spoza listy enumów jest odrzucane (`null`/`false`) i dodawane jest ostrzeżenie do `meta.warnings`. Użytkownik nie traci kredytu `draft` z powodu błędnego pojedynczego pola.
11. **Niespójność czasów:** jeśli po odczycie czas całkowity < czas przygotowania, backend ustawia czas całkowity równy czasowi przygotowania i dodaje ostrzeżenie do `meta.warnings`.
12. **Rozróżnienie źródła wartości** (odczytane vs wywnioskowane) nie jest eksponowane w API ani w UI. Użytkownik weryfikuje formularz przed zapisem tak jak dotychczas.
13. **Kompatybilność wsteczna:** nowe pola są dodatkowe w obiekcie `draft`; `output_format` pozostaje `pycha_recipe_draft_v1`. Brak zmian w schemacie bazy danych — przepisy już przechowują te kolumny.
14. **Koszty:** nadal jedno wywołanie LLM i jeden kredyt `draft` na import. Funkcja nie wprowadza dodatkowych kredytów ani endpointów.

### Ograniczenia (wynikające z kontekstu projektu)

- Dozwolone wartości (enumy bazy danych):
    - `diet_type`: `MEAT`, `VEGETARIAN`, `VEGAN`,
    - `difficulty`: `EASY`, `MEDIUM`, `HARD`,
    - `cuisine`: `POLISH`, `ASIAN`, `MEXICAN`, `MIDDLE_EASTERN`, `AFRICAN`, `AMERICAN`, `BALKAN`, `BRAZILIAN`, `BRITISH`, `CARIBBEAN`, `CHINESE`, `FRENCH`, `GERMAN`, `GREEK`, `INDIAN`, `ITALIAN`, `JAPANESE`, `KOREAN`, `MEDITERRANEAN`, `RUSSIAN`, `SCANDINAVIAN`, `SPANISH`, `THAI`, `TURKISH`, `VIETNAMESE`.
- Draft nie jest zapisywany — użytkownik może zmienić każde pole w formularzu przed zapisem.
- Trasa UI `/recipes/new/assist` pozostaje dostępna dla `premium`/`admin`; endpoint API przyjmuje także rolę `user` (bez zmian).
- Wynik LLM jest niedeterministyczny — testy automatyczne weryfikują kontrakt (schemat, normalizację, mapowanie na formularz) na mockowanej odpowiedzi LLM oraz obecność reguł w prompcie, nie „poprawność” wnioskowania modelu.
- Zakres językowy: wartości enumów są niezależne od języka; tekst źródłowy może być w dowolnym języku obsługiwanym przez model (draft jest tłumaczony na polski, jak dotychczas).

## Kryteria akceptacji

### Scenariusz 1: Tekst zawiera wszystkie dane — wartości pochodzą z tekstu (happy path)
- **Given**: zalogowany użytkownik z dostępem do asysty AI i dodatnim saldem kredytów `draft`, który wkleja tekst przepisu zawierający: „Porcje: 6”, „Czas przygotowania: 20 min”, „Czas całkowity: 1 godz. 15 min”, „wegetariańskie”, „kuchnia włoska”, „trudność: łatwe”, „Thermomix” oraz brak wzmianki o grillu
- **When**: uruchamia generowanie draftu
- **Then**: odpowiedź `POST /ai/recipes/draft` zawiera w `draft`: `servings = 6`, `prep_time_minutes = 20`, `total_time_minutes = 75`, `diet_type = "VEGETARIAN"`, `cuisine = "ITALIAN"`, `difficulty = "EASY"`, `is_termorobot = true`, `is_grill = false`; formularz przepisu jest wstępnie wypełniony tymi wartościami

### Scenariusz 2: Tekst zawiera część danych — pozostałe są wnioskowane
- **Given**: tekst przepisu podaje wyłącznie liczbę porcji („dla 4 osób”) i czas przygotowania („30 minut”), bez diety, kuchni, trudności, czasu całkowitego i informacji o urządzeniach
- **When**: użytkownik uruchamia generowanie draftu
- **Then**: `servings = 4` i `prep_time_minutes = 30` pochodzą z tekstu bez zmian; `total_time_minutes`, `diet_type`, `cuisine`, `difficulty` mają wartości wywnioskowane przez AI (czas całkowity ≥ 30, wartości enumów z dozwolonych list); `is_termorobot` i `is_grill` = `false`, jeśli brak wskazań

### Scenariusz 3: Tekst bez żadnych metadanych — wszystko wnioskowane
- **Given**: tekst zawiera wyłącznie nazwę, składniki i kroki (np. polski przepis na pierogi ruskie z ziemniakami i serem)
- **When**: użytkownik uruchamia generowanie draftu
- **Then**: `servings` (1–99), `prep_time_minutes`, `total_time_minutes` (0–999, całkowity ≥ przygotowania) oraz `diet_type`, `difficulty` mają wartości niepuste i z dozwolonych zakresów; `cuisine` ma wartość z listy (w przykładzie `POLISH`) lub `null`, jeśli żadna nie pasuje; formularz jest wypełniony tymi wartościami

### Scenariusz 4: Obraz zawiera tekst przepisu z metadanymi
- **Given**: użytkownik przesyła obraz (PNG/JPG/WebP) ze zdjęciem lub zrzutem przepisu, na którym widnieje np. „Porcje: 8”, „Czas: 45 min” i „Trudność: średnia”
- **When**: uruchamia generowanie draftu
- **Then**: wartości odczytane z obrazu (`servings = 8`, `difficulty = "MEDIUM"` oraz odpowiadający czas) mają pierwszeństwo przed wnioskiem AI; pola nieobecne na obrazie są wywnioskowane

### Scenariusz 5: Obraz gotowego dania bez tekstu
- **Given**: użytkownik przesyła zdjęcie gotowego dania bez żadnego tekstu
- **When**: uruchamia generowanie draftu
- **Then**: wszystkie metadane są wywnioskowane przez AI (wartości z dozwolonych zakresów i enumów, `is_termorobot`/`is_grill` = `false` lub `true` wyłącznie przy wyraźnych przesłankach, np. widoczne grillowane mięso → `is_grill = true`); odpowiedź zawiera `meta.confidence` w przedziale 0–1

### Scenariusz 6: Wykrycie flag Termorobot i Grill
- **Given**: tekst przepisu zawiera „przygotuj na grillu” oraz kroki „zmiksuj 10 s / obroty 8 w Thermomixie”
- **When**: użytkownik uruchamia generowanie draftu
- **Then**: `is_grill = true` oraz `is_termorobot = true`

### Scenariusz 7: Jawna wartość z tekstu wygrywa z wnioskiem AI
- **Given**: tekst jawnie podaje „dieta: wegetariańska”, ale lista składników zawiera produkt typowy dla dania mięsnego
- **When**: użytkownik uruchamia generowanie draftu
- **Then**: `diet_type = "VEGETARIAN"` (zgodnie z tekstem); AI nie nadpisuje wartości własnym wnioskiem

### Scenariusz 8: Przeliczanie i normalizacja zapisów
- **Given**: tekst zawiera „Czas przygotowania: 1 godz. 30 min” i „Porcje: 4–6”
- **When**: użytkownik uruchamia generowanie draftu
- **Then**: `prep_time_minutes = 90` oraz `servings = 4` (dolna granica przedziału)

### Scenariusz 9: Formularz po imporcie — edycja i zapis
- **Given**: draft z kompletem metadanych został przekazany do formularza (`/recipes/new`)
- **When**: użytkownik zmienia dowolne z pól (np. liczbę porcji, dietę, przełącznik Grill) i zapisuje przepis
- **Then**: zapisany przepis zawiera wartości z formularza (zmienione przez użytkownika), a nie oryginalne wartości z draftu; walidacje formularza (porcje 1–99, czasy 0–999, całkowity ≥ przygotowania) działają jak dotychczas

### Scenariusz 10: Pole nieustalone — pusty formularz dla tego pola
- **Given**: odpowiedź draftu zawiera `cuisine = null`
- **When**: formularz jest wypełniany draftem
- **Then**: pole kuchni pozostaje puste (bez wartości domyślnej), pozostałe pola są wypełnione zgodnie z draftem, a formularz nie zgłasza błędu

### Scenariusz 11: Czas całkowity mniejszy niż czas przygotowania (błąd danych AI)
- **Given**: LLM zwrócił `prep_time_minutes = 60` i `total_time_minutes = 40`
- **When**: backend normalizuje draft
- **Then**: `total_time_minutes` zostaje ustawiony na 60, odpowiedź ma status `200`, a `meta.warnings` zawiera informację o korekcie czasu całkowitego

### Scenariusz 12: Wartość spoza zakresu lub spoza listy (błąd danych AI)
- **Given**: LLM zwrócił `servings = 150`, `total_time_minutes = 4320` lub `cuisine = "UNKNOWN_CUISINE"`
- **When**: backend normalizuje draft
- **Then**: każde niepoprawne pole jest odrzucone (`null`; dla flag logicznych `false`), odpowiedź ma status `200` z pozostałą częścią draftu, `meta.warnings` zawiera ostrzeżenie o każdym odrzuconym polu, a kredyt `draft` zostaje zużyty jak dla poprawnego importu

### Scenariusz 13: LLM pominął nowe pola
- **Given**: odpowiedź LLM nie zawiera części lub wszystkich nowych pól metadanych
- **When**: backend waliduje odpowiedź
- **Then**: brakujące pola przyjmują wartości domyślne (`null` dla liczb i enumów, `false` dla flag), odpowiedź ma status `200` (brak błędu `422`/`500` z tego powodu), a `meta.warnings` informuje o niekompletnych metadanych

### Scenariusz 14: Treść nie jest przepisem
- **Given**: użytkownik wkleja tekst, który nie jest pojedynczym przepisem kulinarnym
- **When**: uruchamia generowanie draftu
- **Then**: zachowanie bez zmian — `422` z listą powodów, brak pól metadanych w odpowiedzi, kredyt `draft` zostaje zwrócony

### Scenariusz 15: Zużycie kredytów i uprawnienia bez zmian
- **Given**: użytkownik z saldem `draft` = 1
- **When**: wykonuje jeden poprawny import z metadanymi
- **Then**: zużywany jest dokładnie jeden kredyt `draft`; po wyczerpaniu puli endpoint nadal zwraca `402 AI_CREDITS_EXHAUSTED`; zasady dostępu (rola, rate limit) nie ulegają zmianie

### Scenariusz 16: Prompt zawiera reguły priorytetu i wnioskowania
- **Given**: zaimplementowany prompt systemowy generowania draftu
- **When**: sprawdzana jest jego treść (test jednostkowy)
- **Then**: prompt zawiera: (a) listę ośmiu pól metadanych, (b) regułę „wartość z tekstu/obrazu ma pierwszeństwo, w przeciwnym razie wywnioskuj”, (c) dozwolone wartości enumów `diet_type`, `cuisine`, `difficulty`, (d) zasady dla flag Termorobot i Grill, (e) wymóg czasów w minutach oraz czasu całkowitego ≥ przygotowania, (f) rozszerzony format odpowiedzi JSON z nowymi polami

## Definicja ukończenia (Definition of Done)
- [ ] Prompt systemowy rozszerzony o odczyt/wnioskowanie ośmiu pól (tekst i obraz) wraz z regułą priorytetu źródeł
- [ ] Schemat walidacji odpowiedzi LLM (`AiRecipeDraftOutputSchema`) i typy DTO rozszerzone o nowe pola; normalizacja (zakresy, enumy, `total ≥ prep`, ostrzeżenia w `meta.warnings`)
- [ ] Frontend: DTO `AiRecipeDraftDto` oraz mapowanie draftu na formularz (`populateFormFromDraft`) obsługują nowe pola, w tym wartości `null`
- [ ] Testy jednostkowe pokrywają scenariusze 1–16 (backend: schemat, normalizacja, prompt; frontend: mapowanie na formularz, edycja przed zapisem)
- [ ] Kontrakt `POST /ai/recipes/draft` zaktualizowany w dokumentacji API (`docs/results/main-project-docs/009 API plan.md`) oraz `supabase/functions/ai/test-requests.http`
- [ ] `docs/results/project-summary.md` zaktualizowany (US-036, opis draftu AI)
- [ ] Brak zmian w schemacie bazy danych (potwierdzone)
- [ ] Code review zakończone pozytywnie

## Powiązania
- Zadanie w Jira: PS-91 (link/numer do uzupełnienia po utworzeniu zgłoszenia)
- Powiązane historyjki MVP: US-036 (asystowane dodawanie AI), US-028 (liczba porcji), US-029 (flaga Termorobot), US-040 (czasy), US-042 (klasyfikacja), US-043 (flaga Grill)
- Powiązane zadania: PS-64 (kredyty AI — bez zmian zachowania), PS-34 (poprawa generowania opisu przez AI — ten sam prompt, uwaga na konflikty zmian)
- Wyłączone z zakresu: import Markdown bez LLM (US-013), oznaczanie w UI pól „wywnioskowanych przez AI” (potencjalna osobna historyjka)
