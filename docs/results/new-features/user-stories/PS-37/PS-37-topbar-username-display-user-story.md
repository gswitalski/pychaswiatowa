# PS-37: Wyświetlanie nazwy użytkownika w topbarze

## Opis

Jako **zalogowany użytkownik** (rola `user`, `premium` lub `admin`),
chcę **widzieć swoją nazwę użytkownika obok ikonki konta w górnym pasku aplikacji**,
aby **w każdej chwili wiedzieć, jako kto jestem zalogowany**.

Treść zgłoszenia: „Obok ikonki usera dodać z lewej strony nazwę, abym widział jako kto jestem zalogowany".

---

## Kontekst

Topbar (`src/app/layout/main-layout/components/topbar/`) pokazuje dziś po prawej stronie wyłącznie
ikonkę `account_circle` (przycisk `mat-icon-button` z `aria-label="Menu użytkownika"`), która otwiera
menu z pozycjami „Ustawienia", „Admin" (tylko `admin`) i „Wyloguj się". Użytkownik nie ma żadnej
informacji o tym, na które konto jest zalogowany (istotne np. przy kilku kontach lub koncie testowym).

### Stan obecny (zweryfikowany w kodzie)

- `GET /me` zwraca `MeDto.username` (`shared/contracts/types.ts`) — **nie są potrzebne zmiany API,
  bazy danych, RLS ani kontraktów**.
- `AuthService.bootstrapAiCredits()` wywołuje `MeApiService.getMe()`, a następnie
  `SubscriptionStateService.applyMe(me)`. Mapowanie `mapMeToSnapshot` pomija `username`,
  więc nazwa jest po stronie frontendu **gubiona** i nie jest dostępna dla żadnego komponentu.
- `AuthService` nie przechowuje nazwy użytkownika (zna tylko `userId`, `appRole`, `isAuthenticated`).
- `ProfileSettingsFacade.saveProfile()` po sukcesie aktualizuje wyłącznie własny, lokalny sygnał
  `profile` — zmiana nazwy w Ustawieniach nie jest dziś propagowana nigdzie indziej.
- Topbar jest współdzielony: panel administracyjny to trasa wewnątrz `MainLayout`, bez osobnego topbara.
  Goście (`PublicLayout`) go nie widzą i ich widok **nie zmienia się**.
- Po logowaniu OAuth nazwa może być pusta aż do uzupełnienia profilu na `/auth/complete-profile`.
- Walidacja nazwy w aplikacji: 3–50 znaków, bez białych znaków.
- `topbar__center` (nawigacja główna) jest pozycjonowany absolutnie i widoczny od 960 px;
  istniejące progi stylów topbara to 960 px oraz 480 px. `LayoutService.isMobile` obejmuje
  dziś zakres <960 px (XSmall + Small), więc **granica 600 px jest w topbarze nowa**.

---

## Zakres

### W zakresie

- Wyświetlenie nazwy użytkownika w topbarze, **z lewej strony ikonki konta**, jako element tego samego
  przycisku otwierającego menu użytkownika.
- Udostępnienie nazwy użytkownika jako współdzielonego stanu frontendowego (jedno źródło prawdy),
  zasilanego z `GET /me` i odświeżanego natychmiast po zmianie nazwy w Ustawieniach.
- Nagłówek z nazwą w menu użytkownika.
- Responsywność (ukrycie / obcięcie nazwy), dostępność (tooltip, `aria-label`) oraz testy jednostkowe.

### Poza zakresem

- Zmiany w API, bazie danych, RLS, kontraktach DTO i Edge Functions.
- `WelcomeHeader` (dashboard) — **bez zmian**.
- `PublicLayout` / widok gości — bez zmian.
- Wyświetlanie adresu e-mail, roli, planu lub avatara (zdjęcia) w topbarze.
- Zmiana pozostałych pozycji menu użytkownika i ich kolejności (poza dodaniem nagłówka).
- Zmiana reguł walidacji nazwy użytkownika.

---

## Założenia i decyzje

1. **Sama nazwa** obok ikonki, bez prefiksu w tekście widocznym. Komunikat
   „Zalogowano jako {nazwa}" jest używany w tooltipie oraz w `aria-label` przycisku.
2. **Nazwa + ikona to jeden przycisk** (jeden cel dotykowy, jeden fokus), który otwiera menu użytkownika.
   Nazwa jest tekstem wewnątrz przycisku, a nie osobnym, nieinteraktywnym elementem.
3. **Breakpointy:**
    - `<600 px` — nazwa **ukryta w topbarze** (zostaje tylko ikona); nazwa jest widoczna jako nagłówek
      menu użytkownika;
    - `600–959 px` — nazwa widoczna, z obcięciem wielokropkiem;
    - `≥960 px` — nazwa widoczna, z obcięciem wielokropkiem po przekroczeniu maksymalnej szerokości.
4. **Obcięcie:** długa nazwa jest obcinana wielokropkiem w jednej linii; maksymalna szerokość tekstu
   w topbarze to ok. 160–200 px (dokładną wartość ustala plan UI, nie więcej niż 200 px).
   Pełna nazwa jest dostępna w tooltipie.
5. **Brak nazwy → nic nie pokazujemy.** Dotyczy: trwającego ładowania `/me`, błędu `/me`, nazwy pustej
   lub złożonej wyłącznie z białych znaków. Topbar wygląda wtedy dokładnie jak dziś (tylko ikona,
   `aria-label="Menu użytkownika"`), bez tekstu zastępczego, szkieletu i placeholdera.
6. **Zmiana nazwy w Ustawieniach odświeża topbar natychmiast**, bez przeładowania strony i bez
   ponownego wywołania `GET /me` (współdzielony sygnał/stan).
7. **Zakres tylko topbar** — `WelcomeHeader` pozostaje bez zmian.
8. **Nagłówek menu użytkownika — decyzja spójna dla wszystkich szerokości:** gdy nazwa jest znana
   (niepusta), menu użytkownika **zawsze** zaczyna się nagłówkiem „Zalogowano jako {nazwa}"
   (niebędącym pozycją klikalną, oddzielonym od pozycji menu separatorem), niezależnie od szerokości
   ekranu. Uzasadnienie: na `<600 px` nagłówek jest jedynym miejscem z nazwą (wymóg), a na większych
   szerokościach pełna, nieobcięta nazwa jest użyteczna na urządzeniach dotykowych, gdzie tooltip jest
   trudno dostępny. Dzięki temu nie ma osobnej logiki responsywnej dla nagłówka. Gdy nazwy brak —
   nagłówka nie ma, a menu wygląda jak dziś. Długa nazwa w nagłówku jest zawijana lub obcinana tak, by
   nie rozszerzać menu poza szerokość ekranu (pełna nazwa musi pozostać dostępna, np. przez zawijanie).

---

## Kryteria akceptacji

### Scenariusz 1: Nazwa widoczna obok ikonki (desktop, happy path)

- **Given**: Zalogowany użytkownik o nazwie `Kasia_Gotuje`, szerokość okna ≥960 px, `GET /me` zakończyło się sukcesem.
- **When**: Użytkownik otwiera dowolną stronę korzystającą z topbara.
- **Then**:
    - W topbarze po prawej stronie widoczny jest tekst `Kasia_Gotuje` **bezpośrednio po lewej stronie** ikonki konta.
    - Tekst nie zawiera prefiksu („Zalogowano jako") ani innych dodatków.
    - Nazwa i ikona tworzą **jeden przycisk**; kliknięcie w nazwę lub ikonę otwiera menu użytkownika.
    - Pozycja linku „Cennik" (dla roli `user`) i nawigacji głównej nie ulega zmianie
      poza przesunięciem wynikającym z szerokości nazwy; elementy nie nakładają się na siebie.

### Scenariusz 2: Tooltip i dostępność

- **Given**: Nazwa użytkownika jest znana (np. `Kasia_Gotuje`).
- **When**: Użytkownik najeżdża kursorem lub ustawia fokus klawiaturą na przycisku użytkownika
  (lub, na urządzeniu dotykowym, przytrzymuje go).
- **Then**:
    - Tooltip pokazuje `Zalogowano jako Kasia_Gotuje` (pełna, nieobcięta nazwa).
    - `aria-label` przycisku ma wartość `Zalogowano jako Kasia_Gotuje`; widoczny tekst (nazwa) jest
      zawarty w nazwie dostępnej przycisku.
    - Przycisk zachowuje semantykę przycisku otwierającego menu (`aria-haspopup`, `aria-expanded`
      zapewniane przez `matMenuTriggerFor`) i obsługę Enter/Spacja/Esc.
    - Fokus klawiatury ma widoczny wskaźnik, a przycisk ma co najmniej 40 px wysokości (cel dotykowy).

### Scenariusz 3: Telefon (<600 px) — nazwa ukryta w topbarze

- **Given**: Zalogowany użytkownik z niepustą nazwą, szerokość okna <600 px.
- **When**: Użytkownik ogląda topbar.
- **Then**:
    - Widoczna jest wyłącznie ikona konta (jak dziś); tekst nazwy **nie jest widoczny**
      i nie zajmuje miejsca (nie powoduje przepełnienia ani zawijania topbara).
    - `aria-label` przycisku nadal ma wartość `Zalogowano jako {nazwa}`, a tooltip działa jak w scenariuszu 2.
    - Hamburger (gdy sidebar jest włączony), logo i link „Cennik" zachowują obecny układ.

### Scenariusz 4: Tablet (600–959 px) — nazwa widoczna z obcięciem

- **Given**: Zalogowany użytkownik z niepustą nazwą, szerokość okna od 600 do 959 px (nawigacja główna ukryta, bo `isMobileOrTablet`).
- **When**: Użytkownik ogląda topbar.
- **Then**:
    - Nazwa jest widoczna po lewej stronie ikonki, w jednej linii.
    - Jeśli nazwa nie mieści się w dostępnej szerokości, jest obcięta wielokropkiem;
      logo, link „Cennik", hamburger i przycisk użytkownika pozostają w pełni widoczne i klikalne
      (topbar nie przewija się poziomo i nie zawija elementów).

### Scenariusz 5: Długa nazwa — obcięcie wielokropkiem

- **Given**: Użytkownik z nazwą o długości 50 znaków (maksimum walidacji), szerokość ≥600 px.
- **When**: Topbar jest renderowany.
- **Then**:
    - Tekst w topbarze jest obcięty wielokropkiem przy maksymalnej szerokości ok. 160–200 px, w jednej linii.
    - Szerokość przycisku nie przekracza limitu, a pozostałe elementy topbara nie są wypychane.
    - Pełna nazwa jest dostępna w tooltipie (`Zalogowano jako {pełna nazwa}`) i w nagłówku menu użytkownika.

### Scenariusz 6: Nagłówek menu użytkownika

- **Given**: Użytkownik z niepustą nazwą `Kasia_Gotuje`, dowolna szerokość ekranu.
- **When**: Użytkownik otwiera menu użytkownika.
- **Then**:
    - Na górze menu widoczny jest nagłówek `Zalogowano jako Kasia_Gotuje`, odseparowany od pozycji menu.
    - Nagłówek nie jest pozycją klikalną, nie przejmuje fokusu jako akcja i nie zmienia kolejności fokusu
      pozostałych pozycji (Ustawienia, Admin dla `admin`, Wyloguj się).
    - Na szerokości <600 px nagłówek jest jedynym miejscem, w którym nazwa jest widoczna na ekranie.
    - Pozycje „Ustawienia", „Admin" (tylko `admin`) i „Wyloguj się" działają i wyglądają jak dotychczas.

### Scenariusz 7: Brak nazwy — ładowanie `/me`

- **Given**: Użytkownik jest zalogowany, ale odpowiedź `GET /me` jeszcze nie dotarła.
- **When**: Topbar jest renderowany.
- **Then**:
    - Widoczna jest tylko ikona konta, bez tekstu, szkieletu i tekstu zastępczego (np. „Użytkownik", „…").
    - `aria-label` to `Menu użytkownika`, brak tooltipu z nazwą, brak nagłówka w menu.
    - Po dotarciu odpowiedzi nazwa pojawia się w topbarze bez przeładowania strony.

### Scenariusz 8: Brak nazwy — błąd `GET /me`

- **Given**: `GET /me` kończy się błędem (np. 500, brak sieci) po zalogowaniu.
- **When**: Topbar jest renderowany.
- **Then**:
    - Topbar wygląda jak dziś (sama ikona, `aria-label="Menu użytkownika"`), bez komunikatu błędu
      w topbarze i bez tekstu zastępczego.
    - Pozostałe funkcje topbara (menu, wylogowanie, nawigacja, „Cennik") działają bez zmian.
    - Błąd jest logowany w konsoli tak jak dotychczas (istniejące zachowanie `AuthService`); brak nowych
      okien dialogowych ani toastów.

### Scenariusz 9: Brak nazwy — pusta nazwa (OAuth przed uzupełnieniem profilu)

- **Given**: Użytkownik zalogował się przez OAuth i `username` jest pusty (lub składa się wyłącznie z białych znaków).
- **When**: Topbar jest renderowany (na stronie, na której jest widoczny).
- **Then**:
    - Nic nie jest wyświetlane obok ikonki; tooltip, nagłówek menu i `aria-label` zachowują się jak w scenariuszu 7.
    - Po uzupełnieniu nazwy w `/auth/complete-profile` i przejściu do aplikacji topbar pokazuje nową nazwę
      bez ręcznego przeładowania strony.

### Scenariusz 10: Zmiana nazwy w Ustawieniach odświeża topbar natychmiast

- **Given**: Użytkownik o nazwie `Kasia_Gotuje` jest na stronie Ustawień; topbar pokazuje `Kasia_Gotuje`.
- **When**: Zmienia nazwę na `Kasia_Kuchnia` i zapisuje profil (`PUT /profile` kończy się sukcesem).
- **Then**:
    - Topbar pokazuje `Kasia_Kuchnia` natychmiast po sukcesie zapisu, bez przeładowania strony
      i bez dodatkowego wywołania `GET /me`.
    - Tooltip, `aria-label` i nagłówek menu używają nowej nazwy.
    - Po pełnym odświeżeniu przeglądarki (F5) nazwa nadal jest nowa (pochodzi z `GET /me`).

### Scenariusz 11: Nieudany zapis nazwy nie zmienia topbara

- **Given**: Użytkownik próbuje zmienić nazwę na już zajętą (`409`) lub zapis kończy się innym błędem (np. `500`).
- **When**: Zapis profilu kończy się błędem.
- **Then**:
    - Topbar nadal pokazuje dotychczasową nazwę.
    - Komunikat błędu jest pokazywany jak dotychczas w formularzu Ustawień.

### Scenariusz 12: Zapis innych ustawień nie zmienia nazwy w topbarze

- **Given**: Użytkownik zmienia w Ustawieniach wyłącznie zgodę marketingową (nazwa niezmieniona).
- **When**: Zapis kończy się sukcesem.
- **Then**: Nazwa w topbarze pozostaje niezmieniona i nie miga (brak chwilowego zniknięcia nazwy).

### Scenariusz 13: Wylogowanie i zmiana konta

- **Given**: Użytkownik A jest zalogowany i jego nazwa jest widoczna w topbarze.
- **When**: Użytkownik A wylogowuje się, a następnie loguje się użytkownik B (lub sesja wygasa i inne konto loguje się w tej samej karcie).
- **Then**:
    - Po wylogowaniu nazwa użytkownika A nie jest już widoczna ani dostępna w stanie aplikacji.
    - Dopóki dane użytkownika B nie zostaną pobrane, topbar nie pokazuje nazwy A
      (zachowanie jak w scenariuszu 7), a po pobraniu pokazuje nazwę B.
    - Spóźniona odpowiedź `GET /me` dla użytkownika A (wyścig) nie nadpisuje nazwy użytkownika B.

### Scenariusz 14: Panel administracyjny

- **Given**: Zalogowany `admin` przebywa w panelu administracyjnym (ten sam topbar).
- **When**: Topbar jest renderowany.
- **Then**:
    - Nazwa jest wyświetlana tak samo jak w głównym layoucie (te same zasady responsywności,
      tooltipu, nagłówka menu).
    - Pozycja „Admin" w menu i nawigacja topbara działają bez zmian.

### Scenariusz 15: Goście i brak regresji poza topbarem

- **Given**: Niezalogowany gość przegląda aplikację w `PublicLayout`.
- **When**: Strona jest renderowana.
- **Then**: Widok gościa jest identyczny jak przed zmianą; żadna nazwa użytkownika nie jest wyświetlana.
- **And**: `WelcomeHeader` na dashboardzie renderuje się bez zmian (w zakresie tekstu i stylu).

---

## Przypadki brzegowe

| # | Przypadek | Oczekiwane zachowanie |
|---|-----------|-----------------------|
| 1 | Nazwa 50 znaków bez spacji (np. szeroki `W`/`M`) | Jedna linia, wielokropek, brak wypychania logo/„Cennik"/hamburgera, brak poziomego przewijania topbara |
| 2 | Nazwa minimalna (3 znaki) | Brak nadmiarowych odstępów; przycisk nie jest szerszy niż potrzeba |
| 3 | Nazwa z polskimi znakami diakrytycznymi i znakami specjalnymi (`Żółć_Łukasz-1`) | Poprawne wyświetlenie bez obcięcia akcentów (poprawna wysokość linii) |
| 4 | Nazwa zawierająca znaki HTML (`<b>x</b>`, `&amp;`) | Wyświetlana jako zwykły tekst (bez interpretacji HTML); dotyczy topbara, tooltipu, `aria-label` i nagłówka menu |
| 5 | Nazwa pusta / `null` / `undefined` / same białe znaki | Traktowana jak brak nazwy: nic nie pokazujemy, `aria-label="Menu użytkownika"` |
| 6 | Nazwa z białymi znakami na początku/końcu | Wyświetlana po przycięciu (`trim`); tooltip i `aria-label` bez podwójnych spacji |
| 7 | Szerokość dokładnie 599 px / 600 px | 599 px — nazwa ukryta; 600 px — nazwa widoczna (zgodnie z granicą XSmall `<600 px`) |
| 8 | Szerokość dokładnie 959 px / 960 px | 959 px — nawigacja główna ukryta, nazwa widoczna z obcięciem; 960 px — nawigacja pojawia się i nie nakłada się na przycisk użytkownika (wąski desktop, długa nazwa) |
| 9 | Wąski desktop (960–1100 px), długa nazwa, link „Cennik", pozycjonowana absolutnie nawigacja główna | Brak nakładania się nawigacji `topbar__center` na przycisk użytkownika i „Cennik"; w razie braku miejsca nazwa jest dalej obcinana |
| 10 | Szerokość <480 px, hamburger + logo + „Cennik" + ikona | Układ nie ulega pogorszeniu względem stanu obecnego (nazwa ukryta) |
| 11 | Powiększenie strony/tekstu (zoom 200%, powiększona czcionka systemowa) | Brak przepełnienia topbara; po przekroczeniu granicy 600 px (efektywnej) zachowanie zgodne z progiem |
| 12 | Zmiana nazwy w jednej karcie, druga karta otwarta | Druga karta pokazuje nową nazwę po najbliższym pobraniu `/me` (np. po przeładowaniu); synchronizacja między kartami nie jest wymagana |
| 13 | Odświeżenie danych `/me` (np. po płatności/subskrypcji) | Nazwa nie znika ani nie miga; jeśli `/me` zwróci inną nazwę niż stan lokalny (zmiana poza tą kartą), stan jest aktualizowany |
| 14 | Nieudane ponowne pobranie `/me` po wcześniejszym sukcesie | Wcześniej znana nazwa **nie jest czyszczona** (błąd nie powoduje zniknięcia nazwy); czyszczenie następuje tylko przy wylogowaniu/zmianie użytkownika |
| 15 | Szybkie wielokrotne zapisy nazwy w Ustawieniach | Topbar odzwierciedla ostatni **zakończony sukcesem** zapis; zapis w toku lub zakończony błędem nie zmienia nazwy |
| 16 | Sesja wygasła (401) podczas pobierania `/me` | Brak nazwy (jak w scenariuszu 8); obsługa wygaśnięcia sesji pozostaje jak dotychczas |
| 17 | Menu użytkownika otwarte na wąskim ekranie z długą nazwą | Nagłówek nie wychodzi poza ekran; pełna nazwa jest czytelna (zawijanie) |
| 18 | Czytnik ekranu | Odczytywane jest `Zalogowano jako {nazwa}` (bez dublowania nazwy: widoczny tekst nie jest odczytywany osobno, jeśli `aria-label` go zawiera); ikona ma `aria-hidden` |
| 19 | Rola `admin` (dodatkowa pozycja menu) | Nagłówek menu pojawia się nad wszystkimi pozycjami, w tym „Admin" |
| 20 | Użytkownik z włączoną preferencją ograniczenia animacji | Brak animacji pojawiania się nazwy (zmiana nazwy jest natychmiastowa, bez efektów) |

---

## Wymagania niefunkcjonalne

- **Wyłącznie frontend** — bez zmian w `supabase/`, migracjach, RLS i `shared/contracts/types.ts`
  (istniejące `MeDto.username` jest wystarczające). Frontend nie odczytuje nazwy bezpośrednio
  z tabel (zgodnie z regułą: dane tylko przez API / Edge Functions).
- **Jedno źródło prawdy** dla nazwy użytkownika w stanie frontendu (sygnał), czytane przez topbar
  i aktualizowane po udanej zmianie w Ustawieniach; czyszczone przy wylogowaniu/zmianie użytkownika;
  odporne na wyścigi odpowiedzi `/me` (zgodnie z obecnym zabezpieczeniem `expectedUserId`).
- **Brak dodatkowych wywołań sieciowych** — nazwa pochodzi z istniejącego wywołania `GET /me`
  wykonywanego podczas inicjalizacji sesji.
- **Dostępność (WCAG 2.1 AA):** kontrast zgodny z motywem Material (zmienne `--mat-sys-*`),
  nazwa dostępna przycisku zawiera widoczną etykietę, obsługa klawiatury, widoczny fokus.
- **Stylowanie i komponenty:** komponenty standalone, `OnPush`, sygnały, nowa składnia sterowania
  przepływem (`@if`), zmienne motywu Material zamiast stałych kolorów, wcięcie 4 znaki.
- **Bez regresji wydajności:** brak dodatkowych subskrypcji RxJS bez zarządzania cyklem życia.

---

## Definicja ukończenia (Definition of Done)

- [ ] Nazwa użytkownika jest widoczna w topbarze po lewej stronie ikonki konta, w jednym przycisku
      z ikoną, zgodnie z breakpointami: ukryta `<600 px`, widoczna z obcięciem `600–959 px`, widoczna na desktopie
- [ ] Nagłówek z nazwą w menu użytkownika (zawsze, gdy nazwa niepusta) — zgodnie z decyzją nr 8
- [ ] Tooltip `Zalogowano jako {nazwa}` oraz `aria-label` tej samej treści; przy braku nazwy `aria-label="Menu użytkownika"`
- [ ] Brak nazwy (ładowanie, błąd, pusta) → wyłącznie ikona, bez tekstu zastępczego
- [ ] Zmiana nazwy w Ustawieniach odświeża topbar natychmiast, bez `GET /me` i przeładowania
- [ ] Stan nazwy czyszczony przy wylogowaniu/zmianie użytkownika; brak nadpisania przez spóźnioną odpowiedź `/me`
- [ ] Brak zmian w API, bazie danych, RLS i kontraktach (`shared/contracts/types.ts` bez zmian)
- [ ] `WelcomeHeader` i `PublicLayout` bez zmian (potwierdzone testami/przeglądem diffu)
- [ ] Testy jednostkowe (Vitest) dodane lub zaktualizowane:
    - `topbar.component.spec.ts` — render nazwy, brak nazwy (null/pusta/białe znaki), tooltip i `aria-label`
      (z nazwą i bez), nagłówek menu po otwarciu, obecność nazwy w DOM niezależnie od szerokości
      (próg ukrycia `<600 px` realizuje CSS i jest weryfikowany wyłącznie ręcznie — jsdom nie testuje media queries),
      klasa obcięcia długiej nazwy, ucieczka znaków HTML, rola `admin`;
    - testy serwisu/stanu przechowującego nazwę — ustawienie z `MeDto`, aktualizacja po zmianie nazwy,
      reset przy wylogowaniu i zmianie użytkownika, ignorowanie spóźnionej odpowiedzi dla poprzedniego użytkownika,
      brak czyszczenia nazwy przy nieudanym ponownym pobraniu `/me`;
    - `auth.service.spec.ts` / spec stanu subskrypcji — przekazanie `username` z `GET /me` do wspólnego stanu
      oraz brak regresji istniejącego zachowania (`applyMe`, kredyty AI);
    - `profile-settings.facade.spec.ts` — udany zapis nazwy aktualizuje wspólny stan, błędy `409`/`500`
      oraz zapis bez zmiany nazwy go nie zmieniają;
    - `CompleteProfilePageComponent` (`/auth/complete-profile`) zapisuje profil przez `ProfileSettingsApiService`
      z pominięciem fasady — wymaga osobnego przekazania nazwy z odpowiedzi `PUT /profile` do wspólnego stanu
      (nowy spec tej strony; scenariusz 9)
- [ ] Weryfikacja manualna na środowisku lokalnym (użytkownik testowy z `.env.local`): szerokości
      <480, 480–599, 600–959, 960–1100, ≥1280 px; nazwa 3 i 50 znaków; konto `user` (z „Cennik") i `admin`;
      zmiana nazwy w Ustawieniach; wylogowanie/logowanie na inne konto; obsługa klawiaturą i czytnik ekranu
- [ ] Lint (`npm run lint`) bez nowych ostrzeżeń i błędów oraz `npm run build` zakończone sukcesem
      (status zapisany jawnie: `PASS`/`FAIL`, nie `NIE_WYKONANO`)
- [ ] Pełny zestaw testów Vitest (`npm run test`) przechodzi (`PASS`)
- [ ] Code review zakończone pozytywnie (artefakt review widoków zapisany zgodnie z `ps-feature-conventions`
      lub jawnie `BEZ_REVIEW` z powodem)
- [ ] `docs/results/project-summary.md` zaktualizowany po akceptacji review (etap summary)

---

## Punkty do potwierdzenia w planie UI

> Rozstrzygnięte w `PS-37-topbar-username-display-ui-plan.md` (runda 1): próg 600 px — CSS media query;
> szerokość nazwy 160 px z `clamp()` na wąskim desktopie (wartości do kalibracji ręcznej);
> `/auth/complete-profile` renderuje ten sam topbar; wspólny stan — nowy `CurrentUserStateService`.
> Statusy weryfikacji pozostają `NIE_WYKONANO` do czasu implementacji.

- Dokładna maksymalna szerokość nazwy w topbarze (w przedziale 160–200 px) i sposób wykrywania granicy
  `<600 px` (CSS media query vs. `BreakpointObserver`), tak aby zachowanie było zgodne z progami 600/960 px
  — status: `WYMAGA_WERYFIKACJI`.
- Czy strona `/auth/complete-profile` renderuje współdzielony topbar (wpływa na scenariusz 9);
  niezależnie od tego nazwa musi być poprawnie widoczna po uzupełnieniu profilu — status: `WYMAGA_WERYFIKACJI`.
- Miejsce przechowywania współdzielonego stanu nazwy (rozszerzenie istniejącego serwisu vs. nowy serwis
  stanu) — decyzja należy do planu implementacji, nie do tej historyjki.

---

## Powiązania

- **Jira:** PS-37 — Wyświetlanie nazwy użytkownika w topbarze
- **Powiązane elementy kodu:**
    - `src/app/layout/main-layout/components/topbar/` — komponent topbara (szablon, style, testy)
    - `src/app/core/services/auth.service.ts` — inicjalizacja sesji i wywołanie `GET /me`
    - `src/app/core/services/subscription-state.service.ts` — dotychczasowe mapowanie `MeDto` (pomija `username`)
    - `src/app/core/services/me-api.service.ts` — `getMe()`
    - `src/app/pages/settings/services/profile-settings.facade.ts` — zapis profilu / zmiana nazwy
    - `src/app/pages/auth/complete-profile/` — uzupełnianie nazwy po OAuth
- **Kontrakty (bez zmian):** `MeDto.username` w `shared/contracts/types.ts`
- **Poza zakresem:** `WelcomeHeader` (dashboard), `PublicLayout`
