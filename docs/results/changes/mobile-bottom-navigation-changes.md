# Mobile bottom navigation — changes

## 1. Historyjki użytkownika

### Nowe

- **US-056 — Mobilna nawigacja dolna (Bottom Bar) zamiast hamburgera**
    - **Co dodano**:
        - na mobile/tablet (breakpoint ~ `< 960px`) główna nawigacja działa jako Bottom Bar przypięty na dole,
        - 3 pozycje: `Odkrywaj` (`/explore`), `Moja Pycha` (`/dashboard`), `Zakupy` (`/shopping`),
        - przekierowanie gościa do logowania dla ścieżek prywatnych (`/dashboard`, `/shopping`) z powrotem po sukcesie (returnUrl),
        - wymaganie `padding-bottom` + safe-area, aby Bottom Bar nie zasłaniał treści.

### Zmienione / doprecyzowane

- **US-014 — Globalna nawigacja i orientacja (App Shell)**
    - **Co się zmieniło / doprecyzowano**:
        - Topbar (desktop-first) zawiera 3 pozycje: `Odkrywaj przepisy`, `Moja Pycha`, `Zakupy`,
        - na mobile/tablet usunięto założenie „hamburger/drawer” dla menu głównego — zastąpione przez Bottom Bar,
        - doprecyzowano widoczność Sidebara o `/shopping/**` oraz zachowanie gościa dla pozycji prywatnych.

## 2. Widoki

### Nowe

- **App Shell (mobile/tablet) — Bottom Bar**
    - **Co dodano**:
        - globalny, przypięty pasek na dole z 3 ikonami + etykietami dla nawigacji głównej,
        - aktywna pozycja jest wyróżniona,
        - layout widoków uwzględnia `padding-bottom` + safe-area.

### Zmienione / doprecyzowane

- **App Shell — Topbar**
    - **Co się zmieniło / doprecyzowano**:
        - na desktopie główna nawigacja zawiera `Odkrywaj przepisy`, `Moja Pycha`, `Zakupy`,
        - na mobile/tablet zakładki głównej nawigacji nie są pokazywane w Topbarze (zastępuje je Bottom Bar).

- **Nawigacja na widokach publicznych (`/`, `/explore`, `/explore/recipes/:id-:slug`)**
    - **Co się zmieniło / doprecyzowano**:
        - na mobile/tablet obowiązuje Bottom Bar (również dla gościa),
        - kliknięcie `Moja Pycha` / `Zakupy` jako gość prowadzi do logowania (z powrotem do docelowej ścieżki po sukcesie).

## 3. API

### Zmienione / doprecyzowane

- **Plan API — UI Navigation (frontend-only)**
    - **Co się zmieniło / doprecyzowano**:
        - dopisano notatkę, że konfiguracja menu jest zahardkodowana we froncie i zmiana Bottom Bar / Topbar nie wymaga nowych endpointów API w MVP.

