# Recipe AI Image on Create — plan UI

## Cel UI

Dodać możliwość wygenerowania zdjęcia AI **już w formularzu tworzenia przepisu** (`/recipes/new`) – z podglądem i akceptacją – bez konieczności zapisu przepisu przed generowaniem.

## Zmiany w istniejącym widoku

### 1) Formularz przepisu (`/recipes/new`, `/recipes/:id/edit`)

Sekcja „Zdjęcie” (komponent typu `ImageUploadComponent`) rozszerzamy o:

- **Przycisk AI** (ikona „AI”) dostępny także w trybie tworzenia (`/recipes/new`).
- **Feature gating (premium)**:
    - `premium`/`admin`: przycisk aktywny,
    - `user`: przycisk `disabled` z tooltipem „Funkcja Premium” + (jeśli istnieje) link/CTA do upgrade.
- **Tryb generowania (auto)**:
    - Jeśli użytkownik ma w formularzu dodane zdjęcie (paste/drop/file) — UI sygnalizuje „Generowanie z referencją”.
    - Jeśli nie ma zdjęcia — UI sygnalizuje „Generowanie z przepisu”.

> Uwaga: w trybie tworzenia (`/recipes/new`) zdjęcie (wklejone lub wygenerowane) jest traktowane jako **tymczasowe** do czasu zapisu przepisu.

## Nowe elementy UI

### 2) Dialog: „Generuj zdjęcie AI” (modal)

Dialog uruchamiany z sekcji zdjęcia w `/recipes/new` oraz `/recipes/:id/edit`.

**Zawartość:**

- Nagłówek: „Generuj zdjęcie AI”.
- Krótka informacja o trybie:
    - „Z przepisu” (recipe-only) albo
    - „Z referencją zdjęcia” (with-reference).
- Pole opcjonalne: **„Doprecyzuj opis obrazka”** (1–2 linie, limit znaków, np. 200–400).
    - Przykładowy placeholder: „np. rustykalne ujęcie, naturalne światło, bez tekstu na zdjęciu”.
- Strefa podglądu:
    - stan początkowy: placeholder/ilustracja + informacja „Wygeneruj podgląd”.
    - stan `loading`: spinner + tekst „Generuję…”.
    - stan `success`: obraz 1024×1024 (dopasowany responsywnie) + opis trybu.
    - stan `error`: czytelny komunikat (np. „Nie udało się wygenerować zdjęcia. Spróbuj ponownie.”).

**Akcje w stopce:**

- „Anuluj” — zamyka dialog bez zmian.
- „Generuj” — uruchamia generowanie (disabled w trakcie requestu).
- Po sukcesie:
    - „Użyj tego zdjęcia” — zapisuje wynik jako **tymczasowe zdjęcie** w formularzu (bez uploadu w `/recipes/new`),
    - „Wygeneruj ponownie” — ponawia generowanie (z krótkim cooldown),
    - „Usuń” — czyści podgląd w dialogu (nie zmienia zdjęcia w formularzu).

## Stany i edge-case’y

- **Brak wymaganych danych przepisu**:
    - Jeśli formularz jest zbyt „pusty” (np. brak nazwy i brak składników/kroków), UI może:
        - blokować generowanie i pokazać hint „Uzupełnij przynajmniej nazwę lub składniki”, albo
        - pozwolić generować, ale liczyć się z 422 z backendu (wtedy komunikat w dialogu).
- **Cooldown**:
    - Po udanym generowaniu (i/lub po każdym request) przycisk „Wygeneruj ponownie” ma krótki cooldown (np. 20–30 s) widoczny jako odliczanie w etykiecie lub tooltip.
- **Wyjście z formularza**:
    - Jeśli użytkownik ma niezapisane zmiany (w tym tymczasowe zdjęcie), standardowy mechanizm ostrzegania o utracie zmian powinien zadziałać.
- **Zapis przepisu z zaakceptowanym zdjęciem AI**:
    - Po udanym `POST /recipes` aplikacja uploaduje zdjęcie do `POST /recipes/{id}/image`.
    - Jeśli upload się nie powiedzie: pokazujemy Snackbar „Przepis zapisany, ale nie udało się wgrać zdjęcia” + akcja „Spróbuj ponownie” (albo instrukcja, że można ponowić w edycji).

## Kryteria UX (Definition of Done dla UI)

- Na `/recipes/new` użytkownik premium może wygenerować obraz AI i zaakceptować go przed zapisem.
- Wygenerowany obraz nie wymaga istnienia przepisu do samego generowania (preview), ale jest uploadowany dopiero po utworzeniu przepisu.
- Dla roli `user` funkcja jest jasno oznaczona jako premium (bez mylących błędów).
- Stany `loading/success/error` są czytelne, a interfejs nie pozwala na spamowanie requestów (cooldown).

