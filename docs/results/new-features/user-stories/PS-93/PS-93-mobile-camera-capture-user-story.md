# PS-93: Zrobienie zdjęcia aparatem urządzenia mobilnego

## Opis

Jako użytkownik wprowadzający przepis do systemu na urządzeniu mobilnym, chcę zrobić zdjęcie przepisu bezpośrednio aparatem telefonu lub tabletu w aplikacji, aby móc dodać obraz do formularza przepisu lub do analizy AI bez wychodzenia z PychaŚwiatowej i bez konieczności najpierw zapisywania zdjęcia w galerii.

## Kontekst

PychaŚwiatowa to responsywna aplikacja webowa (Angular, desktop-first z pełną obsługą mobile). Wgranie zdjęcia przepisu odbywa się po stronie klienta (paste, drag & drop, wybór pliku; PS-92 — przycisk „Wklej ze schowka”) z walidacją PNG/JPG/WebP do 10 MB i tym samym flow podglądu / cofnięcia / uploadu co w US-027. Asysta AI (`/recipes/new/assist`, tryb „Obraz”) wysyła obraz do `POST /ai/recipes/draft` z rozliczeniem kredytów `draft`.

Na urządzeniach mobilnych wklejanie ze schowka lub wybór pliku z galerii jest mniej wygodne niż natychmiastowe uruchomienie aparatu — użytkownik często ma przepis „pod ręką” w kuchni i chce go sfotografować w jednym kroku. Brak dedykowanej akcji „Zrób zdjęcie” zmusza do opuszczenia aplikacji (aparat systemowy → galeria → powrót → wybór pliku), co obniża konwersję przy dodawaniu przepisów i przy imporcie przez AI.

Funkcjonalność ma objąć **dwa miejsca** wskazane w wymaganiach:

1. **Strefa zdjęcia formularza przepisu** — `RecipeImageUploadComponent` (`/recipes/new`, `/recipes/:id/edit`).
2. **Tryb obrazu asysty AI** — `RecipeNewAssistPageComponent` (`/recipes/new/assist`, przełącznik „Obraz”).

Warstwa API **bez zmian** — aparat dostarcza plik obrazu tak samo jak wybór pliku z dysku.

## Założenia i ograniczenia

- Realizacja opiera się na **natywnym** `<input type="file">` z atrybutem `capture` (np. `environment` dla tylnego aparatu) oraz `accept` zgodnym z obsługiwanymi MIME — bez wbudowanego podglądu kamery w aplikacji (brak własnego UI wideo jak w natywnej apce).
- Po wykonaniu zdjęcia plik trafia do **istniejącej** ścieżki obsługi obrazu (ta sama walidacja typu i rozmiaru, podgląd, Undo / usunięcie, upload przy zapisie przepisu lub wysłanie draftu AI).
- Obsługiwane formaty i limit: **PNG, JPEG, WebP**, max **10 MB** — spójnie z `POST /recipes/{id}/image` i draftem AI.
- Zachowanie `capture` **zależy od przeglądarki i OS** (iOS Safari, Chrome Android itd.): na desktopie przycisk „Zrób zdjęcie” może otworzyć wybór pliku lub (w niektórych przeglądarkach) kamerę — uznaje się to za akceptowalne; na mobile priorytetem jest uruchomienie aparatu.
- Przycisk aparatu jest **dodatkowy** — paste (Ctrl+V), drag & drop, wybór pliku i „Wklej ze schowka” (PS-92) pozostają bez zmian funkcjonalnych.
- W asyście AI dostęp do ekranu nadal reguluje guard roli (`premium`/`admin` w UI); story nie zmienia modelu kredytów ani gatingu.
- Jeśli użytkownik anuluje systemowy dialog aparatu / wyboru pliku, stan ekranu pozostaje bez zmian (brak komunikatu błędu).
- **Założenie (luka w wymaganiach):** etykieta przycisku po polsku, np. „Zrób zdjęcie” lub „Aparat”, z ikoną Material (`photo_camera`); dokładny copy dopasowuje się do design systemu przy implementacji.
- **Założenie:** jeden wspólny wzorzec UX w obu miejscach (formularz + asysta), o ile nie wynika inaczej z layoutu komponentu.

## Kryteria akceptacji

### Scenariusz 1: Zrobienie zdjęcia aparatem — formularz przepisu (happy path, mobile)

- **Given**: Użytkownik jest zalogowany na `/recipes/new` lub `/recipes/:id/edit` na urządzeniu mobilnym w obsługiwanej przeglądarce; strefa zdjęcia jest widoczna (brak zdjęcia lub stan umożniający zmianę).
- **When**: Użytkownik klika przycisk „Zrób zdjęcie” (lub równoważny) w strefie zdjęcia, robi zdjęcie w systemowym interfejsie aparatu i potwierdza.
- **Then**: Aplikacja odbiera plik obrazu, wyświetla podgląd w strefie zdjęcia i zachowuje się identycznie jak po wyborze pliku z galerii (w tym możliwość cofnięcia / Undo oraz dalszy upload zgodnie z obecną logiką `RecipeImageUploadComponent`).

### Scenariusz 2: Zrobienie zdjęcia aparatem — asysta AI, tryb obrazu (happy path, mobile)

- **Given**: Użytkownik ma dostęp do `/recipes/new/assist`, wybrał źródło „Obraz” i nie ma jeszcze podglądu obrazu (lub usuwa poprzedni).
- **When**: Użytkownik klika „Zrób zdjęcie”, wykonuje zdjęcie w aparacie systemowym i je akceptuje.
- **Then**: Obraz pojawia się jako podgląd w obszarze trybu obrazu; przycisk „Dalej” staje się dostępny (przy pozostałych warunkach bez zmian); po „Dalej” draft jest generowany tak samo jak dla obrazu wklejonego lub wybranego z pliku.

### Scenariusz 3: Anulowanie aparatu

- **Given**: Użytkownik jest w jednym z dwóch miejsc (formularz lub asysta, tryb obrazu) i klika „Zrób zdjęcie”.
- **When**: Użytkownik zamyka lub anuluje systemowy interfejs aparatu / wyboru bez zatwierdzenia pliku.
- **Then**: Podgląd i stan formularza / asysty pozostają jak przed kliknięciem; nie wyświetla się komunikat błędu.

### Scenariusz 4: Nieobsługiwany format lub przekroczony rozmiar

- **Given**: System zwraca plik spoza dozwolonych typów MIME lub większy niż 10 MB (np. rzadki format po konwersji aparatu).
- **When**: Użytkownik zatwierdza taki plik po zrobieniu zdjęcia.
- **Then**: Aplikacja odrzuca plik z **tym samym** komunikatem co przy wyborze pliku / wklejeniu (inline w strefie obrazu, nie snackbar): informacja o nieobsługiwanym formacie lub limicie 10 MB; podgląd się nie aktualizuje.

### Scenariusz 5: Współistnienie z innymi metodami wgrywania

- **Given**: Użytkownik jest w strefie zdjęcia formularza lub w asyście (obraz).
- **When**: Użytkownik korzysta kolejno z paste, drag & drop, wyboru pliku, „Wklej ze schowka” (PS-92) lub „Zrób zdjęcie”.
- **Then**: Każda metoda działa niezależnie; ostatnia poprawnie zaakceptowana grafika determinuje podgląd (zastąpienie jak przy ponownym uploadzie pliku).

### Scenariusz 6: Zastąpienie istniejącego zdjęcia zdjęciem z aparatu

- **Given**: Formularz przepisu ma już ustawiony podgląd zdjęcia (lub asysta ma podgląd obrazu).
- **When**: Użytkownik klika „Zrób zdjęcie” i akceptuje nowe zdjęcie.
- **Then**: Poprzedni obraz jest zastępowany nowym; w formularzu dostępne jest cofnięcie (Undo), jeśli jest zaimplementowane w bieżącym komponencie.

### Scenariusz 7: Dostępność i urządzenia bez aparatu

- **Given**: Użytkownik korzysta z przeglądarki na urządzeniu bez aparatu lub w kontekście, gdzie `capture` nie uruchamia kamery.
- **When**: Użytkownik klika „Zrób zdjęcie”.
- **Then**: Przeglądarka otwiera standardowy wybór pliku (fallback); użytkownik nadal może wybrać obraz z dysku. Przycisk ma etykietę dostępną (ARIA) i jest osiągalny z klawiatury.

### Scenariusz 8: Stan disabled podczas przesyłania / ładowania

- **Given**: Trwa upload zdjęcia w formularzu (`isUploading`) lub asysta jest w stanie `isLoading()`.
- **When**: Użytkownik próbuje użyć „Zrób zdjęcie”.
- **Then**: Przycisk (lub cała strefa) jest nieaktywny — nie można rozpocząć nowej operacji do zakończenia bieżącego procesu.

## Definicja ukończenia (Definition of Done)

- [ ] Kod zaimplementowany w `RecipeImageUploadComponent` oraz w trybie obrazu `RecipeNewAssistPageComponent` (wspólny wzorzec zalecany, np. ukryty `input` + przycisk Material)
- [ ] Plik z aparatu przechodzi przez istniejącą walidację MIME/rozmiaru i flow podglądu (bez duplikacji logiki biznesowej)
- [ ] Brak zmian w kontraktach API (`POST /recipes/{id}/image`, `POST /ai/recipes/draft`)
- [ ] Testy jednostkowe komponentów pokrywają: sukces po `change` na input z `capture`, anulowanie (brak pliku), odrzucenie złego typu/rozmiaru
- [ ] Test manualny na co najmniej jednym urządzeniu mobilnym (Android Chrome i/lub iOS Safari) oraz smoke na desktopie
- [ ] Przycisk spełnia wymagania a11y (aria-label, focus)
- [ ] Code review zakończone pozytywnie

## Powiązania

- **PS-93** — to zgłoszenie
- **US-027** — Szybka zmiana zdjęcia (paste/drop/plik)
- **PS-92** — Wklej ze schowka (pokrewna ergonomia wgrywania obrazu)
- **US-036** — Asystowane dodawanie (AI), tryb obrazu
- **PS-59** (backlog) — Drag & drop obrazka do asysty AI
- Widoki: `/recipes/new`, `/recipes/:id/edit`, `/recipes/new/assist`
- Endpointy (bez zmian): `POST /recipes/{id}/image`, `POST /ai/recipes/draft`
