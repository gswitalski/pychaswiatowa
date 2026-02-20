# Terms of Service (Regulamin Serwisu) — wymagania

## Cel

Udostępnić w aplikacji stronę **Regulaminu Serwisu** pod ścieżką **`/legal/terms`**, wyświetlając treść z istniejącego pliku `docs/regulamin.md` w formacie Markdown (renderowanym w UI), oraz ujednolicić nazewnictwo w nawigacji z „Warunki korzystania” na **„Regulamin Serwisu”**.

## Kontekst architektury (istniejące założenia)

- Aplikacja SPA w Angular + Angular Material, App Shell (Topbar/Sidebar + Footer).
- Istnieją ścieżki prawne: `/legal/terms`, `/legal/privacy`, `/legal/publisher` (dla gościa i zalogowanego).
- Widok `LegalPage` aktualnie wyświetla placeholdery zamiast właściwej treści.
- W stopce istnieje link „Warunki korzystania” prowadzący do `/legal/terms`.

## Problem do rozwiązania

- Strona `/legal/terms` nie prezentuje aktualnej treści Regulaminu (jest placeholder).
- Nazwa linku w nawigacji jest niespójna z docelową nazwą dokumentu („Regulamin Serwisu”).
- Treść regulaminu istnieje już w repozytorium (`docs/regulamin.md`), ale nie jest dostępna użytkownikom w aplikacji.

## Zakres (MVP dla tego ficzera)

### Wymagania funkcjonalne

- **FR-LGL-001 (źródło treści)**: Źródłem prawdy treści Regulaminu jest plik **`docs/regulamin.md`**.
- **FR-LGL-002 (dystrybucja do aplikacji jako asset)**: Aplikacja renderuje Regulamin z pliku asset, np. **`src/assets/legal/terms.md`**, który jest synchronizowany z `docs/regulamin.md` (proces build/dev).
    - Synchronizacja może być realizowana skryptem (np. prebuild) lub ustaloną procedurą w repo (ważne: jedno źródło prawdy).
- **FR-LGL-003 (renderowanie Markdown w UI)**: Pod `/legal/terms` treść jest renderowana jako Markdown (nagłówki, listy, pogrubienia, linki) w czytelnej typografii (Material).
- **FR-LGL-004 (1:1 z dokumentem)**: Treść jest wyświetlana **1:1** względem `docs/regulamin.md` (włącznie z tytułem H1 i placeholderami typu `<YYYY-MM-DD>`).
- **FR-LGL-005 (dostępność dla gościa i zalogowanego)**: `/legal/terms` działa zarówno dla użytkowników niezalogowanych, jak i zalogowanych (spójny widok, różne layouty aplikacji).
- **FR-LGL-006 (zmiana etykiety w nawigacji)**: W całej aplikacji etykieta linku prowadzącego do `/legal/terms` jest zmieniona z „Warunki korzystania” na **„Regulamin Serwisu”**.
    - Obejmuje co najmniej: stopkę (Footer) oraz tytuł strony przekazywany przez routing (Page Header).
- **FR-LGL-007 (fallback przy błędzie)**: Jeśli plik asset nie zostanie załadowany (np. 404), UI pokazuje czytelny komunikat błędu oraz sugeruje ponowną próbę/odświeżenie.

### Poza zakresem (explicitly out-of-scope)

- Edycja regulaminu z poziomu aplikacji (CMS).
- Dynamiczne pobieranie treści z backendu/API (post-MVP).
- Spis treści, kotwice do nagłówków, kopiowanie linków do sekcji (post-MVP).
- Wersjonowanie regulaminu w UI i historia zmian (post-MVP).

## User stories

### US-LGL-001 — Wyświetlenie Regulaminu Serwisu na `/legal/terms`

Jako **użytkownik Serwisu** (gość lub zalogowany) chcę otworzyć stronę **Regulaminu Serwisu** pod `/legal/terms`, aby zapoznać się z zasadami korzystania z aplikacji.

**Kryteria akceptacji:**

- Wejście na `/legal/terms` wyświetla treść regulaminu wyrenderowaną z Markdown (czytelne nagłówki, listy, linki).
- Treść odpowiada 1:1 zawartości `docs/regulamin.md`.
- Widok działa dla gościa i zalogowanego.
- W nagłówku strony widnieje tytuł „Regulamin Serwisu”.
- Jeśli nie uda się pobrać pliku z treścią, użytkownik widzi komunikat błędu (bez białej strony).

### US-LGL-002 — Spójna nawigacja do Regulaminu

Jako **użytkownik** chcę widzieć w nawigacji link nazwany **„Regulamin Serwisu”**, aby rozumieć, dokąd prowadzi i móc szybko przejść do regulaminu.

**Kryteria akceptacji:**

- W stopce oraz w innych miejscach nawigacji etykieta linku do `/legal/terms` brzmi „Regulamin Serwisu”.
- Kliknięcie linku prowadzi do `/legal/terms`.

## Wymagania niefunkcjonalne

- **Bezpieczeństwo (XSS)**: Renderowanie Markdown musi być bezpieczne (sanityzacja HTML lub render w trybie bezpiecznym), nawet jeśli dziś plik jest kontrolowany przez repo.
- **Wydajność**: Plik jest cache’owany przez przeglądarkę (asset) i nie generuje istotnych opóźnień ładowania.
- **Maintainability**: Ustalony, prosty proces synchronizacji `docs/regulamin.md` → asset aplikacji, tak aby uniknąć rozjazdu treści.

