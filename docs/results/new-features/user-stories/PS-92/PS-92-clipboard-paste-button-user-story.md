# PS-92: Dedykowany przycisk wklejania zdjęcia ze schowka

## Opis
Jako użytkownik wprowadzający przepis do systemu, chcę mieć dedykowany przycisk „Wklej ze schowka" w strefie zdjęcia formularza przepisu, aby móc łatwo wkleić grafikę bez konieczności ręcznego ustawiania fokusu na pole obrazka.

## Kontekst

Formularz przepisu (`/recipes/new`, `/recipes/:id/edit`) obsługuje już wgrywanie zdjęć metodami: plik (file input), drag & drop oraz Ctrl+V (US-027). Mechanizm Ctrl+V wymaga jednak wcześniejszego kliknięcia bardzo blisko pola obrazka, aby niewidoczny element przechwytujący zdarzenia klawiatury zyskał fokus — bez tego Ctrl+V nie działa. Dla użytkownika jest to nieintuicyjne i uciążliwe, zwłaszcza gdy kursor myszy nie znajduje się w pobliżu strefy obrazka. Dodanie dedykowanego przycisku „Wklej ze schowka" wywoła systemowe Clipboard API bezpośrednio po kliknięciu, eliminując potrzebę ręcznego zarządzania fokusem.

## Założenia i ograniczenia

- Istniejący skrót Ctrl+V oraz drag & drop pozostają dostępne równolegle z nowym przyciskiem (brak zmian w ich działaniu).
- Przycisk wywołuje przeglądarkowe **Clipboard API** (`navigator.clipboard.read()`), które jest dostępne wyłącznie w bezpiecznym kontekście (HTTPS) i wymaga pozwolenia użytkownika.
- W przeglądarkach nieobsługujących `Clipboard API` przycisk jest ukryty lub nieaktywny (`disabled`) — nie blokuje to istniejących metod wgrywania zdjęcia.
- Obsługiwane formaty to te same co przy wgrywaniu pliku: `image/png`, `image/jpeg`, `image/webp`.
- Maksymalny rozmiar pliku: 10 MB (spójnie z endpointem `POST /recipes/{id}/image`).
- Przycisk pojawia się zarówno w kreatorze nowego przepisu (`/recipes/new`), jak i w edycji istniejącego (`/recipes/:id/edit`), w tym w trybie asystowanym AI.
- Po wklejeniu zdjęcia zachowanie jest spójne z istniejącym flow paste/drop: podgląd, możliwość cofnięcia (Undo), upload przy zapisaniu lub natychmiastowo (zgodnie z obecną logiką komponentu).

## Kryteria akceptacji

### Scenariusz 1: Wklejenie zdjęcia ze schowka — ścieżka podstawowa (happy path)
- **Given**: Użytkownik jest na stronie formularza przepisu (`/recipes/new` lub `/recipes/:id/edit`) oraz w schowku systemowym znajduje się obraz w obsługiwanym formacie (PNG, JPG lub WebP).
- **When**: Użytkownik klika przycisk „Wklej ze schowka" znajdujący się w strefie zdjęcia.
- **Then**: Przeglądarka (jeśli jeszcze nie udzielono pozwolenia) wyświetla systemowy dialog o dostęp do schowka; po jego zatwierdzeniu obraz jest odczytywany ze schowka, wyświetlany jako podgląd w strefie zdjęcia i zachowuje się tak samo jak obraz wklejony przez Ctrl+V (możliwość cofnięcia / Undo, dalszy upload przy zapisie).

### Scenariusz 2: Schowek nie zawiera obrazu
- **Given**: Użytkownik jest na stronie formularza przepisu, a schowek systemowy jest pusty lub zawiera wyłącznie tekst / inne dane niebędące obrazem.
- **When**: Użytkownik klika przycisk „Wklej ze schowka".
- **Then**: Aplikacja wyświetla komunikat informacyjny (np. snackbar / komunikat inline): „Schowek nie zawiera obrazu. Skopiuj grafikę i spróbuj ponownie." Strefa zdjęcia pozostaje bez zmian.

### Scenariusz 3: Format obrazu w schowku jest nieobsługiwany
- **Given**: W schowku systemowym znajduje się obraz w nieobsługiwanym formacie (np. `image/gif`, `image/svg+xml`, `image/tiff`).
- **When**: Użytkownik klika przycisk „Wklej ze schowka".
- **Then**: Aplikacja wyświetla komunikat o błędzie: „Nieobsługiwany format pliku. Dozwolone formaty: PNG, JPG, WebP." Strefa zdjęcia pozostaje bez zmian.

### Scenariusz 4: Przekroczony rozmiar obrazu ze schowka
- **Given**: W schowku systemowym znajduje się obraz przekraczający 10 MB.
- **When**: Użytkownik klika przycisk „Wklej ze schowka".
- **Then**: Aplikacja wyświetla komunikat o błędzie: „Plik jest zbyt duży. Maksymalny rozmiar to 10 MB." Strefa zdjęcia pozostaje bez zmian.

### Scenariusz 5: Użytkownik odmawia dostępu do schowka
- **Given**: Użytkownik klika przycisk „Wklej ze schowka" i przeglądarka wyświetla systemowy dialog o uprawnienia.
- **When**: Użytkownik odmawia dostępu do schowka.
- **Then**: Aplikacja wyświetla komunikat informacyjny: „Brak dostępu do schowka. Zezwól na dostęp w ustawieniach przeglądarki lub użyj Ctrl+V." Strefa zdjęcia pozostaje bez zmian.

### Scenariusz 6: Przeglądarka nie obsługuje Clipboard API
- **Given**: Użytkownik korzysta z przeglądarki nieobsługującej `navigator.clipboard.read()` (brak HTTPS lub stara przeglądarka).
- **When**: Użytkownik wchodzi na stronę formularza przepisu.
- **Then**: Przycisk „Wklej ze schowka" jest ukryty lub wyświetlany jako nieaktywny (`disabled`) z tooltipem informującym, że funkcja jest niedostępna w tej przeglądarce. Dostępne pozostają metody: Ctrl+V, drag & drop, wgranie pliku.

### Scenariusz 7: Przycisk dostępny zarówno przy braku zdjęcia, jak i przy jego obecności
- **Given**: Formularz przepisu ma już przypisane zdjęcie.
- **When**: Użytkownik klika przycisk „Wklej ze schowka" ze zdjęciem w schowku.
- **Then**: Dotychczasowe zdjęcie jest zastępowane nowym (tak samo jak przy ponownym paste/drop). Dostępna jest opcja cofnięcia (Undo), jeśli jest zaimplementowana w bieżącym komponencie.

## Definicja ukończenia (Definition of Done)

- [ ] Kod zaimplementowany zgodnie z opisem (nowy przycisk w komponencie strefy zdjęcia formularza przepisu)
- [ ] Przycisk wywołuje `navigator.clipboard.read()` i przekazuje odczytany blob przez istniejący mechanizm obsługi wklejonego obrazu
- [ ] Detekcja dostępności Clipboard API — przycisk ukryty/disabled, gdy API niedostępne
- [ ] Obsługa wszystkich przypadków błędów (pusty schowek, zły format, za duży plik, brak uprawnienia)
- [ ] Testy jednostkowe/integracyjne pokrywają scenariusze akceptacji (mock `navigator.clipboard`)
- [ ] Przycisk jest dostępny (a11y): ma etykietę ARIA, obsługuje focus klawiaturowy
- [ ] Wygląd i rozmieszczenie przycisku zgodne z design system Angular Material (spójność z pozostałymi akcjami w strefie zdjęcia)
- [ ] Zachowanie przetestowane manualnie na Chromium, Firefox i WebKit (Playwright)
- [ ] Code review zakończone pozytywnie

## Powiązania

- **US-027** — Szybka zmiana zdjęcia (paste/drop): PS-92 rozszerza tę funkcjonalność o dedykowany przycisk paste
- **PS-59** (backlog) — Drag & drop obrazka do asysty AI: pokrewna poprawa ergonomii wgrywania obrazów
- Formularz przepisu: `/recipes/new`, `/recipes/:id/edit`
- Endpoint upload zdjęcia: `POST /recipes/{id}/image` (max 10 MB, PNG/JPG/WebP)
