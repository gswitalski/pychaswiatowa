# Plan widoku UI — Poprawa generowania opisu przepisu przez AI (PS-34)

> **User Story:** PS-34 — Poprawa generowania opisu przez AI
> **Data:** październik 2026
> **Zakres:** Wyłącznie warstwa backendu (prompt AI) — brak zmian w UI

---

## 1. Przegląd

PS-34 **nie wprowadza żadnych zmian w warstwie UI**. Cała modyfikacja ogranicza się do promptu systemowego w Edge Function `ai`. Warstwa frontendowa jest w pełni transparentna względem tej zmiany.

| Aspekt | Stan |
|---|---|
| Nowe komponenty Angular | **Brak** |
| Modyfikowane komponenty | **Brak** |
| Nowe trasy (routing) | **Brak** |
| Modyfikacje serwisów frontendowych | **Brak** |
| Zmiany w modelach / DTO frontendu | **Brak** |
| Zmiany w szablonach HTML / SCSS | **Brak** |

---

## 2. Jak zmiana PS-34 przechodzi przez istniejący UI

Przepływ danych pozostaje bez zmian. Zmodyfikowana odpowiedź backendu jest konsumowana przez istniejące komponenty w niezmieniony sposób:

```
POST /ai/recipes/draft
        │
        ▼
  AiService (Edge Function)         ← zmiana promptu tutaj
        │
        ▼ AiRecipeDraftResponseDto
  RecipeDraftService (frontend)     ← bez zmian
        │
        ▼
  RecipeNewAssistPageComponent      ← bez zmian
        │
        ▼ patchValue(draft)
  RecipeFormComponent               ← bez zmian
        │
        ▼
  [pole "Opis" w formularzu]        ← wyświetla string | null — bez zmian
```

Jedyną obserwowalną różnicą dla użytkownika jest **treść pola "Opis"** w formularzu po wygenerowaniu draftu — dłuższa i bardziej angażująca. Użytkownik może ją dowolnie edytować przed zapisem, co jest zachowaniem istniejącym (Scenariusz 5 w historyjce).

---

## 3. Widoki, których dotyczy zmiana (bez modyfikacji kodu)

Poniższe widoki wyświetlają wygenerowany opis. Żaden z nich nie wymaga zmian — zmiana jest wyłącznie w treści, a nie w strukturze danych.

### 3.1 Kreator przepisu z asystą AI (`/recipes/new/assist`)

- **Komponent:** `RecipeNewAssistPageComponent`
- **Guard:** `premiumRoleMatchGuard` (role `premium` / `admin`) — bez zmian
- **Zmiana:** Po wygenerowaniu draftu pole `description` w formularzu zostanie wstępnie wypełnione dłuższym opisem (3–5 zdań) w stylu familiarnym z ciekawostką. Użytkownik może tekst zmodyfikować.

### 3.2 Formularz przepisu (`/recipes/new`, `/recipes/:id/edit`)

- **Komponent:** `RecipeFormComponent` (pole `description`)
- **Zmiana:** Wstępnie wypełniony opis z draftu jest dłuższy — pole textareowe (`<textarea>`) wyświetla więcej treści. Walidacja pola nie zmienia się (pole opcjonalne).

### 3.3 Widok szczegółów przepisu (`/recipes/:id-:slug`, `/explore/recipes/:id-:slug`)

- **Komponent:** `RecipeDetailViewComponent`
- **Zmiana:** Użytkownicy, którzy wygenerują przepis po wdrożeniu PS-34, zobaczą bogatszy opis na stronie szczegółów. Istniejące przepisy z krótkimi opisami pozostają bez zmian.

---

## 4. Komponenty wskaźnika kredytów AI (bez zmian)

Wskaźnik kredytów `draft` na stronie asysty (`/recipes/new/assist`) oraz obsługa odpowiedzi `402 AI_CREDITS_EXHAUSTED` pozostają **bez jakichkolwiek modyfikacji**. PS-34 nie zmienia logiki kredytów.

---

## 5. Weryfikacja manualna po wdrożeniu

Mimo braku zmian w kodzie UI, należy ręcznie potwierdzić poprawność renderowania nowego opisu:

| Krok | Oczekiwany wynik |
|---|---|
| Wejdź na `/recipes/new/assist` (konto `premium` lub `admin`) | Strona ładuje się poprawnie, wskaźnik kredytów widoczny |
| Wygeneruj draft z tekstu popularnego przepisu (np. „Pierogi ruskie") | Pole „Opis" wypełnione 3–5 zdaniami, ton pogodny, widoczna ciekawostka na końcu |
| Wygeneruj draft z obrazu potrawy | Identyczny styl opisu jak dla trybu tekstowego |
| Edytuj pole „Opis" w formularzu po wygenerowaniu | Pole jest w pełni edytowalne |
| Zapisz przepis i przejdź do szczegółów | Opis wyświetla się poprawnie na stronie szczegółów |
| Sprawdź responsywność pola opisu na mobile | Tekst nie wychodzi poza kontener; brak problemów z layoutem przy dłuższym opisie |

---

## 6. Czego NIE robi PS-34 w warstwie UI

| Element | Uwaga |
|---|---|
| Przełącznik stylu opisu w formularzu | Jeden domyślny styl — brak nowego elementu formularza |
| Zmiana walidacji pola `description` | Pole nadal opcjonalne, max długość bez zmian |
| Nowa ikona / badge / etykieta przy opisie | Brak |
| Zmiana sposobu wyświetlania opisu na stronie szczegółów | Brak — renderowanie jako zwykły tekst bez zmian |
| Nowe dialogi lub komunikaty błędów | Brak |
