# Edycja ról użytkowników przez administratora — wymagania

## 1. Cel

Umożliwienie administratorowi zmiany roli istniejącego użytkownika z poziomu listy użytkowników pod ścieżką `/admin/users`.

Funkcja rozszerza aktualny panel administracyjny, w którym lista użytkowników jest dostępna tylko do odczytu. Nie udostępnia zmiany roli użytkownikom zwykłym ani premium.

## 2. Zakres funkcjonalny

1. Przy każdym użytkowniku na liście administracyjnej dostępna jest akcja „Edytuj rolę”.
2. Administrator może przypisać jedną z ról:
    - `user`,
    - `premium`,
    - `admin`.
3. Zmiana roli jest zatwierdzana w dialogu i zapisywana przez endpoint dostępny wyłącznie dla administratora.
4. Po powodzeniu tabela pokazuje nową rolę bez pełnego przeładowania widoku, a administrator otrzymuje komunikat potwierdzający.
5. Po zmianie roli użytkownik, którego dotyczy zmiana, musi ponownie się zalogować, aby jego JWT zawierał aktualny claim `app_role`.

## 3. Historyjka użytkownika

### US-ADM-003 — Zmiana roli użytkownika

**Jako** zalogowany administrator  
**chcę** zmienić rolę wybranego użytkownika na liście `/admin/users`  
**aby** zarządzać uprawnieniami dostępu do funkcji aplikacji.

#### Kryteria akceptacji

1. Tabela użytkowników zawiera akcję otwierającą dialog zmiany roli dla każdego wiersza, który może zostać zmieniony.
2. Dialog pokazuje identyfikację edytowanego użytkownika oraz bieżącą rolę.
3. Administrator może wybrać wyłącznie `user`, `premium` albo `admin`.
4. Po zapisaniu prawidłowego wyboru rola jest aktualizowana po stronie serwera, a wiersz tabeli pokazuje nową wartość.
5. Gdy wybrana rola jest taka sama jak bieżąca, zapis nie jest wysyłany, a interfejs jasno komunikuje brak zmian albo blokuje przycisk zapisu.
6. Tylko użytkownik z rolą `admin` może wywołać operację; sama widoczność elementu UI nie jest mechanizmem autoryzacji.
7. Administrator nie może zmienić własnej roli.
8. System nie pozwala obniżyć roli ostatniego aktywnego administratora.
9. Gdy użytkownik docelowy nie istnieje, jego rola została zmieniona równolegle albo naruszone są reguły ochronne, administrator otrzymuje komunikat błędu i tabela pozostaje spójna z danymi serwera.

## 4. Reguły biznesowe i bezpieczeństwa

| Reguła | Opis |
|---|---|
| Źródło prawdy roli | `app_role` jest przechowywana w `auth.users.raw_app_meta_data`; tabela `profiles` nie przechowuje roli. |
| Dozwolone role | Tylko `user`, `premium`, `admin`. Wartość musi być walidowana po stronie backendu. |
| Autoryzacja | Operację wykonuje wyłącznie endpoint administracyjny po weryfikacji JWT z `app_role = admin`. |
| Zakaz samomodyfikacji | Administrator nie może zmienić roli konta, z którego wykonuje operację. |
| Ochrona ostatniego administratora | Nie można zmienić roli użytkownika, jeśli spowodowałoby to brak kont z rolą `admin`. |
| Aktualność sesji docelowej | Zmiana nie modyfikuje już wydanego JWT. Użytkownik docelowy otrzymuje nowe uprawnienia po ponownym zalogowaniu. |
| Zaufanie do klienta | Klient przekazuje tylko żądaną rolę. Identyfikator administratora, aktualna rola i wszystkie zabezpieczenia są ustalane oraz sprawdzane na serwerze. |

## 5. Poza zakresem

- Tworzenie i usuwanie kont użytkowników z panelu administracyjnego.
- Masowa zmiana ról.
- Definiowanie własnych ról i granularnych uprawnień.
- Historia/audyt zmian ról.
- Wymuszone wylogowanie użytkownika po zmianie roli.
