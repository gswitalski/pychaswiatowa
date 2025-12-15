# Main navigation changes (Topbar)

## 1. Historyjki użytkownika

- **US-014: Globalna nawigacja i orientacja (App Shell)** *(zmienione)*  
  - **Co się zmieniło:** doprecyzowano, że Topbar zawiera stałą główną nawigację (zakładki) **Moja Pycha** i **Odkrywaj przepisy** z wyróżnieniem aktywnej pozycji; Breadcrumbs są kontekstowe (na głębszych trasach), a Omnibox może być realizowany jako stała ikona/akcja.

- **US-023: Wejście do „Moja Pycha” z Topbara** *(zmienione)*  
  - **Co się zmieniło:** story obejmuje również gościa; wejście na `/dashboard` dla gościa wymaga logowania (redirect do logowania z powrotem po sukcesie).

- **US-026: Wejście do „Odkrywaj przepisy” z Topbara** *(nowe)*  
  - Stała pozycja „Odkrywaj przepisy” w Topbarze prowadząca do `/explore`, widoczna dla gościa i zalogowanego, z wyróżnieniem aktywnego stanu na `/explore`.

## 2. Widoki

- **Topbar / Nawigacja główna** *(zmienione)*  
  - **Co się zmieniło:** zamiast „losowych” przycisków zależnych od widoku, Topbar posiada przewidywalną, stałą nawigację główną (zakładki): **Moja Pycha** (`/dashboard`) i **Odkrywaj przepisy** (`/explore`), z aktywnym stanem.
  - **Mobile:** główna nawigacja dostępna jako hamburger/drawer (ta sama kolejność i etykiety).

- **Widoki publiczne** *(zmienione)*  
  - **Co się zmieniło:** na ścieżkach publicznych (`/`, `/explore`, `/explore/recipes/:id`) Topbar zawiera tę samą główną nawigację, a po prawej stronie:
    - dla gościa: `Zaloguj` / `Zarejestruj`,
    - dla zalogowanego: profil (menu + wylogowanie).

## 3. API

- **Brak zmian w API** *(zmienione)*  
  - **Co się zmieniło:** nawigacja główna jest zahardkodowana we froncie, więc API nie dostarcza konfiguracji menu (usunęliśmy wcześniej planowany endpoint `/navigation/main` z dokumentacji).


