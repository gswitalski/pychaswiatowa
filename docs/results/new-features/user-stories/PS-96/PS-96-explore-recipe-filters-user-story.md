# PS-96: Filtry przepisów w katalogu Odkrywaj

## Opis

Jako użytkownik katalogu `/explore`, chcę filtrować publiczne przepisy za pomocą czytelnych filtrów (chipów / ikon) wyświetlonych w jednej linii pod polem wyszukiwania, aby szybko odnaleźć przepisy pasujące do moich preferencji kulinarnych lub oznaczone moimi prywatnymi flagami — bez konieczności wpisywania tekstu.

---

## Kontekst

Katalog `Odkrywaj` (`/explore`) umożliwia przeglądanie publicznych przepisów z wyszukiwaniem pełnotekstowym. Endpoint `GET /public/recipes` obsługuje już parametry `termorobot`, `grill` i `diet_type`, jednak warstwa UI nie udostępnia tych filtrów użytkownikowi. Filtrowanie po flagach osobistych (`is_favorite`, `is_want_to_try`) nie jest jeszcze zaimplementowane ani w API, ani w UI (PS-95 obejmował wyłącznie ustawianie flag i wskaźnik serduszka na kafelkach). Historyjka realizuje oddzielny wpis z backlogu produktowego zaznaczony w project-summary jako planowana osobna historyjka.

---

## Założenia i ograniczenia

- Filtry **„Ulubione"** i **„Chcę wypróbować"** są widoczne i aktywne **wyłącznie dla zalogowanych użytkowników** (gość ich nie widzi); pozostałe filtry (Termorobot, Grill, Dieta) są widoczne dla wszystkich.
- Historyjka obejmuje **zarówno warstwę API** (rozszerzenie `GET /public/recipes` o obsługę parametrów `favorite=true` i `want_to_try=true` dla uwierzytelnionego żądania) **jak i warstwę UI** (komponenty filtrów na stronie `/explore`).
- Wszystkie aktywne filtry działają w trybie **AND** — każdy kolejny filtr zawęża zbiór wyników.
- Aktywne filtry są **synchronizowane z URL** (query params), co umożliwia bookmarkowanie i udostępnianie przefiltrowanych widoków; filtry resetują się po opuszczeniu strony.
- Filtr diety to **chip-group single-select** z trzema wzajemnie wykluczającymi się wariantami:
  - *Wszystkie* (brak filtra `diet_type`)
  - *Wegetariańskie+* (mapuje na `diet_type=VEGE` i `diet_type=VEGAN`, czyli union)
  - *Tylko wegańskie* (mapuje na `diet_type=VEGAN`)
- Filtry Termorobot i Grill to **toggle-chipy** (aktywny / nieaktywny), najlepiej z ikonkami Material.
- Filtry flag (Ulubione, Chcę wypróbować) to toggle-chipy widoczne tylko dla zalogowanych.
- Ograniczenie techniczne: filtrowanie po flagach na poziomie API wymaga autoryzowanego żądania; gość otrzymuje wyniki bez parametrów flag.
- Istniejące parametry `q` (wyszukiwanie tekstowe) współpracują z filtrami (stack AND).
- Paginacja (load more 12) resetuje się przy zmianie filtrów.

---

## Kryteria akceptacji

### Scenariusz 1: Gość widzi ograniczony zestaw filtrów

- **Given**: użytkownik nie jest zalogowany i odwiedza stronę `/explore`
- **When**: strona się załaduje
- **Then**: pod polem wyszukiwania wyświetlana jest linia filtrów zawierająca **wyłącznie**: Termorobot, Grill, Dieta (chip-group); filtry „Ulubione" i „Chcę wypróbować" **nie są widoczne**

---

### Scenariusz 2: Zalogowany widzi pełny zestaw filtrów

- **Given**: użytkownik jest zalogowany i odwiedza stronę `/explore`
- **When**: strona się załaduje
- **Then**: pod polem wyszukiwania widoczna jest linia wszystkich pięciu filtrów: Ulubione, Chcę wypróbować, Dieta (chip-group), Termorobot, Grill

---

### Scenariusz 3: Filtr Termorobot — happy path

- **Given**: zalogowany lub niezalogowany użytkownik jest na `/explore` bez aktywnych filtrów
- **When**: kliknie chip „Termorobot"
- **Then**:
  - chip zmienia stan na aktywny (wyróżniony wizualnie)
  - lista przepisów odświeża się i zawiera **wyłącznie** przepisy z flagą `is_termorobot = true`
  - URL aktualizuje się do `?termorobot=true`
  - licznik wyników (lub empty state) odzwierciedla nowy zbiór

---

### Scenariusz 4: Filtr Grill — analogicznie do Termorobot

- **Given**: użytkownik jest na `/explore`
- **When**: kliknie chip „Grill"
- **Then**:
  - wyświetlane są wyłącznie przepisy z `is_grill = true`
  - URL zawiera `?grill=true`

---

### Scenariusz 5: Filtr diety — wariant „Wegetariańskie+"

- **Given**: użytkownik jest na `/explore` z aktywnym chipem „Wszystkie" (domyślnym)
- **When**: kliknie chip „Wegetariańskie+"
- **Then**:
  - wyświetlane są przepisy z `diet_type` równym `VEGE` **lub** `VEGAN`
  - URL zawiera `?diet=vege_plus`
  - chip „Wegetariańskie+" jest aktywny, pozostałe warianty diety — nieaktywne

---

### Scenariusz 6: Filtr diety — wariant „Tylko wegańskie"

- **Given**: użytkownik jest na `/explore`
- **When**: kliknie chip „Tylko wegańskie"
- **Then**:
  - wyświetlane są wyłącznie przepisy z `diet_type = VEGAN`
  - URL zawiera `?diet=vegan`

---

### Scenariusz 7: Reset filtru diety do „Wszystkie"

- **Given**: aktywny jest chip „Wegetariańskie+" lub „Tylko wegańskie"
- **When**: użytkownik kliknie chip „Wszystkie"
- **Then**:
  - filtr diety zostaje usunięty (brak `diet_type` w żądaniu)
  - URL nie zawiera parametru `diet`
  - lista pokazuje przepisy bez ograniczenia diety

---

### Scenariusz 8: Filtr „Ulubione" (zalogowany)

- **Given**: zalogowany użytkownik jest na `/explore`
- **When**: kliknie chip „Ulubione"
- **Then**:
  - API wysyła żądanie z parametrem `favorite=true` (autoryzowane)
  - lista przepisów zawiera **wyłącznie** przepisy oznaczone przez tego użytkownika flagą `is_favorite`
  - URL zawiera `?favorite=true`

---

### Scenariusz 9: Filtr „Chcę wypróbować" (zalogowany)

- **Given**: zalogowany użytkownik jest na `/explore`
- **When**: kliknie chip „Chcę wypróbować"
- **Then**:
  - API wysyła żądanie z parametrem `want_to_try=true`
  - lista zawiera wyłącznie przepisy z flagą `is_want_to_try` tego użytkownika
  - URL zawiera `?want_to_try=true`

---

### Scenariusz 10: Kombinowanie filtrów (AND)

- **Given**: zalogowany użytkownik jest na `/explore`
- **When**: aktywuje jednocześnie „Ulubione" oraz „Termorobot"
- **Then**:
  - API otrzymuje parametry `favorite=true&termorobot=true`
  - wyświetlane są **wyłącznie** przepisy będące jednocześnie ulubionymi użytkownika **i** termorobotowymi
  - URL zawiera oba parametry: `?favorite=true&termorobot=true`

---

### Scenariusz 11: Kombinowanie filtrów z wyszukiwaniem tekstowym

- **Given**: użytkownik wpisał w pole wyszukiwania frazę (min. 3 znaki) i aktywował filtr „Grill"
- **When**: lista się odświeży
- **Then**:
  - wyniki spełniają **jednocześnie** kryterium tekstowe (relevance) **i** `is_grill = true`
  - oba warunki obecne w URL: `?q=tekst&grill=true`

---

### Scenariusz 12: Brak wyników po filtracji

- **Given**: użytkownik aktywował filtr lub kombinację filtrów, dla której nie istnieją pasujące przepisy
- **When**: API zwróci pustą listę
- **Then**:
  - wyświetlony jest czytelny **empty state** informujący o braku wyników dla aktywnych filtrów
  - widoczna jest sugestia zresetowania filtrów (przycisk lub link „Wyczyść filtry")

---

### Scenariusz 13: Deaktywacja filtru

- **Given**: filtr toggle-chip (Termorobot, Grill, Ulubione lub Chcę wypróbować) jest aktywny
- **When**: użytkownik kliknie go ponownie
- **Then**:
  - chip wraca do stanu nieaktywnego
  - lista odświeża się bez tego parametru
  - URL nie zawiera już odpowiedniego query param

---

### Scenariusz 14: Synchronizacja filtrów z URL przy wejściu na stronę

- **Given**: użytkownik wchodzi na `/explore?termorobot=true&diet=vegan` (np. z bookmarku)
- **When**: strona się załaduje
- **Then**:
  - chipy „Termorobot" i „Tylko wegańskie" są od razu w stanie aktywnym
  - lista przepisów jest natychmiast przefiltrowana bez dodatkowej interakcji

---

### Scenariusz 15: Paginacja resetuje się po zmianie filtrów

- **Given**: użytkownik załadował kilka stron wyników (load more)
- **When**: aktywuje lub deaktywuje dowolny filtr
- **Then**:
  - lista wraca do pierwszej strony (offset 0)
  - przycisk „Wczytaj więcej" działa poprawnie dla nowego zestawu filtrów

---

## Definicja ukończenia (Definition of Done)

- [ ] Endpoint `GET /public/recipes` (i `/public/recipes/feed`) obsługuje parametry `favorite` i `want_to_try` dla uwierzytelnionych żądań; nieautoryzowane żądania ignorują te parametry
- [ ] Filtr `diet=vege_plus` na poziomie API zwraca przepisy `VEGE` i `VEGAN` (union)
- [ ] Komponenty chipów filtrów zaimplementowane na `/explore` zgodnie z Angular Material
- [ ] Filtry „Ulubione" i „Chcę wypróbować" renderowane warunkowo (tylko dla zalogowanych)
- [ ] Synchronizacja filtrów z URL (query params) przy aktywacji i przy wejściu na stronę z parametrami
- [ ] Paginacja (load more) resetuje się po zmianie aktywnych filtrów
- [ ] Empty state przy braku wyników z opcją czyszczenia filtrów
- [ ] Testy jednostkowe komponentu filtrów (stany chipów, emisja zdarzeń, warunkowe renderowanie)
- [ ] Testy jednostkowe logiki mapowania query params ↔ parametry API
- [ ] Testy integracyjne: filtr Termorobot, filtr diety, filtr flag (zalogowany), kombinacja AND
- [ ] Code review zakończone pozytywnie
- [ ] Dokumentacja techniczna zaktualizowana (project-summary, sekcja Widoki i Endpointy)

---

## Powiązania

- **Jira:** PS-96
- **Powiązane historyjki:**
  - [PS-95 — Osobiste flagi przepisu](../PS-95/PS-95-recipe-favorite-and-try-flags-user-story.md) — implementacja flag `is_favorite` / `is_want_to_try` i ich odczytu; PS-96 dodaje filtrowanie po tych flagach
  - US-018 — Wyszukiwanie publicznych przepisów (pole `q` współpracuje z filtrami)
  - US-019 — Szczegóły publicznego przepisu (wspólny kontekst katalogu `/explore`)
