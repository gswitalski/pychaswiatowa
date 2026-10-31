# PS-100: Analiza przepisu AI z wielu zdjęć

## Opis

Jako użytkownik dodający przepis przez asystę AI, chcę wgrać kilka zdjęć jednego przepisu (np. kilka stron książki kucharskiej sfotografowanych telefonem) i uzyskać z nich jeden wspólny draft, aby nie musieć ręcznie łączyć fragmentów przepisu rozłożonego na wielu stronach ani przepisywać go z pominięciem AI.

## Kontekst

PychaŚwiatowa oferuje asystowane dodawanie przepisów (US-036): w trybie „Obraz” na `/recipes/new/assist` użytkownik wgrywa **jedno** zdjęcie, które `POST /ai/recipes/draft` (`source: "image"`) przetwarza na wstępnie wypełniony formularz (z metadanymi z PS-91 i rozliczeniem kredytów `draft` z PS-64).

W praktyce przepis często znajduje się na dwóch–trzech stronach (lista składników na jednej, kroki na kolejnej, wskazówki na następnej). Przy jednym zdjęciu użytkownik musi wybrać jedną stronę, więc draft jest niepełny. Problem narasta na telefonie, gdzie jedno ujęcie rzadko obejmuje cały rozkładówkowy przepis. Funkcja uzupełnia PS-92 (wklej ze schowka), PS-93 (zdjęcie aparatem) i PS-59 (drag & drop w asyście) o możliwość dodania wielu obrazów do jednej analizy.

## Zakres

W zakresie:

- tryb „Obraz” asysty AI (`RecipeNewAssistPageComponent`, `/recipes/new/assist`),
- rozszerzenie `POST /ai/recipes/draft` o wiele obrazów,
- kompresja zdjęć po stronie klienta przed wysyłką,
- zarządzanie listą zdjęć (podgląd, usuwanie, zmiana kolejności).

Poza zakresem:

- zdjęcie dania w formularzu przepisu (`RecipeImageUploadComponent`, `POST /recipes/{id}/image`) — pozostaje pojedyncze,
- zapisywanie wgranych obrazów w Storage lub ustawianie któregoś z nich jako zdjęcia przepisu,
- zmiana gatingu ról i modelu kredytów AI,
- rozpoznawanie, że zdjęcia dotyczą różnych przepisów.

## Założenia i ograniczenia

- **Limit liczby zdjęć:** maksymalnie **5** zdjęć na jedną analizę; wartość trzymana w jednej stałej po stronie frontendu i backendu (łatwa zmiana).
- **Kredyty:** jedno wywołanie draftu = **1 kredyt `draft`**, niezależnie od liczby zdjęć. Rezerwacja przed wywołaniem modelu i zwrot przy błędzie działają jak w PS-64 (`402 AI_CREDITS_EXHAUSTED` przy pustej puli).
- **Limity rozmiaru:** maks. **10 MB na plik** (jak PS-92/PS-93) oraz maks. **15 MB łącznie** (suma rozmiarów po dekodowaniu base64). Backend zwraca `413` po przekroczeniu którejkolwiek granicy.
- **Kompresja po stronie klienta:** zdjęcia większe niż ~1,5 MB są zmniejszane przez canvas (dłuższy bok do 2048 px, JPEG/WebP, jakość ~0,85). Błąd kompresji nie blokuje procesu — wysyłany jest oryginał, o ile mieści się w limitach.
- **Formaty:** PNG, JPEG, WebP (jak dotychczas).
- **Kolejność ma znaczenie:** zdjęcia są przekazywane modelowi w kolejności listy, a prompt zawiera informację „Zdjęcie k z N”. Model traktuje je jako kolejne fragmenty **jednego** przepisu.
- **Zgodność wsteczna kontraktu API:** pozostaje `source: "image"` z polem `image` (pojedynczy obraz) i dochodzi równoległe pole `images` (tablica 1–5 obiektów `{ mime_type, data_base64 }`). Backend wymaga dokładnie jednego z nich; podanie obu lub żadnego → `400 VALIDATION_ERROR`. UI zawsze wysyła `images`.
- **Dodawanie zdjęć:** wszystkie metody (wybór plików z `multiple`, Ctrl+V, „Wklej ze schowka” z PS-92, „Zrób zdjęcie” z PS-93, drag & drop z PS-59, jeśli wdrożony) **dopisują** zdjęcie do listy, a nie zastępują poprzedniego.
- **Zmiana kolejności:** w MVP strzałkami „w lewo/w prawo” (bez drag & drop miniatur).
- **Przechowywanie:** obrazy żyją tylko w pamięci przeglądarki i na czas jednego wywołania modelu; nie trafiają do Storage ani bazy.
- **Dostęp:** bez zmian — trasa `/recipes/new/assist` wymaga `premium`/`admin` (`premiumRoleMatchGuard`), API akceptuje także rolę `user` z rozliczeniem kredytów.
- **Założenie (luka w wymaganiach):** wiele różnych przepisów na zdjęciach nie jest wykrywane; w UI pojawia się jedynie krótka wskazówka, że wszystkie zdjęcia powinny dotyczyć jednego przepisu.
- **Założenie:** etykiety po polsku, m.in. „Dodaj zdjęcia”, „Usuń zdjęcie”, „Przesuń w lewo/w prawo”, „Zdjęcie k z N”, licznik „X / 5”.
- **Założenie:** nieczytelne fragmenty zdjęć nie powodują odrzucenia draftu; są raportowane w `meta.warnings` (spójnie z PS-91), odpowiedź pozostaje `200`.

## Kryteria akceptacji

### Scenariusz 1: Analiza przepisu z kilku zdjęć (happy path)

- **Given**: Zalogowany użytkownik z rolą `premium` lub `admin` jest na `/recipes/new/assist` w trybie „Obraz” i ma dodatnie saldo kredytów `draft`.
- **When**: Dodaje 3 zdjęcia kolejnych stron przepisu (np. wybór 3 plików naraz z galerii) i klika „Dalej”.
- **Then**: UI pokazuje 3 miniatury w kolejności dodania z licznikiem „3 / 5”; wysyłane jest jedno żądanie `POST /ai/recipes/draft` z `source: "image"` i `images` zawierającym 3 obrazy w tej kolejności; formularz zostaje wypełniony jednym połączonym draftem (nazwa, składniki, kroki, metadane z PS-91); pobrany zostaje dokładnie 1 kredyt `draft`.

### Scenariusz 2: Dodawanie zdjęć kolejnymi metodami

- **Given**: Użytkownik ma na liście 1 zdjęcie w trybie „Obraz”.
- **When**: Dodaje kolejne zdjęcia za pomocą Ctrl+V, „Wklej ze schowka” (PS-92) lub „Zrób zdjęcie” (PS-93).
- **Then**: Każde poprawne zdjęcie jest dopisywane na koniec listy (nie zastępuje poprzednich), licznik rośnie, a przycisk „Dalej” pozostaje aktywny.

### Scenariusz 3: Usunięcie zdjęcia z listy

- **Given**: Lista zawiera 3 zdjęcia.
- **When**: Użytkownik klika „Usuń” przy drugim zdjęciu.
- **Then**: Zdjęcie znika z listy, pozostałe zachowują względną kolejność, licznik pokazuje „2 / 5”; po usunięciu ostatniego zdjęcia przycisk „Dalej” jest nieaktywny.

### Scenariusz 4: Zmiana kolejności zdjęć

- **Given**: Lista zawiera co najmniej 2 zdjęcia.
- **When**: Użytkownik klika „Przesuń w prawo” przy pierwszym zdjęciu.
- **Then**: Zdjęcia zamieniają się miejscami, numeracja „Zdjęcie k z N” jest zaktualizowana, a kolejność w żądaniu `POST /ai/recipes/draft` odpowiada kolejności widocznej na liście. Przycisk „w lewo” jest nieaktywny dla pierwszego, a „w prawo” dla ostatniego zdjęcia.

### Scenariusz 4a: Wskazówka o jednym przepisie i kolejności stron

- **Given**: Użytkownik jest w trybie „Obraz”.
- **When**: Ekran jest wyświetlony.
- **Then**: Widoczna jest krótka wskazówka, że wszystkie zdjęcia powinny dotyczyć tego samego przepisu i być dodane w kolejności stron.

### Scenariusz 5: Przekroczenie limitu liczby zdjęć

- **Given**: Lista zawiera 4 zdjęcia (limit 5).
- **When**: Użytkownik wybiera naraz 3 pliki z galerii.
- **Then**: Do listy trafia tylko 1 zdjęcie (do limitu 5), a inline w strefie obrazu pojawia się komunikat o maksymalnie 5 zdjęciach i pominięciu nadmiarowych; przycisk dodawania jest nieaktywny, gdy lista ma już 5 zdjęć; nie wyświetla się snackbar.

### Scenariusz 6: Nieobsługiwany format lub zbyt duży plik

- **Given**: Użytkownik dodaje plik w nieobsługiwanym formacie (np. GIF, PDF) lub większy niż 10 MB.
- **When**: Plik jest wybrany, wklejony lub zrobiony aparatem.
- **Then**: Plik zostaje odrzucony z tym samym komunikatem inline co dotychczas (format lub limit 10 MB); pozostałe pliki z tej samej partii, które są poprawne, zostają dodane; lista i licznik nie uwzględniają odrzuconego pliku.

### Scenariusz 7: Kompresja dużych zdjęć z telefonu

- **Given**: Użytkownik dodaje zdjęcie z telefonu o rozmiarze większym niż ~1,5 MB (np. 12 Mpx, 5 MB).
- **When**: Zdjęcie jest dodawane do listy.
- **Then**: Zdjęcie jest zmniejszane po stronie klienta (dłuższy bok ≤ 2048 px, JPEG/WebP), a miniatura i dane wysyłane do API pochodzą ze zmniejszonej wersji; w czasie przetwarzania miniatura pokazuje stan ładowania, a przycisk „Dalej” jest nieaktywny.

### Scenariusz 8: Niepowodzenie kompresji

- **Given**: Kompresja zdjęcia kończy się błędem (np. brak wsparcia formatu w canvas).
- **When**: Oryginał mieści się w limicie 10 MB.
- **Then**: Zdjęcie zostaje dodane w oryginalnej postaci bez komunikatu o błędzie; jeśli oryginał przekracza 10 MB, zostaje odrzucone jak w scenariuszu 6.

### Scenariusz 9: Przekroczenie łącznego rozmiaru (API)

- **Given**: Suma rozmiarów obrazów w żądaniu po dekodowaniu base64 przekracza 15 MB, a każdy obraz z osobna mieści się w 10 MB.
- **When**: Klient wysyła `POST /ai/recipes/draft` z polem `images`.
- **Then**: API zwraca `413` z komunikatem o przekroczeniu łącznego limitu; kredyt `draft` nie jest pobrany (walidacja przed rezerwacją); UI pokazuje komunikat inline z sugestią usunięcia części zdjęć.

### Scenariusz 10: Pojedynczy obraz w starym kontrakcie (zgodność wsteczna)

- **Given**: Klient wysyła `source: "image"` z polem `image` (bez `images`).
- **When**: Żądanie trafia do `POST /ai/recipes/draft`.
- **Then**: API przetwarza je tak jak dotychczas (jeden obraz, 1 kredyt), bez regresji w odpowiedzi.

### Scenariusz 11: Nieprawidłowy kształt żądania

- **Given**: Żądanie ma `source: "image"` i zawiera jednocześnie `image` oraz `images`, żadne z nich, pustą tablicę `images` lub więcej niż 5 elementów.
- **When**: Żądanie trafia do `POST /ai/recipes/draft`.
- **Then**: API zwraca `400 VALIDATION_ERROR` z informacją o polu, którego dotyczy błąd; kredyt nie jest pobrany.

### Scenariusz 12: Wyczerpane kredyty

- **Given**: Pula kredytów `draft` użytkownika jest wyczerpana.
- **When**: Użytkownik próbuje uruchomić analizę wielu zdjęć.
- **Then**: Zachowanie jak w PS-64: przycisk blokowany i baner w UI, a przy `402 AI_CREDITS_EXHAUSTED` z API — dialog wyczerpania kredytów; żadne wywołanie modelu nie następuje.

### Scenariusz 13: Błąd modelu AI

- **Given**: Kredyt został zarezerwowany, a wywołanie modelu kończy się błędem.
- **When**: API otrzymuje błąd od modelu.
- **Then**: Kredyt jest zwracany (jeden, nie liczba równa liczbie zdjęć), UI pokazuje dotychczasowy komunikat błędu, lista zdjęć pozostaje nienaruszona i użytkownik może ponowić próbę.

### Scenariusz 14: Część zdjęć nieczytelna

- **Given**: Użytkownik wysłał 3 zdjęcia, z których jedno jest nieczytelne, a pozostałe zawierają przepis.
- **When**: Model zwraca draft.
- **Then**: API zwraca `200` z draftem zbudowanym z czytelnych zdjęć oraz wpisem w `meta.warnings` wskazującym numer nieczytelnego zdjęcia; UI wypełnia formularz i informuje o ostrzeżeniu zgodnie z obsługą ostrzeżeń z PS-91.

### Scenariusz 15: Brak tekstu przepisu na żadnym zdjęciu

- **Given**: Żadne z przesłanych zdjęć nie zawiera rozpoznawalnego przepisu.
- **When**: Model nie jest w stanie zbudować draftu.
- **Then**: API zwraca dotychczasowy błąd dla obrazu bez przepisu, kredyt jest zwracany, a UI pokazuje komunikat bez wypełniania formularza.

### Scenariusz 16: Stan ładowania

- **Given**: Analiza zdjęć trwa (`isLoading()`).
- **When**: Użytkownik próbuje dodać, usunąć lub przesunąć zdjęcia albo ponownie kliknąć „Dalej”.
- **Then**: Wszystkie te akcje są nieaktywne do zakończenia bieżącej operacji.

### Scenariusz 17: Dostępność i klawiatura

- **Given**: Użytkownik korzysta z klawiatury lub czytnika ekranu w trybie „Obraz”.
- **When**: Przechodzi przez przyciski dodawania, usuwania i zmiany kolejności.
- **Then**: Każdy przycisk ma etykietę ARIA (np. „Usuń zdjęcie 2 z 3”), jest osiągalny z klawiatury i ma widoczny fokus; zmiana licznika i błędów jest ogłaszana (`aria-live`).

## Definicja ukończenia (Definition of Done)

- [ ] Backend: `AiRecipeDraftRequestSchema` obsługuje `images` (1–5) równolegle do `image`, walidacja „dokładnie jedno z nich”, limity 10 MB/plik i 15 MB łącznie (`413`), walidacja przed rezerwacją kredytu
- [ ] Backend: `generateRecipeDraft` przekazuje modelowi wszystkie obrazy w kolejności z promptem „Zdjęcie k z N”; ostrzeżenia o nieczytelnych zdjęciach trafiają do `meta.warnings`; 1 kredyt `draft` na wywołanie, jeden zwrot przy błędzie
- [ ] Frontend: lista zdjęć w trybie „Obraz” z miniaturami, licznikiem „X / 5”, usuwaniem, zmianą kolejności, `input[type=file][multiple]` oraz dopisywaniem z Ctrl+V / PS-92 / PS-93
- [ ] Frontend: kompresja po stronie klienta z fallbackiem na oryginał (wydzielona do współdzielonego serwisu)
- [ ] Brak regresji kontraktu: żądanie z pojedynczym `image` działa jak dotychczas
- [ ] Testy jednostkowe (Vitest) pokrywają scenariusze akceptacji: dodawanie, limit 5, odrzucanie plików, kolejność, usuwanie, kompresja i fallback, stany disabled
- [ ] Testy backendu pokrywają: `images` vs `image`, `400`, `413`, `402`, zwrot kredytu, ostrzeżenia
- [ ] Test manualny na urządzeniu mobilnym (Android Chrome i/lub iOS Safari) z 2–3 zdjęciami z aparatu oraz smoke na desktopie
- [ ] Dokumentacja zaktualizowana: `docs/results/project-summary.md` (API draftu, widok asysty, US/PS-100), plany API/UI w katalogu PS-100
- [ ] Code review zakończone pozytywnie

## Powiązania

- **PS-100** — to zgłoszenie
- **US-036** — Asystowane dodawanie (AI) — rozszerzany tryb „Obraz”
- **PS-91** — Metadane draftu AI (`meta.warnings`)
- **PS-64** — Kredyty AI (rezerwacja i zwrot kredytu `draft`)
- **PS-92** — Wklej ze schowka (dopisywanie do listy zdjęć)
- **PS-93** — Zdjęcie aparatem urządzenia mobilnego (dopisywanie do listy zdjęć)
- **PS-59** (backlog) — Drag & drop obrazka do asysty AI
- Widok: `/recipes/new/assist`
- Endpoint: `POST /ai/recipes/draft` (rozszerzenie o `images`)
