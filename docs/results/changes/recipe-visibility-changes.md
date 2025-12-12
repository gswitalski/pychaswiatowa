# Zmiany: Widoczność Przepisu (Recipe Visibility)

## 1. Historyjki Użytkownika

### Nowe historyjki
**US-016: Zarządzanie widocznością przepisu**
- **Opis:** Jako autor przepisu, chcę móc określić, kto może zobaczyć mój przepis, aby zachować prywatność moich notatek lub podzielić się nimi ze światem.
- **Kryteria akceptacji:**
    1. W formularzu tworzenia i edycji przepisu dostępna jest sekcja "Widoczność".
    2. Dostępne są trzy opcje wyboru: "Prywatny", "Współdzielony", "Publiczny".
    3. Domyślnie zaznaczona jest opcja "Prywatny".
    4. Użytkownik może zmienić widoczność w dowolnym momencie edycji przepisu.
    5. Wybrana opcja jest zapisywana wraz z przepisem w bazie danych.

### Zmienione historyjki
Brak bezpośrednich modyfikacji w treści istniejących historyjek, jednak US-003 (Dodawanie nowego przepisu) i US-005 (Edycja istniejącego przepisu) zostały w PRD rozszerzone o funkcjonalną możliwość edycji pola widoczności (zaktualizowano listę pól w opisie wymagań funkcjonalnych).

## 2. Widoki

### Zmienione widoki

**7. Formularz Przepisu (Dodaj/Edytuj)**
- **Zmiana:** Dodano sekcję wyboru widoczności.
- **Szczegóły:**
    - Nowy komponent UI: `mat-radio-group` lub `mat-select` z opcjami: `PRIVATE`, `SHARED`, `PUBLIC`.
    - Domyślna wartość: `PRIVATE`.
    - Lokalizacja: W sekcji "Dane podstawowe", obok kategorii.
    - Walidacja: Pole wymagane (zawsze musi mieć wartość).

## 3. API

### Zmienione Endpointy

**Model Danych (Recipe)**
- Dodano pole: `visibility` (Enum: `PRIVATE`, `SHARED`, `PUBLIC`).

**POST /recipes**
- **Request Payload:** Dodano pole `visibility`.
- **Przykład:** `"visibility": "PRIVATE"`
- **Walidacja:** Pole wymagane, musi należeć do dozwolonych wartości Enum.

**PUT /recipes/{id}**
- **Request Payload:** Dodano opcjonalne pole `visibility` do aktualizacji.

**GET /recipes/{id}** oraz **GET /recipes**
- **Response Payload:** Obiekt przepisu zawiera teraz pole `visibility`.

**POST /recipes/import**
- **Zachowanie:** Domyślnie importowane przepisy otrzymują widoczność `PRIVATE`. Edycja widoczności możliwa w kroku następnym (edycja formularza).

