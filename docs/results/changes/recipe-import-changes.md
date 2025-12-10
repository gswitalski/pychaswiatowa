# Zmiany w projekcie: Import Przepisu z Tekstu

Ten dokument podsumowuje zmiany wprowadzone w celu dodania funkcjonalności importowania nowego przepisu za pomocą wklejonego tekstu.

## 1. Historyjki użytkownika (PRD)

### Nowa Historyjka Użytkownika

-   **ID:** US-013
-   **Tytuł:** Importowanie nowego przepisu z tekstu
-   **Opis:** Jako użytkownik, chcę móc szybko dodać nowy przepis, wklejając jego pełną treść w ustandaryzowanym formacie tekstowym, aby zminimalizować czas potrzebny na ręczne wprowadzanie danych.
-   **Kryteria akceptacji:**
    1.  Dostępny jest nowy widok "Importuj przepis" z jednym polem `textarea`.
    2.  Użytkownik może wkleić tekst przepisu, który zawiera nazwę, listę składników i listę kroków.
    3.  System poprawnie parsuje tekst, identyfikując:
        -   Nazwę przepisu (linia zaczynająca się od `#`).
        -   Główne sekcje "Składniki" i "Kroki" (linie zaczynające się od `##`).
        -   Podsekcje/nagłówki wewnątrz składników i kroków (linie zaczynające się od `###`).
        -   Poszczególne składniki i kroki (linie zaczynające się od `-`).
    4.  Po kliknięciu przycisku "Importuj", tworzony jest nowy przepis w bazie danych.
    5.  Po pomyślnym zaimportowaniu, jestem przekierowywany bezpośrednio do formularza edycji nowo utworzonego przepisu, aby uzupełnić brakujące dane (np. kategoria, tagi, zdjęcie).
    6.  W przypadku błędu parsowania, wyświetlany jest czytelny komunikat o błędzie.

---

## 2. API

### Nowy Endpoint

#### `POST /recipes/import`

-   **Description**: Create a new recipe from a raw text block. The server is responsible for parsing the text and structuring it into the required JSONB format.
-   **Request Payload**:
    ```json
    {
      "raw_text": "# Pizza\n## Składniki\n### Ciasto\n - mąka\n - drożdże\n## Kroki\n - krok 1"
    }
    ```
-   **Success Response**:
    -   **Code**: `201 Created`
    -   **Payload**: Zwraca pełny obiekt nowo utworzonego przepisu (analogicznie do `POST /recipes`), aby klient mógł uzyskać jego ID i przejść do edycji.
        ```json
        {
          "id": 102,
          "name": "Pizza",
          "description": null,
          "category_id": null,
          "ingredients": [
            {"type": "header", "content": "Ciasto"},
            {"type": "item", "content": "mąka"},
            {"type": "item", "content": "drożdże"}
          ],
          "steps": [
            {"type": "item", "content": "krok 1"}
          ],
          "tags": [],
          "created_at": "2023-10-28T10:00:00Z"
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request` - Jeśli tekst jest pusty lub ma nieprawidłowy format, który uniemożliwia parsowanie.
    -   **Payload**: `{ "message": "Invalid recipe format. A title (#) is required." }`
    -   **Code**: `401 Unauthorized`

---

## 3. Widoki

### Nowy Widok

**Import Przepisu**
-   **Ścieżka:** `/recipes/import`
-   **Główny cel:** Umożliwienie szybkiego tworzenia przepisu poprzez wklejenie gotowego tekstu.
-   **Kluczowe informacje do wyświetlenia:** Duże pole tekstowe (`textarea`) z instrukcją lub przykładem formatowania, przycisk "Importuj i edytuj".
-   **Kluczowe komponenty widoku:** `mat-card`, `mat-form-field` (textarea), `mat-button`.
-   **Względy UX, dostępności i bezpieczeństwa:** Jasna instrukcja dotycząca oczekiwanego formatu tekstu. Po udanym imporcie użytkownik jest od razu przenoszony do trybu edycji, co stanowi płynny i logiczny przepływ pracy. Dostęp chroniony przez `AuthGuard`.
