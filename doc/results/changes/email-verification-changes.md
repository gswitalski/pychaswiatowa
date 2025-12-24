# Email Verification - zmiany

## 1. Historyjki użytkownika

- **US-001 – Rejestracja nowego użytkownika (ZMIENIONE)**
    - **Co się zmieniło:** usunięto auto-logowanie po rejestracji. Po rejestracji system wysyła e-mail weryfikacyjny i pokazuje ekran „Wysłaliśmy link aktywacyjny…”. Logowanie jest możliwe dopiero po potwierdzeniu e-maila.

- **US-002 – Logowanie i wylogowywanie użytkownika (ZMIENIONE)**
    - **Co się zmieniło:** jeśli e-mail nie jest potwierdzony, logowanie jest blokowane, a użytkownik widzi komunikat + akcję ponownej wysyłki linku.

- **US-033 – Ponowna wysyłka linku weryfikacyjnego e-mail (NOWE)**
    - Ekran „Wysłaliśmy link aktywacyjny…” udostępnia akcję „Wyślij ponownie” z cooldown 60s i limitami antynadużyciowymi.

- **US-034 – Obsługa nieważnego lub wygasłego linku weryfikacyjnego (NOWE)**
    - Dla nieważnego/wygasłego linku użytkownik widzi czytelny komunikat i może poprosić o nowy link.

## 2. Widoki

- **/register (ZMIENIONE)**
    - **Co się zmieniło:** formularz rejestracji zawiera teraz: nazwa użytkownika, e-mail, hasło, potwierdzenie hasła. Po sukcesie przekierowuje do `/register/verify-sent` (zamiast auto-logowania).

- **/register/verify-sent (NOWE)**
    - Widok z potwierdzeniem wysyłki linku i akcjami: „Wyślij ponownie” (cooldown 60s) oraz „Zmień e-mail”.

- **/auth/callback (NOWE, techniczny)**
    - Trasa callback do obsługi kliknięcia w link z e-maila (wymiana kodu/ustalenie wyniku) i przekierowanie na sukces/błąd.

- **/email-confirmed (NOWE)**
    - Komunikat „Adres e-mail potwierdzony. Możesz się zalogować.” + CTA do `/login`.

- **/email-confirmation-invalid (NOWE)**
    - Komunikat „Link nieważny lub wygasł” + akcja „Wyślij nowy link”.

- **/login (ZMIENIONE)**
    - **Co się zmieniło:** w przypadku niepotwierdzonego e-maila widok pokazuje błąd + akcję „Wyślij link ponownie”.

## 3. API

- **Supabase Auth (ZMIENIONE / DOPRECYZOWANE)**
    - **Co się zmieniło:** rejestracja wymaga potwierdzenia e-mail (email confirmations enabled). Aplikacja korzysta z wbudowanych mechanizmów Supabase do wysyłki i ponownej wysyłki e-maili weryfikacyjnych.

- **POST /auth/signup (NOWE w planie API)**
    - Rejestracja z `emailRedirectTo` i metadanymi użytkownika (np. `username`).

- **POST /auth/resend (NOWE w planie API)**
    - Ponowna wysyłka e-maila weryfikacyjnego typu `signup`.

- **GET /auth/callback (NOWE w planie API – trasa frontendu)**
    - Finalizacja weryfikacji po przekierowaniu z Supabase i przekierowanie do widoków sukces/błąd.


