# PS-37 — Review widoków (runda 1)

**Werdykt: ZMIANY_WYMAGANE**
**Reviewer:** główny czat (review wykonane bez subagenta — patrz „Tryb review”)
**Zakres:** `views` · **Baza diffu:** `HEAD` = `e3fa764` · **Data:** 2026-11-10

## Tryb review

Subagent `ps-code-reviewer` przerwał się (`Subagent was aborted`) dwukrotnie: pełny zakres
i jedna powtórka z węższym zakresem. Zgodnie z `ps-new-feature` (krok 6) zmieniono strategię:
review wykonano w głównym czacie na pełnym diffie plików kodu. Nie jest to niezależny
reviewer, więc po poprawkach zalecany jest ręczny przegląd diffu przez użytkownika.
Kod nie został uruchomiony w przeglądarce — nic z CSS/a11y nie ma statusu `PASS`.

## Sprawdzone przez implementera (zgłoszone, nie powtarzane przeze mnie)

`npm run lint` PASS · `npm run test:run` PASS (62 pliki, 342 testy) · `npm run build` PASS.
Strażnik zakresu `git diff --stat HEAD -- supabase shared/contracts .github`: pusty (sprawdzone
ponownie w review). V6 (`supabase.from(` / `innerHTML` w nowym kodzie): brak trafień (`PASS`).

## Uwagi

### Krytyczne
Brak.

### Ważne

**W1. Testy nie spełniają DoD historyjki ani sekcji 8 planu widoków.**
Zielone testy nie dowodzą większości scenariuszy, bo ich nie ma:
- `topbar.component.spec.ts:77` — jedyny nowy test (nazwa obecna, `aria-label`, klasa).
  Brakuje: braku nazwy (`null`/pusta/białe znaki) ⇒ sama ikona i `aria-label="Menu użytkownika"`,
  tooltipu (`MatTooltip.message`/`disabled`), nagłówka menu „Zalogowano jako …” po otwarciu menu,
  braku nagłówka bez nazwy, nazwy wielowyrazowej (`Jan Kowalski`), ucieczki znaków HTML
  (`<b>x</b>` jako tekst), roli `admin` (nagłówek nad pozycją „Admin”), zmiany nazwy w stanie ⇒
  aktualizacja widoku.
- `auth.service.spec.ts`, `subscription-state.service.spec.ts`, `profile-settings.facade.spec.ts`
  — brak jakiejkolwiek asercji integracji z `CurrentUserStateService`. Dotyczy to:
  `switchUser` przy logowaniu/wylogowaniu/zmianie użytkownika (`auth.service.ts:250,264`),
  `applyMe` po `GET /me` (`auth.service.ts:292`) i po odświeżeniu (`subscription-state.service.ts:55,90`),
  ominięcia `applyMe` przy błędzie `/me` (nazwa przetrwa), spóźnionej odpowiedzi poprzedniego
  użytkownika, `applyProfile` po sukcesie zapisu i jego braku przy `409`/`500`
  (`profile-settings.facade.ts:86`) oraz asercji, że po zapisie nie ma dodatkowego `getMe`.
- `complete-profile-page.component.spec.ts:72,87` — brak przypadku błędu zapisu (brak
  `applyProfile`, brak nawigacji, `markComplete` niewywołane).
- `current-user-state.service.spec.ts` — brak jawnych przypadków: `applyProfile` z `id` innego
  użytkownika, nazwa z samych białych znaków przez `applyProfile`, zmiana `A → B → A`.

Bez tych testów scenariusze 8–11, 13 i 15 historyjki nie mają pokrycia automatycznego.

### Nieblokujące

**N1. Nagłówek menu z `role="presentation"` w `role="menu"`** — `topbar.component.html:63`.
ARIA wymaga w `menu` dzieci typu `menuitem`/`group`. Czytniki ekranu mogą pominąć lub
dziwnie odczytać nagłówek; ostatecznie użytkownik poznaje nazwę z `aria-label` przycisku.
`WYMAGA_WERYFIKACJI` ręcznie czytnikiem ekranu (plan, N6).

**N2. `(menuOpened)="userTooltip.hide(0)"`** — `topbar.component.html:53`. Dodatek spoza planu
UI (opisany w planie widoków 12.1). Poprawny, ale wymaga ręcznego potwierdzenia
(tooltip + menu na dotyku i klawiaturze).

**N3. Kalibracja `clamp()`** — `topbar.component.scss:164`. Wartość startowa
`clamp(72px, calc(50vw − 392px), 160px)` nie została zmierzona (krok 8 planu:
`WYMAGA_WERYFIKACJI`). Ryzyko kolizji z nawigacją środkową przy 960–1100 px (rola `user`
z „Cennik” i rola `admin` mają różny budżet).

**N4. Progi responsywności** — `topbar.component.scss:187,212`. Ukrycie nazwy poniżej 600 px
realizują dwa osobne media query (`≤480` oraz `481–599.98`). Zgodne z decyzją, ale warto
zastąpić jednym `@media (max-width: 599.98px)` przy okazji kalibracji (mniej miejsc do
utrzymania). Preexistujący rozjazd 960 px (SCSS vs. `LayoutService`) — poza zakresem (N5 w planie UI).

**N5. Wąski wyścig** (stary `GET /me` zwracający poprzednią nazwę po udanym `PUT /profile`) —
akceptowany w planie (R4); stan zbiega po kolejnym `/me`/F5.

## Zgodność z regułami projektu

| Reguła | Wynik |
|---|---|
| Standalone, signals, `inject()`, `@if`, OnPush, 4 spacje | `PASS` (przegląd diffu) |
| Brak `supabase.from(` / `rpc` | `PASS` |
| Brak `innerHTML` (nazwa jako interpolacja tekstu) | `PASS` |
| Zmiany poza `src/` i `docs/` | brak |

## Pokrycie scenariuszy GWT (historyjka)

| Obszar scenariusza | Implementacja | Test automatyczny | Status |
|---|---|---|---|
| Nazwa w przycisku z ikoną, `aria-label`/tooltip | tak (`html:48–58`) | częściowo (`topbar.spec:77`) | `PASS` kod / `WYMAGA_TESTÓW` |
| Brak nazwy (ładowanie/błąd/pusta) ⇒ sama ikona | tak (`displayName` `null`) | `current-user-state.spec:32` (stan), brak testu topbara | `WYMAGA_TESTÓW` |
| Nagłówek menu | tak (`html:62–66`) | brak | `WYMAGA_TESTÓW` |
| `<600 px` ukrycie nazwy | CSS (`scss:187,212`) | niemożliwy w jsdom | `WYMAGA_WERYFIKACJI` (ręcznie) |
| Obcięcie długiej nazwy | CSS (`scss:120–128`) | niemożliwy w jsdom | `WYMAGA_WERYFIKACJI` (ręcznie) |
| Zmiana nazwy w Ustawieniach | tak (`facade:86`) | brak | `WYMAGA_TESTÓW` |
| Uzupełnienie profilu po OAuth | tak (`complete-profile:78`) | tak (`:72`) | `PASS` (bez przypadku błędu) |
| Wylogowanie / zmiana użytkownika / wyścig | tak (`auth.service:250,264`, id-guard) | tylko serwis stanu (`:41`) | `WYMAGA_TESTÓW` |
| Błąd `/me` nie czyści nazwy | tak (brak `applyMe` w `catch`) | brak | `WYMAGA_TESTÓW` |
| Panel admina / rola `admin` | ten sam topbar | brak | `WYMAGA_TESTÓW` |
| `PublicLayout`, `WelcomeHeader` bez zmian | brak zmian w diffie | — | `PASS` |

## Wymagane poprawki (runda 2)

1. Uzupełnić testy z W1 (tylko pliki `*.spec.ts`; kod produkcyjny bez zmian, chyba że test
   ujawni błąd).
2. Po poprawkach: `npm run test:run`, `npm run lint`, `npm run build` z jawnym `PASS`/`FAIL` i
   przeczytanie całego diffu.

## Decyzja

`ZMIANY_WYMAGANE` — jedna runda poprawek testów (runda 2 z max. 2). Kod produkcyjny nie ma uwag
krytycznych. Statusy ręczne (kalibracja `clamp()`, breakpointy, czytnik ekranu) pozostają
`WYMAGA_WERYFIKACJI`.
