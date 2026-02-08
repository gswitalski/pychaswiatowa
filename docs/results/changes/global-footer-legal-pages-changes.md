# Zmiany: Global footer + legal pages

## 1. Historyjki użytkownika

- **Nowe**
    - **US-057 – Globalna stopka i strony informacyjne (Regulamin / Polityka prywatności / Wydawca)**  
      Dodano historyjkę opisującą globalną stopkę na wszystkich stronach (z wyjątkiem technicznego `/auth/callback`) oraz publiczne strony legal pod ścieżkami:
        - `/legal/terms`
        - `/legal/privacy`
        - `/legal/publisher`

## 2. Widoki

- **Zmienione**
    - **Layouty aplikacji (publiczne / prywatne / auth)**: dodano założenie globalnej stopki jako elementu treści (nie-sticky), z uwzględnieniem `padding-bottom` / safe-area na mobile/tablet (żeby nie wchodziła pod Bottom Bar).  
      *Zmiana*: nowe, stałe miejsce w UI z linkami do stron legal i informacją o prawach autorskich.

- **Nowe**
    - **Warunki korzystania (Regulamin)** (`/legal/terms`) – strona publiczna ze statycznym tekstem (MVP: placeholder).
    - **Polityka prywatności** (`/legal/privacy`) – strona publiczna ze statycznym tekstem (MVP: placeholder).
    - **Wydawca serwisu** (`/legal/publisher`) – strona publiczna ze statycznym tekstem (MVP: placeholder).

## 3. API

- **Zmienione**
    - **Brak zmian w API (MVP)**: dla tej funkcjonalności nie dodajemy endpointów.  
      *Zmiana*: w planie API dodano sekcję dokumentacyjną „Legal pages (frontend-only)” opisującą, że są to routy SPA z placeholderami treści.

