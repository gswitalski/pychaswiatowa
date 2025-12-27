# Role-based access control (RBAC) – zmiany

Poniższy dokument zbiera elementy **nowe** lub **zmienione** w związku z przygotowaniem aplikacji pod dostęp do funkcji zależny od roli użytkownika.

## 1. Historyjki użytkownika

- **Nowe: US-035 – Odczyt roli zalogowanego użytkownika (RBAC – przygotowanie)**
    - Użytkownik ma dokładnie jedną rolę aplikacyjną: `user | premium | admin`.
    - Domyślna rola przy rejestracji: `user`.
    - Rola jest dostępna po stronie klienta poprzez claim w JWT (rekomendowana nazwa: `app_role`).
    - Brak UI do nadawania/zmiany ról w MVP (zmiany wykonywane w bazie danych).

## 2. Widoki

- **Nowe: Widok „Brak dostępu (403)”**
    - **Ścieżka:** `/forbidden` (techniczny widok pomocniczy)
    - **Cel:** czytelny komunikat o braku uprawnień (przyszłościowo: premium/admin), bez ujawniania szczegółów zasobów/reguł.

- **Zmiana (przekrojowa, bez nowego flow produktowego):** przygotowanie UI do odczytu roli
    - Rola aplikacyjna jest odczytywana z JWT (claim `app_role`) i może być później użyta przez guardy / warstwę UI do gated features.
    - Na tym etapie nie wprowadzamy reguł „ukryj/disabled/tooltip” – będzie to realizowane przy wdrażaniu konkretnych funkcji premium/admin.

## 3. API

- **Zmiana: JWT zawiera rolę aplikacyjną**
    - JWT (access token) powinien zawierać custom claim `app_role` o wartościach: `user | premium | admin`.
    - Domyślne ustawienie roli `user` odbywa się po stronie serwera/bazy (klient nie wysyła roli w signup).

- **Zmiana: `GET /me` zwraca rolę aplikacyjną**
    - Rozszerzono payload o pole `app_role`, aby App Shell mógł (opcjonalnie) bootstrapować rolę także z API, jeśli jest to wygodne diagnostycznie lub pod przyszłe scenariusze.

