# AI recipe image: reference mode (auto) — zmiany

## 1. Historyjki użytkownika

- **US-037 – Generowanie zdjęcia przepisu (AI) w edycji – tylko premium (zmieniona)**
    - **Co się zmieniło**: doprecyzowano, że generowanie może działać w dwóch trybach; bazowy (bez zdjęcia) pozostaje jak dotychczas, a nowy tryb z referencją uruchamia się automatycznie, gdy zdjęcie jest dostępne w formularzu.

- **US-046 – Generowanie zdjęcia AI z referencją (automatyczny tryb, premium) (nowa)**
    - **Nowe**: automatyczny wybór trybu (bez zdjęcia vs z referencją), sygnalizacja trybu tooltipem oraz wymaganie „nie kopiuj referencji, wygeneruj nowe ujęcie”.

## 2. Widoki

- **Formularz przepisu `/recipes/:id/edit` (zmieniony)**
    - **Co się zmieniło**: przycisk AI działa automatycznie w 2 trybach zależnie od dostępności zdjęcia oraz pokazuje tooltip „Generuj z przepisu” / „Generuj z referencją zdjęcia”.

- **Modal podglądu wygenerowanego zdjęcia (zmieniony)**
    - **Co się zmieniło**: modal pokazuje notatkę o trybie/stylu zależną od tego, czy generowanie było z referencją.

## 3. API

- **`POST /ai/recipes/image` (zmieniony)**
    - **Co się zmieniło**:
        - dodano obsługę trybów `recipe_only` i `with_reference` oraz `mode=auto`,
        - dodano opcjonalne pole `reference_image` (źródło `storage_path` lub `base64`),
        - doprecyzowano kontrakt stylu zależnie od trybu (rustykalny vs elegancka kuchnia/jadalnia),
        - odpowiedź `meta` rozszerzono o `mode`.

