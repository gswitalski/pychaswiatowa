# Zmiany: Publiczne Widoki dla Zalogowanego (Authenticated Public Views)

## 1. Historyjki Użytkownika

### Nowe historyjki

**US-020: Publiczne widoki w trybie zalogowanego (App Shell)**
- **Opis:** Jako użytkownik zalogowany, chcę przeglądać publiczne widoki (landing, explore, publiczne szczegóły) bez przycisków logowania/rejestracji i z dostępem do nawigacji zalogowanej, abym mógł płynnie przechodzić między częścią publiczną a moim kontem.
- **Co się zmieniło:** Nowy wariant tych samych publicznych ścieżek dla użytkownika zalogowanego (bez zmiany zakresu treści).

**US-021: Dodanie publicznego przepisu do kolekcji z widoku publicznego**
- **Opis:** Jako użytkownik zalogowany, chcę móc dodać publiczny przepis do jednej z moich kolekcji bez opuszczania widoku publicznego, abym mógł zapisywać inspiracje.
- **Co się zmieniło:** Na publicznych szczegółach przepisu dla zalogowanego pojawia się akcja „Dodaj do kolekcji” (gość widzi CTA do logowania/rejestracji).

**US-022: Oznaczenie moich publicznych przepisów w katalogu publicznym**
- **Opis:** Jako użytkownik zalogowany, chcę widzieć, które przepisy w publicznym katalogu są moje, abym mógł je szybko rozpoznać.
- **Co się zmieniło:** Na listach publicznych (landing/explore) dodano oznaczenie „Twój przepis”.

### Zmienione historyjki

**US-019: Przeglądanie szczegółów publicznego przepisu**
- **Co się zmieniło:** Dla zalogowanego CTA do logowania/rejestracji jest zastąpione akcjami zalogowanego (w szczególności „Dodaj do kolekcji” dla cudzych przepisów).

## 2. Widoki

### Zmienione widoki

**1. Landing Page (`/`)**
- **Co się zmieniło:** Dla zalogowanego widok korzysta z App Shell (Sidebar + Topbar z profilem) i nie pokazuje przycisków „Zaloguj się” / „Zarejestruj się”.

**2. Publiczny katalog przepisów (Explore) (`/explore`)**
- **Co się zmieniło:** Dla zalogowanego na kartach przepisów pojawia się badge „Twój przepis” dla przepisów autora.

**3. Publiczne szczegóły przepisu (`/explore/recipes/:id-:slug`)**
- **Co się zmieniło:**
    - gość: CTA do logowania/rejestracji,
    - zalogowany: akcja „Dodaj do kolekcji” (dla cudzych przepisów) lub akcje właściciela (dla własnych).

## 3. API

### Zmienione endpointy

**GET /public/recipes**
- **Co się zmieniło:** W odpowiedzi listingu dodano `author` (id + username), aby frontend mógł oznaczyć „Twój przepis” porównując `author.id` z tożsamością użytkownika.

### Nowe endpointy

**GET /me**
- **Co się zmieniło:** Nowy endpoint (JWT) zwracający minimalne dane profilu zalogowanego użytkownika do inicjalizacji App Shell także na publicznych ścieżkach.
