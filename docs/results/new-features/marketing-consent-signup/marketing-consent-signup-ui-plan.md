# Marketing Consent Signup — plan UI

## Cel UI

Rozszerzyć istniejący widok rejestracji o opcjonalną zgodę marketingową, przedstawioną w czytelny i nienachalny sposób, bez zmiany głównego celu ekranu, jakim jest szybkie utworzenie konta.

## Zmiany w istniejącym widoku

### 1) `/register` — formularz rejestracji

- **Ścieżka**: `/register`
- **Zakres zmiany**: rozszerzenie aktualnego formularza o dodatkowe pole typu checkbox.

### Nowy element formularza

- Dodać pole **checkbox** (np. `mat-checkbox`) dla zgody marketingowej.
- Checkbox umieścić w dolnej części formularza:
    - po polu `potwierdzenie hasła`,
    - przed głównym przyciskiem CTA rejestracji.
- Etykieta checkboxa powinna jasno komunikować cel zgody, np.:
    - „Chcę otrzymywać informacje marketingowe dotyczące serwisu PychaŚwiatowa.”
- W treści obok checkboxa lub bezpośrednio pod nim umieścić link do **`/legal/privacy`**.
- Dodać krótką informację pomocniczą, że zgoda jest **dobrowolna** i nie jest wymagana do założenia konta.

## Zachowanie UX

- Checkbox jest **domyślnie odznaczony**.
- Checkbox nie bierze udziału w walidacji wymaganych pól formularza.
- Użytkownik może:
    - zostawić checkbox odznaczony i zakończyć rejestrację,
    - zaznaczyć checkbox i zakończyć rejestrację.
- Kliknięcie linku do **`/legal/privacy`** nie powinno powodować utraty wpisanych danych formularza.
- Kopia tekstowa zgody powinna być czytelna również na mobile/tablet i nie może „rozpychać” układu w sposób psujący rytm formularza.

## Stany i edge-case’y

- **Stan domyślny**:
    - checkbox odznaczony,
    - brak komunikatu błędu,
    - formularz zachowuje się jak dotąd.
- **Stan zaznaczony**:
    - po zaznaczeniu użytkownik nie widzi dodatkowych pól,
    - stan checkboxa jest uwzględniany przy wysłaniu formularza.
- **Stan wysyłki formularza**:
    - checkbox oraz przycisk submit powinny pozostać spójne z istniejącym stanem loading całego formularza,
    - w trakcie submitu nie należy zmieniać położenia elementów.
- **Błędy backendowe przy rejestracji**:
    - komunikaty błędów pozostają obsługiwane jak w obecnym flow,
    - błąd rejestracji nie resetuje checkboxa ani pozostałych pól bez potrzeby.
- **Responsywność**:
    - na węższych ekranach tekst zgody powinien łamać się naturalnie,
    - link do polityki prywatności musi pozostać łatwy do kliknięcia/tapnięcia.

## Wymagane elementy UI/komponenty (proponowane)

- Rozszerzenie istniejącego komponentu strony rejestracji.
- Dodanie nowej kontrolki formularza, np.:
    - `marketingConsent: FormControl<boolean>`
- Utrzymanie wersji treści zgody w konfiguracji frontendu lub jako stała domenowa używana podczas submitu formularza.

## Proponowana treść zgody (robocza)

> „Chcę otrzymywać informacje marketingowe dotyczące serwisu PychaŚwiatowa. Zgoda jest dobrowolna i może zostać wycofana w przyszłości. Szczegóły przetwarzania danych znajdują się w Polityce prywatności.”

> Link w treści: **`/legal/privacy`**

## Definition of Done (UI)

- Widok **`/register`** zawiera opcjonalny checkbox zgody marketingowej.
- Checkbox jest domyślnie niezaznaczony.
- Przy checkboxie znajduje się czytelna treść zgody oraz link do **`/legal/privacy`**.
- Rejestracja działa poprawnie zarówno bez zaznaczenia zgody, jak i z zaznaczeniem.
- UI pozostaje spójne z istniejącym formularzem rejestracji i komponentami Angular Material.
- Zakres UI nie obejmuje zarządzania zgodą po rejestracji.
