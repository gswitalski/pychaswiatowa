# Marketing Consent Signup — wymagania

## Cel

Dodać do formularza rejestracji opcjonalny checkbox zgody marketingowej, tak aby użytkownik mógł świadomie zapisać się na otrzymywanie informacji marketingowych już podczas zakładania konta, bez blokowania samej rejestracji.

## Kontekst architektury (istniejące założenia)

- Aplikacja działa jako SPA w Angular + Angular Material.
- Istnieje publiczny widok rejestracji pod ścieżką **`/register`**.
- Rejestracja opiera się o istniejący endpoint **`POST /auth/signup`** oraz Supabase Auth.
- Aktualny zakres rejestracji obejmuje pola: `username`, `email`, `hasło`, `potwierdzenie hasła`.
- W aplikacji istnieje już publiczna strona **Polityki prywatności** pod ścieżką **`/legal/privacy`**.
- Profil użytkownika jest utrzymywany w tabeli **`profiles`**, powiązanej 1:1 z `auth.users`.

## Problem do rozwiązania

- Obecny formularz rejestracji nie pozwala użytkownikowi wyrazić zgody na komunikację marketingową.
- Brakuje jawnego miejsca, w którym użytkownik widzi treść zgody i może podjąć świadomą decyzję.
- System nie przechowuje informacji o statusie zgody marketingowej ani o wersji treści zgody zaakceptowanej podczas rejestracji.

## Zakres (MVP dla tego ficzera)

### Wymagania funkcjonalne

- **FR-MCS-001 (checkbox w rejestracji)**: Formularz **`/register`** zawiera opcjonalny checkbox zgody marketingowej.
    - Checkbox jest **domyślnie niezaznaczony**.
    - Brak zaznaczenia checkboxa nie blokuje utworzenia konta.
- **FR-MCS-002 (jasna treść zgody)**: Przy checkboxie wyświetlana jest czytelna treść zgody marketingowej z linkiem do **`/legal/privacy`**.
    - Treść ma jednoznacznie wskazywać, że zgoda jest dobrowolna.
- **FR-MCS-003 (rozszerzenie procesu signup)**: Istniejący proces rejestracji przekazuje do backendu informację o decyzji użytkownika dotyczącą zgody marketingowej.
- **FR-MCS-004 (persistencja zgody)**: Przy utworzeniu konta system zapisuje w danych profilu:
    - `marketing_consent` — status zgody (`true` / `false`),
    - `marketing_consent_updated_at` — timestamp nadania zgody,
    - `marketing_consent_text_version` — wersję treści zgody zaakceptowanej przez użytkownika.
- **FR-MCS-005 (reguła zapisu dla braku zgody)**: Jeśli użytkownik nie zaznaczy checkboxa:
    - konto zostaje utworzone poprawnie,
    - `marketing_consent = false`,
    - `marketing_consent_updated_at = null`,
    - `marketing_consent_text_version = null`.
- **FR-MCS-006 (reguła zapisu dla zgody udzielonej)**: Jeśli użytkownik zaznaczy checkbox:
    - konto zostaje utworzone poprawnie,
    - `marketing_consent = true`,
    - `marketing_consent_updated_at` przyjmuje czas rejestracji,
    - `marketing_consent_text_version` przyjmuje identyfikator wersji treści zgody pokazanej w formularzu.
- **FR-MCS-007 (brak zmian poza rejestracją)**: MVP obejmuje wyłącznie etap rejestracji.
    - Zarządzanie zgodą po utworzeniu konta w widoku **`/settings`** pozostaje poza zakresem.
- **FR-MCS-008 (spójność z istniejącym flow auth)**: Dodanie zgody marketingowej nie zmienia obecnych zasad rejestracji:
    - nadal wymagane jest potwierdzenie adresu e-mail,
    - nadal brak auto-logowania po rejestracji,
    - pozostałe pola i walidacje formularza pozostają bez zmian.

### Zmiany w modelu danych

- Rozszerzyć tabelę **`profiles`** o pola:
    - `marketing_consent` — `boolean not null default false`,
    - `marketing_consent_updated_at` — `timestamptz null`,
    - `marketing_consent_text_version` — `text null`.

> Uzasadnienie: dla MVP najprostsze i najbardziej spójne z obecną architekturą jest przechowywanie bieżącego statusu zgody bez tworzenia osobnej tabeli historii zgód.

### Poza zakresem (explicitly out-of-scope)

- Zarządzanie zgodą marketingową po rejestracji w `Ustawieniach`.
- Osobne zgody per kanał komunikacji (e-mail, SMS, push).
- Historia zmian zgód i pełny audyt wszystkich decyzji użytkownika.
- Double opt-in dla zgód marketingowych.
- Centrum preferencji marketingowych.

## User stories

### US-MCS-001 — Rejestracja bez zgody marketingowej

Jako **nowy użytkownik** chcę móc założyć konto bez wyrażania zgody marketingowej, aby rejestracja nie była uzależniona od otrzymywania komunikacji marketingowej.

**Kryteria akceptacji:**

- Na ekranie **`/register`** widzę checkbox zgody marketingowej, który nie jest zaznaczony domyślnie.
- Mogę wysłać formularz rejestracji bez zaznaczania checkboxa.
- Konto zostaje utworzone poprawnie zgodnie z istniejącym flow weryfikacji e-mail.
- System zapisuje brak zgody jako `marketing_consent = false`.

### US-MCS-002 — Dobrowolne wyrażenie zgody marketingowej przy rejestracji

Jako **nowy użytkownik** chcę zaznaczyć checkbox zgody marketingowej podczas rejestracji, aby dobrowolnie zapisać się na otrzymywanie informacji marketingowych.

**Kryteria akceptacji:**

- Przy checkboxie widzę jasną treść zgody oraz link do **`/legal/privacy`**.
- Po zaznaczeniu checkboxa i wysłaniu formularza konto zostaje utworzone poprawnie.
- System zapisuje:
    - `marketing_consent = true`,
    - `marketing_consent_updated_at = timestamp rejestracji`,
    - `marketing_consent_text_version = wersja treści zgody pokazanej w formularzu`.
- Rejestracja działa tak samo jak dotychczas poza rozszerzeniem o zapis zgody.

## Wymagania niefunkcjonalne

- **Zgodność i przejrzystość**: Checkbox nie może być zaznaczony domyślnie ani przedstawiony w sposób sugerujący, że zgoda jest obowiązkowa.
- **Spójność danych**: Wersja treści zgody zapisywana przy rejestracji musi odpowiadać treści pokazanej użytkownikowi w UI.
- **Maintainability**: Wersja zgody powinna być utrzymywana jako jawny identyfikator konfiguracyjny, który można zmienić przy aktualizacji tekstu zgody.
- **Bezpieczeństwo**: Backend musi traktować zapis zgody jako dane zaufane dopiero po własnej walidacji payloadu, niezależnie od UI.
