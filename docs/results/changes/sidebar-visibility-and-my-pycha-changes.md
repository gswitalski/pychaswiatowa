# Zmiany: Sidebar visibility + "Moja Pycha" (Dashboard)

## 1. Historyjki użytkownika

### Zmodyfikowane historyjki

#### US-014: Globalna nawigacja i orientacja (App Shell)
- **Co się zmieniło:**
    - Nazwa pozycji "Dashboard" w UI została zmieniona na **"Moja Pycha"**.
    - Doprecyzowano regułę widoczności sidebara: **sidebar jest widoczny tylko** na: `/dashboard`, `/recipes/**`, `/collections/**`, `/settings/**`.

### Nowe historyjki

#### US-023: Wejście do "Moja Pycha" z Topbara
- **Nowe:** Link "Moja Pycha" w Topbarze (po lewej stronie avatara), prowadzący do `/dashboard`.

## 2. Widoki

### Zmodyfikowane widoki / nawigacja

- **App Shell / Nawigacja**
    - **Co się zmieniło:** Sidebar nie jest już traktowany jako element zawsze widoczny "dla zalogowanego" — jest renderowany tylko w sekcjach prywatnych: `/dashboard`, `/recipes/**`, `/collections/**`, `/settings/**`.

- **Widoki publiczne dla zalogowanego (`/`, `/explore`, ...)**
    - **Co się zmieniło:** Zamiast Sidebara używany jest **Topbar** z profilem oraz linkiem "Moja Pycha" do `/dashboard`.

- **Dashboard**
    - **Co się zmieniło:** Nazwa w UI: **"Moja Pycha"** (route pozostaje `/dashboard`).

## 3. API

### Nowe endpointy

#### `GET /dashboard/summary`
- **Nowe:** Endpoint dostarczający skrót danych dla widoku "Moja Pycha" (`/dashboard`) (statystyki + ostatnie przepisy).
