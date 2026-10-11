# PS-97: Generowanie przepisu z linku URL przez AI

## Opis

Jako użytkownik z planem **Premium** lub **Admin**, chcę wkleić link do przepisu znalezionego w internecie i automatycznie wygenerować wstępnie wypełniony formularz przepisu, aby szybko dodawać nowe przepisy ze stron zewnętrznych bez ręcznego przepisywania treści.

---

## Kontekst

Aplikacja oferuje już dwa tryby asystowanego dodawania przepisów przez AI: na podstawie wklejonego tekstu oraz na podstawie zdjęcia/obrazu (`POST /ai/recipes/draft`, tryby `text` i `image`). Użytkownicy często natrafiają na przepisy w internecie i chcą je zapisać w swojej cyfrowej książce kucharskiej. Ręczne kopiowanie treści jest uciążliwe — nowy tryb `url` wyeliminuje ten krok, pozwalając backendowi pobrać zawartość strony, a modelowi AI przetworzyć ją identycznie jak wklejony tekst.

Funkcjonalność jest logicznym rozszerzeniem ekranu `/recipes/new/assist` i endpointu `POST /ai/recipes/draft` o trzeci tryb wejściowy. Korzysta z tej samej puli kredytów `draft` i tych samych zasad dostępu co tryby `text` i `image`.

> **Uwaga:** PS-34 w backlogu Jira dotyczy „Poprawy generowania opisu przez AI" (zmiana promptu systemowego) i jest odrębną, ukończoną historyjką. PS-97 nie zastępuje ani nie modyfikuje PS-34.

---

## Założenia i ograniczenia

- **Dostęp UI:** wyłącznie role `premium` i `admin` (guard `premiumRoleMatchGuard`), identycznie jak pozostałe tryby na `/recipes/new/assist`.
- **Dostęp API:** endpoint akceptuje rolę `user` i rozlicza kredyty `draft` (spójność z trybami `text` i `image`).
- **Scraping po stronie backendu:** pobieranie treści strony odbywa się w Edge Function (unika CORS, nie ujawnia kluczy zewnętrznych serwisów, lepsza obsługa błędów sieciowych).
- **Kredyty:** jeden kredyt `draft` pobierany przed wywołaniem modelu AI, zwracany przy błędzie modelu — identycznie jak w trybach `text`/`image`.
- **Walidacja URL:** format `http://` lub `https://`, poprawna składnia URI; brak ograniczeń domenowych.
- **Brak ponownych prób po stronie frontendu:** przy niedostępnym URL wyświetlany jest czytelny komunikat z sugestią skopiowania treści ręcznie i przejścia do trybu tekstowego.
- **Poza zakresem PS-97:** obsługa stron wymagających logowania (paywall, konto użytkownika), ekstrakcja strukturyzowanych danych z JSON-LD/microdata (opcjonalna optymalizacja w przyszłości), automatyczne ponawianie przy timeoucie.
- **Ograniczenie techniczne:** treść pobierana ze strony traktowana jest jak surowy tekst (po ekstrakcji z HTML) — taki sam input jak tryb `text`.

---

## Kryteria akceptacji

### Scenariusz 1: Pomyślne wygenerowanie przepisu z prawidłowego URL (happy path)

- **Given:** zalogowany użytkownik z rolą `premium` lub `admin` jest na ekranie `/recipes/new/assist`, a pula kredytów `draft` jest niezerowa
- **When:** użytkownik wybiera tryb „Link URL", wkleja poprawny adres `https://` do strony zawierającej przepis i klika „Generuj przepis"
- **Then:**
    - backend pobiera treść strony pod podanym URL (Edge Function),
    - wyekstrahowany tekst jest przekazany do modelu AI (identycznie jak w trybie `text`),
    - użytkownik widzi spinner/wskaźnik ładowania przez cały czas generowania,
    - formularz przepisu (`/recipes/new`) zostaje wstępnie wypełniony wynikiem draftu (nazwa, opis, składniki, kroki, wskazówki, porcje, czasy, dieta, kuchnia, trudność, flagi Termorobot/Grill),
    - kredyt `draft` zostaje odjęty z puli użytkownika,
    - wskaźnik kredytów na ekranie asysty aktualizuje się.

### Scenariusz 2: Nieprawidłowy format URL

- **Given:** użytkownik jest w trybie „Link URL" na `/recipes/new/assist`
- **When:** użytkownik wpisuje ciąg, który nie jest poprawnym URL (np. `nie-to-adres`, `ftp://example.com`, adres bez protokołu)
- **Then:**
    - błąd walidacji wyświetlany jest *inline* pod polem jeszcze przed wysłaniem żądania do API (walidacja po stronie frontendu),
    - żądanie do API **nie** jest wysyłane,
    - kredyt `draft` **nie** jest pobierany.

### Scenariusz 3: Strona niedostępna lub zablokowana

- **Given:** użytkownik wkleił poprawny URL, ale strona zwraca błąd (np. HTTP 403, 404, 429, timeout, strona wymaga logowania / jest za paywallem)
- **When:** użytkownik klika „Generuj przepis"
- **Then:**
    - kredyt `draft` zostaje zarezerwowany, próba pobrania strony nie powiedzie się,
    - kredyt jest **zwracany** do puli (analogicznie jak przy błędzie modelu AI),
    - wyświetlany jest komunikat błędu *inline*: informacja, że strony nie udało się pobrać, z sugestią skopiowania treści przepisu i użycia trybu tekstowego,
    - formularz przepisu **nie** jest otwierany.

### Scenariusz 4: Strona dostępna, ale bez treści przepisu

- **Given:** użytkownik wkleił URL do strony, która nie zawiera przepisu (np. strona główna portalu, artykuł bez listy składników)
- **When:** backend pobiera treść i przekazuje ją do AI
- **Then:**
    - AI zwraca draft z polami `null` / pustymi lub z niską wartością `confidence`,
    - kredyt `draft` zostaje pobrany (żądanie do modelu zostało wykonane),
    - użytkownik widzi formularz z tymi wynikami (możliwe pusty lub częściowo wypełniony),
    - w polach `meta.warnings` mogą znajdować się ostrzeżenia o brakujących danych — wyświetlane zgodnie z istniejącym mechanizmem ostrzeżeń.

### Scenariusz 5: Wyczerpana pula kredytów `draft`

- **Given:** pula kredytów `draft` użytkownika wynosi 0
- **When:** użytkownik klika „Generuj przepis" w trybie „Link URL"
- **Then:**
    - API zwraca `402 AI_CREDITS_EXHAUSTED`,
    - wyświetlany jest istniejący dialog wyczerpania kredytów (Free: CTA do `/pricing`; Premium: informacja o dacie resetu miesięcznego),
    - formularz przepisu **nie** jest otwierany.

### Scenariusz 6: Próba dostępu do trybu URL przez użytkownika z rolą `user` (UI)

- **Given:** zalogowany użytkownik z rolą `user` próbuje wejść na `/recipes/new/assist`
- **When:** próbuje przejść do tej trasy
- **Then:**
    - guard `premiumRoleMatchGuard` blokuje dostęp (identycznie jak dla trybów `text` i `image`),
    - użytkownik jest przekierowywany zgodnie z istniejącą logiką guardu.

### Scenariusz 7: Timeout pobierania strony

- **Given:** użytkownik wkleił poprawny URL, ale serwer docelowy nie odpowiada w wyznaczonym czasie
- **When:** Edge Function przekracza limit czasu pobierania (np. 10 s)
- **Then:**
    - kredyt `draft` jest **zwracany** do puli,
    - wyświetlany jest komunikat *inline* o przekroczeniu czasu oczekiwania z sugestią użycia trybu tekstowego,
    - formularz przepisu **nie** jest otwierany.

---

## Definicja ukończenia (Definition of Done)

- [ ] Kod zaimplementowany zgodnie z opisem (backend: nowy tryb `url` w `POST /ai/recipes/draft`; frontend: nowa zakładka/opcja „Link URL" na `/recipes/new/assist`)
- [ ] Walidacja URL po stronie frontendu (format `http`/`https`, poprawna składnia)
- [ ] Scraping treści strony realizowany wyłącznie w Edge Function (brak żądań ze strony frontendu do zewnętrznych URL)
- [ ] Kredyt `draft` pobierany przed wywołaniem modelu i zwracany przy błędzie pobierania strony lub błędzie modelu
- [ ] Obsługa błędów: 402 (kredyty), timeout, HTTP error, nieprawidłowy URL — komunikaty *inline*, bez snackbara
- [ ] Testy jednostkowe/integracyjne pokrywają scenariusze: happy path, nieprawidłowy URL, niedostępna strona, timeout, `402`
- [ ] Wskaźnik kredytów `draft` na ekranie asysty AI aktualizuje się po pomyślnym wygenerowaniu
- [ ] Dokumentacja techniczna zaktualizowana (`project-summary.md` — endpoint i widok)
- [ ] Code review zakończone pozytywnie

---

## Powiązania

- **Jira:** PS-97 (nowe zgłoszenie; nie zastępuje PS-34)
- **Powiązane historyjki:**
    - US-036 — Asystowane dodawanie (AI): tryb `text` i `image` — PS-97 rozszerza tę samą funkcjonalność o tryb `url`
    - PS-34 — Poprawa generowania opisu przez AI (zmiana promptu systemowego) — odrębna, ukończona historyjka
    - PS-64 — Kredyty AI: mechanizm puli `draft` wielokrotnie wykorzystywany w PS-97
    - PS-92 — Wklej ze schowka: wzorzec obsługi błędów *inline* zastosowany analogicznie w PS-97
