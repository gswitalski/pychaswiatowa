# Terms of Service (Regulamin Serwisu) — plan UI

## Cel UI

Wyświetlić w aplikacji treść Regulaminu Serwisu (Markdown) pod ścieżką **`/legal/terms`** w spójnej typografii Angular Material, oraz zmienić etykietę nawigacji z „Warunki korzystania” na **„Regulamin Serwisu”** we wszystkich miejscach UI.

## Zmiany w nawigacji (App Shell)

### Footer

- Zmienić label linku prowadzącego do `/legal/terms`:
    - **z**: „Warunki korzystania”
    - **na**: „Regulamin Serwisu”

### Pozostałe miejsca nawigacji / tytuły

- Ujednolicić nazewnictwo:
    - tytuł strony przekazywany przez routing (widoczny w Page Header) → „Regulamin Serwisu”
    - ewentualne inne pozycje menu/linki (jeśli istnieją) → „Regulamin Serwisu”

## Nowe lub zmienione widoki

### 1) `/legal/terms` — LegalPage (render Regulaminu)

- **Ścieżka**: `/legal/terms`
- **Tytuł w nagłówku strony**: „Regulamin Serwisu”
- **Treść**:
    - render Markdown z assetu (np. `assets/legal/terms.md`) w kontenerze z `mat-typography`
    - zachować istniejący layout strony prawnej: `PageHeader` + `mat-card`

#### Rekomendowany sposób renderowania Markdown

- Użyć komponentu/serwisu renderującego Markdown w Angularze, np. biblioteki typu **ngx-markdown** (lub równoważnej), która:
    - pobiera treść przez `HttpClient` jako tekst,
    - renderuje Markdown do bezpiecznego HTML,
    - umożliwia kontrolę sanitization.

> Alternatywa (jeśli nie chcemy zależności): własny, mały renderer oparty o `marked` + sanitization, ale preferowana jest gotowa biblioteka z dobrą integracją z Angular.

## Stany i edge-case’y

- **Stan ładowania**:
    - w trakcie pobierania assetu pokazać progress (np. `mat-progress-bar` lub skeleton tekstu).
- **Błąd pobrania treści (np. 404 assetu)**:
    - pokazać komunikat w stylu strony prawnej („Nie udało się wczytać Regulaminu. Spróbuj ponownie.”),
    - opcjonalnie: przycisk „Odśwież”.
- **Linki w treści**:
    - linki powinny być widoczne i klikalne,
    - preferować bezpieczne atrybuty dla linków zewnętrznych (jeśli będą) oraz spójny styl Material.

## Definition of Done (UI)

- `/legal/terms` renderuje Regulamin z Markdown (czytelny układ, Material typography).
- W nawigacji etykieta do `/legal/terms` brzmi „Regulamin Serwisu” we wszystkich miejscach UI.
- Istnieje stan ładowania i stan błędu (bez „białej strony”).
- UI pozostaje spójne z istniejącym App Shell (komponenty Material, odstępy, typografia).

