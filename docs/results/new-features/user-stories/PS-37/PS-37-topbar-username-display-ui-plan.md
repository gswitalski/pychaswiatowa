# PS-37: Wyświetlanie nazwy użytkownika w topbarze — Plan UI

> **User Story:** `PS-37-topbar-username-display-user-story.md`
> **Plan API:** `PS-37-topbar-username-display-api-plan.md`
> **Data:** listopad 2026
> **Runda planowania:** 1
> **Zakres:** `TopbarComponent` + wspólny stan nazwy; brak nowych tras

---

## 1. Rozstrzygnięcia punktów `WYMAGA_WERYFIKACJI`

| # | Punkt z historyjki | Rozstrzygnięcie | Dowód w kodzie | Status |
|---|---|---|---|---|
| 1 | Czy `/auth/complete-profile` renderuje ten sam topbar? | **TAK** (dla zalogowanego). Trasa leży w grupie `MainLayoutComponent` z `authenticatedMatchGuard` i `oauthCompleteProfileGuard`; `MainLayout` zawsze renderuje `pych-topbar`. Dla gościa trasa w `PublicLayout` jest tylko `redirectTo: '/login'`. Topbar na tej stronie ma `displayName === null` ⇒ sama ikona (scenariusz 9). Po zapisie nawigacja do `/dashboard` zostaje **w tym samym `MainLayout`** (topbar nie jest odtwarzany), więc nazwa musi być wpisana do stanu **przed** nawigacją. | `app.routes.ts`: `MainLayoutComponent` (L40), `auth/complete-profile` (L233), `PublicLayoutComponent` (L267), redirect gościa (L435); `main-layout.component.html` | `PASS` (analiza kodu) |
| 2 | Maksymalna szerokość nazwy (160–200 px) | **160 px** (dolna granica przedziału) + zmienna CSS `--topbar-username-max-width`; na desktopie 960–~1071 px **dynamicznie zmniejszana** przez `clamp()` (patrz 4.3). Uzasadnienie: najciaśniejszy układ ≥600 px to hamburger + logo „PychaŚwiatowa" + „Cennik" + przycisk (≈220 px wolnego miejsca na przycisk przy 600 px) oraz absolutnie pozycjonowana nawigacja `topbar__center` przy 960 px, która nie uczestniczy w układzie flex. | `topbar.component.scss` (`&__center` `position: absolute; left: 50%`), `main-navigation.component.scss` (`min-width: 100px` na link), `topbar.component.html` | `PASS` (decyzja); **wartości liczbowe do kalibracji ręcznej** (`NIE_WYKONANO`) |
| 3 | CSS vs `BreakpointObserver` dla progu 600 px | **Czysty CSS** (`@media (max-width: 599.98px)` ⇒ `display: none` na nazwie). Powody: (a) zmiana czysto prezentacyjna; (b) brak subskrypcji/sygnału i brak „mignięcia" przy pierwszym renderze (sygnały `LayoutService` mają `initialValue: false`); (c) `LayoutService` nie ma progu 600 px (`isMobile` = XSmall+Small <960 px), dodawanie nowego sygnału tylko do ukrycia tekstu to nadmiar; (d) spójne z istniejącymi `@media` w topbarze; (e) `599.98px` = granica XSmall w Material (599 ukryta / 600 widoczna — przypadek 7). | `layout.service.ts`, `topbar.component.scss` | `PASS` (decyzja) |
| 4 | Miejsce wspólnego stanu nazwy | **Nowy `CurrentUserStateService`** (`core/services`) — uzasadnienie i kontrakt w planie API, sekcja 4. | `auth.service.ts`, `subscription-state.service.ts` | `PASS` (decyzja) |
| 5 | Odświeżanie po `ProfileSettingsFacade.saveProfile()` | `next` ⇒ `currentUserState.applyProfile(profile)` (nazwa z **odpowiedzi** serwera, już po `trim`); `error` ⇒ brak wywołania. Dodatkowo `CompleteProfilePageComponent` (zapisuje z pominięciem fasady). | `profile-settings.facade.ts`, `complete-profile-page.component.ts` (L70–78) | `PASS` (decyzja) |
| 6 | Wyścigi przy zmianie użytkownika | `switchUser(userId)` w `AuthService.updateAuthState` + porównanie `dto.id` z aktywnym użytkownikiem w `applyMe`/`applyProfile` (+ istniejący `expectedUserId`). | `auth.service.ts` (`updateAuthState`, `bootstrapAiCredits`) | `PASS` (decyzja) |
| 7 | Brak czyszczenia przy nieudanym `/me` | Brak ścieżki „błąd ⇒ czyść"; `catch` w `AuthService`, `SubscriptionStateService` bez zmian i bez dotykania stanu nazwy. | j.w. | `PASS` (decyzja) |

---

## 2. Zakres zmian w plikach

| Plik | Zmiana |
|---|---|
| `src/app/core/services/current-user-state.service.ts` | **NOWY** — stan nazwy (kontrakt: plan API, 4.2) |
| `src/app/core/services/current-user-state.service.spec.ts` | **NOWY** |
| `src/app/core/services/auth.service.ts` (+ `.spec.ts`) | `switchUser`, `applyMe` (punkty 1–2 planu API) |
| `src/app/core/services/subscription-state.service.ts` (+ `.spec.ts`) | forward `applyMe` w gałęzi sukcesu `ensureLoaded`/`refresh` |
| `src/app/pages/settings/services/profile-settings.facade.ts` (+ `.spec.ts`) | `applyProfile` w `next` |
| `src/app/pages/auth/complete-profile/complete-profile-page.component.ts` | zachować odpowiedź PUT, `applyProfile` przed `markComplete()` |
| `src/app/pages/auth/complete-profile/complete-profile-page.component.spec.ts` | **NOWY** (dziś brak specu strony) |
| `src/app/layout/main-layout/components/topbar/topbar.component.{ts,html,scss,spec.ts}` | przycisk użytkownika, nagłówek menu, style, testy |

**Bez zmian:** `WelcomeHeader`, `PublicLayout`, `MainLayout`, `LayoutService`, `app.routes.ts`, `shared/contracts/**`,
`supabase/**`. **Routing:** brak nowych ani zmienionych tras. `README`/struktura katalogów: bez zmian
(nowy plik w istniejącym `core/services/`).

---

## 3. `CurrentUserStateService` (UI/stan)

Szczegóły publicznego API: plan API, sekcja 4.2. Wymagania implementacyjne:

- standalone `@Injectable({ providedIn: 'root' })`, **sygnały** (`signal`, `computed`, `asReadonly()`),
  brak RxJS, brak subskrypcji (wymaganie „bez dodatkowych subskrypcji bez cyklu życia"),
- `displayName = computed(() => this.usernameState()?.trim() || null)`,
- identyczna wartość ⇒ `signal.set` nie wywołuje ponownego renderu (brak migania — scenariusz 12),
- wcięcie 4 spacje, wczesne `return` dla warunków ochronnych (`dto.id !== activeUserId`, `typeof username !== 'string'`).

---

## 4. `TopbarComponent`

### 4.1 Logika (`topbar.component.ts`)

- `private readonly currentUserState = inject(CurrentUserStateService);`
- `readonly displayName = this.currentUserState.displayName;`
- `readonly userButtonLabel = computed(() => { const n = this.displayName(); return n ? \`Zalogowano jako ${n}\` : 'Menu użytkownika'; })`
- `readonly userTooltip = computed(() => { const n = this.displayName(); return n ? \`Zalogowano jako ${n}\` : ''; })`
- Dodać `MatTooltipModule`, `MatDividerModule` do `imports`. `OnPush` zostaje (zmiany idą przez sygnały).

### 4.2 Szablon (`topbar.component.html`) — sekcja `topbar__right`

Jeden element przycisku (bez przełączania gałęzi `@if`/`@else` na całym przycisku, żeby nie odtwarzać
elementu i nie gubić fokusu, gdy nazwa pojawia się po `/me`):

```html
<button
    mat-icon-button
    type="button"
    class="topbar__avatar topbar__user-button"
    [class.topbar__user-button--named]="displayName() !== null"
    [matMenuTriggerFor]="userMenu"
    [attr.aria-label]="userButtonLabel()"
    [matTooltip]="userTooltip()"
    [matTooltipDisabled]="displayName() === null"
>
    @if (displayName(); as name) {
        <span class="topbar__username" aria-hidden="true">{{ name }}</span>
    }
    <mat-icon aria-hidden="true">account_circle</mat-icon>
</button>
```

Menu użytkownika (`mat-menu #userMenu`, `xPosition="before"` bez zmian) — nagłówek **przed** istniejącymi pozycjami:

```html
@if (displayName(); as name) {
    <div class="topbar__menu-header" role="presentation">
        Zalogowano jako <span class="topbar__menu-username">{{ name }}</span>
    </div>
    <mat-divider></mat-divider>
}
<a mat-menu-item routerLink="/settings">…</a>   <!-- bez zmian -->
```

Uzasadnienia/ograniczenia:

- Nazwa wyłącznie przez interpolację `{{ }}` i `[attr.aria-label]` ⇒ HTML w nazwie jest tekstem (przypadek 4).
- Tekst nazwy jest `aria-hidden`, bo nazwę dostępną daje `aria-label`; **widoczny tekst jest zawarty w nazwie dostępnej**
  (WCAG 2.5.3 „Label in Name"). Treść `aria-label` i tooltipu jest **identyczna** — CDK `AriaDescriber` nie dodaje
  wtedy `aria-describedby`, więc czytnik nie dubluje komunikatu (przypadek 18).
- `matMenuTriggerFor` nadal dostarcza `aria-haspopup`/`aria-expanded`/Enter/Spacja/Esc (scenariusz 2).
- Nagłówek nie jest `mat-menu-item` ⇒ nie wchodzi do `FocusKeyManager` menu, nie zmienia kolejności fokusu
  (Ustawienia → Admin → Wyloguj); `role="presentation"` + brak `tabindex`. Tekst pozostaje w DOM (czytnik w trybie
  przeglądania). Decyzja a11y do potwierdzenia ręcznie czytnikiem (sekcja 8).
- Pozycje menu, kolejność, `isAdmin()` — **bez zmian** (przypadek 19: nagłówek jest nad „Admin").
- Brak animacji dodawanych przez PS-37 (żadnych `transition`/`animation` na nazwie) ⇒ przypadek 20 spełniony
  z definicji; animacje menu/tooltipu pochodzą z Material i respektują ustawienia platformy.
- Przycisk bez nazwy to dokładnie dzisiejszy `mat-icon-button` (klasa `--named` nieaktywna, `aria-label="Menu użytkownika"`,
  brak tooltipu) — scenariusze 7, 8, 9.

### 4.3 Style (`topbar.component.scss`)

Zasady: zmienne motywu `--mat-sys-*`, wcięcie 4 spacje, bez stałych kolorów.

1. **Zmienna:** w `.topbar` — `--topbar-username-max-width: 160px;`
2. **Desktop (≥960 px, zgodnie z `isMobileOrTablet` = `<959.99px`):**
   `@media (min-width: 960px) { .topbar { --topbar-username-max-width: clamp(96px, calc(50vw - 376px), 160px); } }`
   Uzasadnienie: nawigacja `topbar__center` jest centrowana absolutnie i nie „oddaje" miejsca. Szacunek:
   nawigacja ≈ 400 px (3 linki ≥100 px + gap), „Cennik" ≈ 88 px, „chrome" przycisku (ikona + paddingi + gap) ≈ 64 px ⇒
   maks. szerokość nazwy ≈ `50vw − 376px` (96 px przy 960 → 160 px przy ≥1072 px). Dla roli `admin`
   (4 pozycje nawigacji, ale brak „Cennik") budżet jest niemniej korzystny. **Stałe 376/96 to estymacja — implementer
   mierzy realną szerokość `.topbar__center` (DevTools) przy 960/1024/1100 px dla ról `user` i `admin` i koryguje.**
3. **Układ elastyczny (<960 px i jako siatka bezpieczeństwa):**
   - `&__right { min-width: 0; flex-shrink: 1; }` (dziś `flex-shrink: 0` ⇒ długa nazwa wypychałaby `left`),
   - `&__left` i `&__pricing-link` zostają `flex-shrink: 0` (logo, hamburger, „Cennik" nigdy nie są wypychane/skracane),
   - `&__user-button { min-width: 0; max-width: 100%; }`.
4. **Tryb „z nazwą" — tylko ≥600 px:**
   ```scss
   @media (min-width: 600px) {
       .topbar__user-button--named {
           /* nadpisanie zmiennych rozmiaru mat-icon-button: szerokość auto, wysokość >= 40 px */
           width: auto;
           min-width: 48px;
           padding-inline: 12px 8px;
           border-radius: 24px;
           display: inline-flex;
           align-items: center;
           gap: 8px;
       }
   }
   ```
   Poniżej 600 px klasa `--named` nie ma żadnego efektu ⇒ przycisk jest **identyczny z dzisiejszym** (scenariusz 3, przypadek 10).
   Implementer sprawdza kształt warstwy stanu (ripple/focus) po zmianie `border-radius` i dobiera właściwą zmienną
   `--mat-icon-button-*` dla Material 21 (jeśli nadpisanie okaże się kruche — dopuszczalne `mat-button` z modyfikatorem
   `--icon-only`, ale **zachowując jeden element** i identyczny wygląd stanu bez nazwy).
5. **Nazwa:**
   ```scss
   &__username {
       display: block;
       min-width: 0;
       max-width: var(--topbar-username-max-width);
       overflow: hidden;
       text-overflow: ellipsis;
       white-space: nowrap;
       line-height: 1.5;            /* diakrytyki (Żółć_Łukasz-1) nie mogą być przycięte przez overflow */
       color: var(--mat-sys-on-surface);
       font: var(--mat-sys-label-large);
   }
   @media (max-width: 599.98px) { .topbar__username { display: none; } }
   ```
6. **Nagłówek menu:**
   ```scss
   &__menu-header {
       max-width: min(280px, calc(100vw - 32px));
       padding: 12px 16px;
       white-space: normal;          /* zawijanie zamiast poszerzania menu (przypadek 17) */
       overflow-wrap: anywhere;      /* 50 znaków bez spacji */
       color: var(--mat-sys-on-surface-variant);
       font: var(--mat-sys-body-medium);
   }
   &__menu-username { color: var(--mat-sys-on-surface); font-weight: 600; }
   ```
7. Wysokość przycisku ≥40 px (cel dotykowy — scenariusz 2); widoczny focus zapewnia Material (`mat-icon-button`) —
   do potwierdzenia ręcznie po zmianie `border-radius`.
8. Zmiana nie dotyka istniejących `@media (max-width: 960px)` / `480px` (uwaga: patrz niespójność N5).

---

## 5. Pozostałe widoki

### 5.1 `CompleteProfilePageComponent`

W `handleSave`: `const profile = await firstValueFrom(this.profileSettingsApi.updateProfileSettings({...}));`
→ `this.currentUserState.applyProfile(profile);` → `this.profileCompletion.markComplete();` → nawigacja.
Gałąź błędu (409/401/inne) bez zmian i **bez** zmiany stanu nazwy.

### 5.2 `ProfileSettingsFacade.saveProfile`

W `next`: po `this.profile.set(...)` → `this.currentUserState.applyProfile(profile)`. Fasada jest `@Injectable()`
(zakres komponentu), a serwis `root` ⇒ zwykłe `inject`. Blokada równoległych zapisów (`isSavingProfile`) już istnieje ⇒
przypadek 15 spełniony (topbar odzwierciedla ostatni **udany** zapis).

### 5.3 `AdminLayout` / panel administracyjny

Trasa `admin` leży w grupie `MainLayoutComponent` (`app.routes.ts` L190); `AdminLayoutComponent` **nie** renderuje
własnego topbara. Scenariusz 14 jest pokryty tym samym komponentem — bez osobnej pracy (patrz niespójność N3).

---

## 6. Stany UI

| Stan | `displayName` | Przycisk | Tooltip | `aria-label` | Nagłówek menu |
|---|---|---|---|---|---|
| Ładowanie `/me` | `null` | ikona | brak | `Menu użytkownika` | brak |
| Błąd `/me` (bez wcześniejszej nazwy) | `null` | ikona | brak | `Menu użytkownika` | brak |
| Pusta / białe znaki / OAuth przed uzupełnieniem | `null` | ikona | brak | `Menu użytkownika` | brak |
| Nazwa znana, ≥600 px | `"X"` | nazwa + ikona, wielokropek | `Zalogowano jako X` | `Zalogowano jako X` | `Zalogowano jako X` + separator |
| Nazwa znana, <600 px | `"X"` | tylko ikona (nazwa `display: none`) | j.w. | j.w. | j.w. |
| Nieudane ponowne `/me` po sukcesie | bez zmian | bez zmian | bez zmian | bez zmian | bez zmian |
| Wylogowanie / zmiana konta | `null` do czasu `/me` nowego użytkownika | ikona | brak | `Menu użytkownika` | brak |

Brak szkieletów, placeholderów, tekstu zastępczego i komunikatów błędów w topbarze.

---

## 7. Testy (Vitest)

Zasady z `vitest.mdc`: import `zone.js`/`zone.js/testing`, `initTestEnvironment` w `beforeAll`, `NoopAnimationsModule`
dla Material, natywne asercje (`toBeTruthy`, `getAttribute`, `classList.contains`), `provideRouter([])` zamiast
częściowego mocka `Router` przy renderowaniu `RouterLink`.

### 7.1 `current-user-state.service.spec.ts`
- `applyMe` po `switchUser(id)` ustawia `username`/`displayName`; trim (`'  Jan  '` → `'Jan'`);
- `''`, `'   '` ⇒ `displayName === null`; `null`/`undefined` username ⇒ ignorowane (poprzednia wartość zostaje);
- `applyProfile` aktualizuje nazwę;
- `switchUser(null)` i `switchUser('B')` po `A` czyszczą nazwę; `switchUser('A')` ponownie dla A — **no-op** (nazwa zostaje);
- `applyMe`/`applyProfile` z `id` innym niż aktywny (spóźniona odpowiedź A po przełączeniu na B) ⇒ ignorowane;
- `applyMe` bez wcześniejszego `switchUser` ⇒ ignorowane;
- brak metody czyszczącej na błąd (nazwa przetrwa serię wywołań bez `applyMe`).

### 7.2 `topbar.component.spec.ts` (render — `createComponent`, `setInput('shouldShowSidebar', …)`)
- zachować istniejące 2 testy (`mainNavItems`);
- nazwa `Kasia_Gotuje` ⇒ `.topbar__username` w DOM z tym tekstem, w tym samym `<button>` co ikona, **przed** `mat-icon`;
- `aria-label` = `Zalogowano jako Kasia_Gotuje`; tekst nazwy zawarty w `aria-label`; `aria-hidden` na spanie i ikonie;
- tooltip: po `mouseenter`/focus wiadomość `Zalogowano jako …` (pełna, nieobcięta nazwa), brak tooltipu przy `null`;
- `null`, `''`, `'   '` ⇒ brak `.topbar__username`, `aria-label="Menu użytkownika"`, brak klasy `--named`;
- `trim` ⇒ `aria-label` bez podwójnych spacji;
- nazwa `<b>x</b>` / `&amp;` ⇒ `textContent` dosłowny, brak elementu `<b>` w przycisku;
- 50-znakowa nazwa ⇒ pełna wartość w DOM i `aria-label` (obcięcie realizuje CSS — klasa `topbar__username` obecna);
- otwarcie menu (klik) ⇒ `.topbar__menu-header` z `Zalogowano jako …` i `mat-divider` nad pierwszym `mat-menu-item`;
  nagłówek nie jest `mat-menu-item`, kolejność pozycji bez zmian; brak nagłówka dla `null`;
- rola `admin` ⇒ nagłówek + pozycja „Admin" (nagłówek pierwszy);
- aktualizacja sygnału (`applyMe`/`applyProfile`) ⇒ po `detectChanges` nowa nazwa (bez przeładowania);
- `logout()` bez regresji.
- **Ukrycie `<600 px` nie jest testowalne w jsdom** (brak ewaluacji `@media` w `getComputedStyle`). W miejsce
  „mock `BreakpointObserver`/`LayoutService`" z DoD: test, że span jest zawsze w DOM i ma klasę `topbar__username`,
  a próg weryfikowany ręcznie (sekcja 8) — patrz niespójność N1.

### 7.3 `auth.service.spec.ts`
- po `updateAuthState` z sesją: `currentUserState.switchUser(userId)`; bez sesji: `switchUser(null)`;
- `bootstrapAiCredits` sukces ⇒ `currentUserState.applyMe(me)` oraz dotychczasowe `subscriptionState.applyMe(me)`/kredyty AI;
- `getMe` błąd ⇒ `applyMe` nie wywołane, błąd logowany jak dotychczas;
- spóźniona odpowiedź (zmiana `userId` w trakcie) ⇒ `applyMe` nie wywołane;
- `TOKEN_REFRESHED` tego samego użytkownika ⇒ nazwa nie jest czyszczona.

### 7.4 `subscription-state.service.spec.ts`
- `refresh`/`ensureLoaded` sukces ⇒ forward `applyMe`; błąd ⇒ brak forwardu; zmiana generacji (`reset`) ⇒ brak forwardu;
- `mapMeToSnapshot`/`applyMe` subskrypcji — bez regresji.

### 7.5 `profile-settings.facade.spec.ts`
- sukces zapisu zmienionej nazwy ⇒ `applyProfile` z odpowiedzią; 409 i 500 ⇒ **brak** `applyProfile`;
- zapis tylko zgody marketingowej (ta sama nazwa) ⇒ `displayName` bez zmiany i bez przejścia przez `null`;
- zapis w toku (`isSavingProfile`) ⇒ drugi zapis ignorowany, brak podwójnego `applyProfile`.

### 7.6 `complete-profile-page.component.spec.ts` (NOWY)
- sukces `handleSave` ⇒ `applyProfile` wywołane **przed** `markComplete`/nawigacją (kolejność);
- 409 / 401 / inny błąd ⇒ brak `applyProfile`, obsługa błędów jak dotąd.

### 7.7 Brak regresji (scenariusz 15)
- `WelcomeHeader`/`PublicLayout` — bez zmian w plikach; potwierdzenie przeglądem diffu (`git diff --stat`
  nie zawiera tych ścieżek) oraz istniejącymi specami.

---

## 8. Weryfikacja manualna (wszystko `NIE_WYKONANO` do czasu implementacji)

Dane testowe: użytkownik `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` z `.env.local` (nie zapisywać w repo).

| Obszar | Kroki | Status |
|---|---|---|
| Szerokości | 479, 480–599, 599/600, 600–959, 959/960, 960–1100, ≥1280 px | `NIE_WYKONANO` |
| Długość nazwy | 3 znaki, 50 znaków bez spacji (`WWWW…`), `Żółć_Łukasz-1`, `<b>x</b>` | `NIE_WYKONANO` |
| Role | `user` (z „Cennik"), `premium`, `admin` (pozycja „Admin", `/admin/dashboard`) | `NIE_WYKONANO` |
| Kolizje | 960–1100 px, długa nazwa, rola `user`: `topbar__center` nie nachodzi na „Cennik"/przycisk (kalibracja stałych z 4.3) | `NIE_WYKONANO` |
| Zmiana nazwy | Ustawienia: zmiana ⇒ natychmiast; 409 ⇒ bez zmian; F5 ⇒ nowa nazwa; sama zgoda ⇒ brak migania | `NIE_WYKONANO` |
| Konto OAuth | brak nazwy ⇒ ikona; po uzupełnieniu ⇒ nazwa w topbarze po przejściu do `/dashboard` | `NIE_WYKONANO` |
| Wyloguj/zaloguj | A → B: brak nazwy A; po `/me` nazwa B | `NIE_WYKONANO` |
| Dostępność | Tab/Enter/Spacja/Esc, widoczny focus, cel ≥40 px, czytnik (jedno odczytanie „Zalogowano jako …", nagłówek menu), zoom 200% | `NIE_WYKONANO` |
| Błąd `/me` | zablokowanie żądania `me` (DevTools) ⇒ ikona, bez toastów | `NIE_WYKONANO` |
| Lint / build / testy | `npm run lint`, `npm run build`, `npm run test:run` | `NIE_WYKONANO` |

---

## 9. Macierz spójności: scenariusz GWT → API → UI → test

| Sc. | Zachowanie | API / stan | UI | Test |
|---|---|---|---|---|
| 1 | Nazwa w jednym przycisku obok ikony (desktop) | `GET /me` → `applyMe` → `displayName` | 4.2: span przed `mat-icon`, jeden `<button>`; 4.3 (1,2,5) | 7.2 (render, kolejność, jeden przycisk), manual: szerokości ≥960, „Cennik" bez nakładania |
| 2 | Tooltip, `aria-label`, semantyka menu, focus, ≥40 px | j.w. | 4.2 `[attr.aria-label]`, `matTooltip`, `matMenuTriggerFor`; 4.3 (7) | 7.2 (aria, tooltip), manual: klawiatura, focus, dotyk |
| 3 | <600 px: tylko ikona, `aria-label` z nazwą | — | 4.3 (4,5): `@media (max-width: 599.98px)` + `--named` tylko ≥600 | 7.2 (DOM + aria-label; ukrycie CSS — **manual**) |
| 4 | 600–959 px: nazwa z wielokropkiem, elementy nie wypychane | — | 4.3 (3,4,5): `flex-shrink`, `min-width: 0`, ellipsis | manual (600/768/959 px); 7.2 (klasa) |
| 5 | 50 znaków: wielokropek ≤160 px, pełna nazwa w tooltipie i nagłówku | — | 4.3 (1,2,5), 4.2 (nagłówek wraps) | 7.2 (pełna nazwa w DOM/aria/tooltip/nagłówek), manual: ucinanie |
| 6 | Nagłówek menu, nie klikalny, kolejność fokusu bez zmian | — | 4.2 (nagłówek + `mat-divider`, nie `mat-menu-item`) | 7.2 (otwarcie menu, kolejność `mat-menu-item`) |
| 7 | Ładowanie `/me`: sama ikona | `displayName === null` | 6 | 7.1, 7.2 (`null`) |
| 8 | Błąd `/me`: sama ikona, bez toastów | brak zmiany stanu w `catch` | 6 | 7.3 (błąd ⇒ brak `applyMe`), 7.2, manual: blokada żądania |
| 9 | Pusta nazwa (OAuth); po uzupełnieniu nazwa widoczna | `''` ⇒ `null`; `PUT /profile` ⇒ `applyProfile` | 5.1, 1 (pkt 1: topbar widoczny na stronie) | 7.1, 7.2 (`''`, białe znaki), 7.6, manual: OAuth |
| 10 | Zmiana nazwy w Ustawieniach natychmiast, bez `GET /me` | `PUT /profile` → `applyProfile`; brak `GET /me` | 5.2 | 7.5 (sukces ⇒ `applyProfile`, brak `getMe`), 7.2 (aktualizacja sygnału), manual: F5 |
| 11 | Nieudany zapis nie zmienia topbara | 409/5xx ⇒ brak `applyProfile` | 5.2 (`error` bez zmian) | 7.5 (409, 500) |
| 12 | Zapis innych ustawień nie zmienia/nie miga | ta sama wartość ⇒ sygnał bez zmiany | 3 (identyczna wartość) | 7.5 (zgoda marketingowa), 7.1 |
| 13 | Wylogowanie/zmiana konta; wyścig `/me` | `switchUser(null/B)`; `me.id !== aktywny` ⇒ ignoruj | 6 (stan po wylogowaniu) | 7.1, 7.3 (zmiana `userId`, `TOKEN_REFRESHED`), manual |
| 14 | Panel administracyjny — ten sam topbar | j.w. | 5.3 (`admin` w `MainLayout`) | 7.2 (rola `admin`), manual: `/admin/dashboard` |
| 15 | Goście i `WelcomeHeader` bez zmian | — | brak edycji `PublicLayout`/`WelcomeHeader` | 7.7 (diff + istniejące specy) |

Przypadki brzegowe (skrót): 1,5 → 4.3 + 7.2; 2 → 4.3(4); 3 → 4.3(5) `line-height`; 4 → 4.2/7.2; 6 → 7.1/7.2;
7,8,9,10 → 4.3 + manual; 11 → manual; 12 → brak wymagania; 13 → plan API 4.3 pkt 3 + 7.4; 14 → 7.1;
15 → 5.2; 16 → 7.3; 17 → 4.3(6); 18 → 4.2; 19 → 7.2; 20 → 4.2.

---

## 10. Niespójności i uwagi (do decyzji / korekty historyjki)

| # | Dotyczy | Opis | Wpływ | Propozycja |
|---|---|---|---|---|
| N1 | DoD: testy `<600 px` przez „mock `BreakpointObserver`/`LayoutService`" | Rozstrzygnięto CSS (pkt 3), więc ukrycia nie da się testować mockiem w jsdom | Treść DoD niewykonalna dosłownie | Zamienić w DoD na: „span zawsze w DOM + weryfikacja ręczna progu 599/600 px" (zachowanie bez zmian) |
| N2 | Sc. 9 / „Powiązane kody" / DoD | Strona uzupełniania profilu zapisuje z pominięciem `ProfileSettingsFacade`; DoD nie ma testu tej strony (specu brak) | Bez hooka sc. 9 byłby niespełniony | Plan dodaje hook + nowy spec; dopisać do DoD |
| N3 | „Kontekst": „topbar używa MainLayout oraz panel administracyjny" | Panel `/admin` jest trasą wewnątrz `MainLayout`; osobnego topbara nie ma | Brak (sc. 14 pokryty) | Doprecyzować sformułowanie |
| N4 | Sc. 10/11: „`PUT`/`PATCH`" | Istnieje tylko `PUT /profile` | Brak | Poprawić brzmienie na `PUT` |
| N5 | Przypadek 8 (959/960 px) | Istniejący SCSS używa `max-width: 960px` (włącznie z 960), a `LayoutService.isMobileOrTablet` — `<959.99px`; przy dokładnie 960 px działają style „mobile" (wys. 56 px) i jednocześnie widoczna nawigacja główna | Błąd preexistujący, nie wprowadzany przez PS-37; plan używa `min-width: 960px` dla reguły desktopowej, spójnie z TS | Poza zakresem; ewentualne osobne zgłoszenie |
| N6 | Nagłówek menu — dostępność | `role="presentation"` w `role="menu"` to kompromis (Material nie ma „section title" w menu) | Ryzyko drobnej niezgodności z narzędziami a11y | Potwierdzić czytnikiem i `axe` ręcznie (sekcja 8) |
| N7 | Szerokości liczbowe (4.3) | Wartości 160/96/376 oparte o estymację szerokości nawigacji i „Cennik" | Możliwa korekta po pomiarze | Kalibracja w implementacji; wynik zapisać w review widoków |
| N8 | Wyścig tego samego użytkownika (stary `/me` po `PUT /profile`) | Niezaadresowany w historyjce | Znikome (patrz plan API 7.3) | Akceptacja ryzyka; brak liczników wersji |

Żadna z niespójności nie dotyczy uprawnień, metody HTTP w sensie behawioralnym, routingu ani zasadniczego
zachowania UI, więc **nie blokuje** zapisu planów; N1, N2 i N4 wymagają jednak korekty historyjki przed
akceptacją planów implementacji.
