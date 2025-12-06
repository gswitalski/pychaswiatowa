# Plan implementacji widoku Landing Page

## 1. Przegląd

Widok "Landing Page" jest publicznie dostępną stroną główną aplikacji PychaŚwiatowa. Jej głównym celem jest powitanie nowych i powracających użytkowników, zwięzłe przedstawienie wartości aplikacji oraz skierowanie ich do kluczowych akcji – logowania lub rejestracji. Strona ma charakter marketingowy i informacyjny.

## 2. Routing widoku

Widok będzie dostępny pod głównym adresem URL aplikacji, czyli pod ścieżką `/`. Będzie to domyślna strona dla wszystkich niezalogowanych użytkowników.

## 3. Struktura komponentów

Struktura zostanie oparta o reużywalny layout dla części publicznej oraz dedykowane komponenty dla strony głównej.

```
/app
|-- /layout
|   |-- /public-layout
|       |-- public-layout.component.ts      // Główny layout dla stron publicznych
|-- /pages
|   |-- /landing
|       |-- landing-page.component.ts       // Komponent widoku (strony)
|       |-- /components
|           |-- /hero
|               |-- hero.component.ts       // Komponent sekcji "Hero"
|-- /shared
|   |-- /components
|       |-- /public-header
|           |-- public-header.component.ts  // Nagłówek dla stron publicznych
```

**Hierarchia:**

1.  `PublicLayoutComponent`
    *   `PublicHeaderComponent`
    *   `<router-outlet>` (w którym renderowany jest `LandingPageComponent`)
2.  `LandingPageComponent`
    *   `HeroComponent`

## 4. Szczegóły komponentów

### `pych-public-header`

*   **Opis komponentu:** Nagłówek wyświetlany na wszystkich stronach publicznych (niezalogowany użytkownik). Zawiera logo aplikacji oraz przyciski nawigacyjne do logowania i rejestracji.
*   **Główne elementy:**
    *   Logo aplikacji (prawdopodobnie jako `<img>` lub komponent SVG) z linkiem do strony głównej (`/`).
    *   Kontener na przyciski akcji (`mat-button`).
    *   Przycisk "Zaloguj się".
    *   Przycisk "Zarejestruj się" (wariant `raised` lub `stroked` dla odróżnienia).
*   **Obsługiwane zdarzenia:**
    *   Kliknięcie w logo: nawigacja do `/`.
    *   Kliknięcie "Zaloguj się": nawigacja do `/login`.
    *   Kliknięcie "Zarejestruj się": nawigacja do `/register`.
*   **Warunki walidacji:** Brak.
*   **Typy:** Brak.
*   **Propsy (Inputs):** Brak.

### `pych-landing-page`

*   **Opis komponentu:** Główny komponent-kontener dla widoku Landing Page. Jego zadaniem jest złożenie sekcji składowych strony.
*   **Główne elementy:**
    *   Komponent `<pych-hero>`.
    *   (Opcjonalnie w przyszłości) Inne sekcje, np. opisujące funkcje aplikacji.
*   **Obsługiwane zdarzenia:** Brak (propaguje zdarzenia z komponentów podrzędnych do routera).
*   **Warunki walidacji:** Brak.
*   **Typy:** Brak.
*   **Propsy (Inputs):** Brak.

### `pych-hero`

*   **Opis komponentu:** Kluczowa sekcja "Hero" na stronie głównej. Ma za zadanie przyciągnąć uwagę użytkownika za pomocą chwytliwego hasła i grafiki.
*   **Główne elementy:**
    *   Kontener główny z tłem (obraz lub gradient).
    *   Nagłówek `<h1>` z głównym hasłem marketingowym aplikacji.
    *   Paragraf `<p>` z krótkim opisem wyjaśniającym, czym jest PychaŚwiatowa.
    *   Kontener z przyciskami akcji (wezwanie do działania - CTA), powtarzający przyciski z nagłówka dla lepszej widoczności.
*   **Obsługiwane zdarzenia:**
    *   Kliknięcie "Zarejestruj się": nawigacja do `/register`.
*   **Warunki walidacji:** Brak.
*   **Typy:** Brak.
*   **Propsy (Inputs):** Brak.

## 5. Typy

Widok jest statyczny i nie przetwarza danych, w związku z czym nie wymaga definiowania żadnych niestandardowych typów DTO ani ViewModel.

## 6. Zarządzanie stanem

Widok jest bezstanowy. Nie ma potrzeby implementacji żadnych mechanizmów zarządzania stanem, takich jak serwisy z sygnałami (signals) czy NgRx, ponieważ strona nie przechowuje żadnych danych ani nie reaguje na ich zmiany.

## 7. Integracja API

Brak integracji z API. Widok nie pobiera ani nie wysyła żadnych danych do backendu.

## 8. Interakcje użytkownika

*   **Kliknięcie przycisku "Zaloguj się":** Użytkownik jest przekierowywany na stronę logowania (`/login`).
*   **Kliknięcie przycisku "Zarejestruj się":** Użytkownik jest przekierowywany na stronę rejestracji (`/register`).
*   **Kliknięcie logo w nagłówku:** Użytkownik jest przekierowywany na stronę główną (`/`).

## 9. Warunki i walidacja

Brak warunków i walidacji po stronie frontendowej, ponieważ widok nie zawiera żadnych formularzy ani pól do wprowadzania danych.

## 10. Obsługa błędów

Ze względu na statyczny charakter strony, ryzyko wystąpienia błędów jest minimalne. Potencjalne błędy mogą dotyczyć jedynie nieprawidłowej konfiguracji routingu. W takim przypadku, globalna obsługa błędów routera (np. strona 404) powinna zadziałać.

## 11. Kroki implementacji

1.  **Stworzenie struktury plików:** Utworzenie folderów i plików dla komponentów: `PublicLayoutComponent`, `PublicHeaderComponent`, `LandingPageComponent`, `HeroComponent` zgodnie ze strukturą opisaną w punkcie 3.
2.  **Implementacja `PublicHeaderComponent`:**
    *   Dodanie selektora `pych-public-header`.
    *   Stworzenie layoutu nagłówka przy użyciu `mat-toolbar` z Flexbox (`space-between`).
    *   Dodanie logo i przycisków "Zaloguj się" i "Zarejestruj się" (`mat-button`).
    *   Dodanie nawigacji za pomocą dyrektywy `routerLink`.
3.  **Implementacja `HeroComponent`:**
    *   Dodanie selektora `pych-hero`.
    *   Zaprojektowanie sekcji w HTML i stylowanie w SCSS, aby była w pełni responsywna (desktop-first).
    *   Dodanie tła, nagłówka `<h1>`, tekstu i przycisku CTA `mat-raised-button` z `routerLink` do `/register`.
4.  **Implementacja `LandingPageComponent`:**
    *   Dodanie selektora `pych-landing-page`.
    *   Umieszczenie w szablonie komponentu `<pych-hero>`.
5.  **Implementacja `PublicLayoutComponent`:**
    *   Dodanie selektora `pych-public-layout`.
    *   Umieszczenie w szablonie komponentu `<pych-public-header>` oraz `<router-outlet>`.
6.  **Konfiguracja routingu:**
    *   W głównym pliku `app.routes.ts` zdefiniowanie ścieżki głównej, która użyje `PublicLayoutComponent` jako komponentu ramowego i `LandingPageComponent` jako domyślnego komponentu dla ścieżki `''`.
7.  **Stylowanie i dopracowanie:**
    *   Dopracowanie stylów SCSS dla wszystkich komponentów, aby zapewnić spójność wizualną z Angular Material i responsywność.
    *   Użycie zmiennych z motywu Angular Material do kolorów i typografii.
