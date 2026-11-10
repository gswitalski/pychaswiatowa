# Plan implementacji widoku — Nazwa użytkownika w topbarze (PS-37)

> **User Story:** `docs/results/new-features/user-stories/PS-37/PS-37-topbar-username-display-user-story.md`
> **Plan UI:** `PS-37-topbar-username-display-ui-plan.md` · **Plan API:** `PS-37-topbar-username-display-api-plan.md` · **Plan wdrożenia:** `PS-37-topbar-username-display-deployment-plan.md`
> **Runda planowania:** 1 · **Data:** listopad 2026
> **Zakres:** wyłącznie frontend. Brak zmian w `supabase/**`, `shared/contracts/**`, `app.routes.ts`.

---

## 1. Przegląd

Nie powstaje nowy ekran ani nowa trasa. Zmiana to:

1. nowy współdzielony stan frontendowy `CurrentUserStateService` (jedno źródło prawdy dla nazwy),
2. zasilenie go z czterech istniejących miejsc (bootstrap `GET /me`, odświeżenie `/me` w `SubscriptionStateService`, zapis profilu w Ustawieniach, zapis profilu na `/auth/complete-profile`),
3. rozbudowa `TopbarComponent`: nazwa + ikona w **jednym** przycisku, tooltip, `aria-label`, nagłówek menu użytkownika, responsywność CSS (próg 600 px, obcięcie wielokropkiem, `clamp()` na wąskim desktopie),
4. testy Vitest dla każdego zmienionego elementu.

Weryfikacja stanu kodu (2026-11-10, repo w stanie sprzed implementacji):

| Fakt | Dowód |
|---|---|
| `MeDto` i `ProfileSettingsDto` mają `id` + `username` | `shared/contracts/types.ts` (L560, L723) |
| `AuthService.updateAuthState` jest jedynym miejscem zmiany użytkownika; `userChanged` liczone przed `userId.set` | `auth.service.ts` L240–277 |
| `bootstrapAiCredits` ma guard `userId() !== expectedUserId` i wywołuje `subscriptionState.applyMe(me)` | `auth.service.ts` L279–291 |
| `SubscriptionStateService.applyMe` mapuje `MeDto` na snapshot bez `username`; `ensureLoaded`/`refresh` wołają `this.applyMe(me)` w gałęzi sukcesu pod guardem `generation` | `subscription-state.service.ts` L35–101 |
| `ProfileSettingsFacade` jest `@Injectable()` (zakres komponentu); `saveProfile` ma blokadę `isSavingProfile` i `next`/`error` | `profile-settings.facade.ts` L67–90 |
| `CompleteProfilePageComponent.handleSave` odrzuca odpowiedź `PUT /profile` (`await firstValueFrom(...)` bez przypisania) | `complete-profile-page.component.ts` L69–76 |
| `GET /profile` jest wołane też w `ProfileCompletionService`, `auth-callback`, `dashboard/profile.service` — **nie** zasilają stanu nazwy (świadoma decyzja, patrz 12.3) | grep `getProfileSettings` |
| `.mat-mdc-icon-button` w Material 21.0.2 ma `width/height: var(--mat-icon-button-state-layer-size, 40px)`, `flex-shrink: 0`, `border-radius: var(--mat-icon-button-container-shape, …)`, `font-size: var(--mat-icon-button-icon-size, 24px)` | `node_modules/@angular/material/fesm2022/_icon-button-chunk.mjs` |
| `MAIN_NAVIGATION_ITEMS` ma 3 pozycje (admin: 4); link nawigacji `min-width: 100px` | `ui.models.ts` L42–63, `main-navigation.component.scss` |

---

## 2. Routing

**Bez zmian** (żadnych nowych ani zmienionych tras, guardów, resolverów).

| Widok | Trasa | Topbar | Uwaga |
|---|---|---|---|
| Wszystkie strony prywatne | grupa `MainLayoutComponent` | `pych-topbar` renderowany zawsze | nazwa widoczna według reguł z sekcji 6 |
| Panel administracyjny | `/admin/**` (w `MainLayoutComponent`) | ten sam topbar | scenariusz 14 bez osobnej pracy |
| `/auth/complete-profile` | grupa `MainLayoutComponent` (`authenticatedMatchGuard`, `oauthCompleteProfileGuard`) | ten sam topbar, `displayName === null` ⇒ sama ikona | po zapisie nawigacja zostaje w tym samym `MainLayout` (topbar nie jest odtwarzany) ⇒ nazwa musi trafić do stanu **przed** nawigacją |
| `PublicLayout` (gość) | — | brak topbara | bez zmian, `WelcomeHeader` bez zmian |

Sekcja „Project Structure" w `.cursor/rules/project.mdc` **nie wymaga aktualizacji** (nowy plik w istniejącym `core/services/`).

---

## 3. Lista plików

| # | Plik | Akcja | Zawartość zmiany |
|---|---|---|---|
| 1 | `src/app/core/services/current-user-state.service.ts` | **NOWY** | stan nazwy (sekcja 4.1) |
| 2 | `src/app/core/services/current-user-state.service.spec.ts` | **NOWY** | sekcja 8.1 |
| 3 | `src/app/core/services/auth.service.ts` | zmiana | `inject(CurrentUserStateService)`, `switchUser` w `updateAuthState`, `applyMe` w `bootstrapAiCredits` (4.2) |
| 4 | `src/app/core/services/auth.service.spec.ts` | zmiana | sekcja 8.2 |
| 5 | `src/app/core/services/subscription-state.service.ts` | zmiana | forward `currentUserState.applyMe(me)` w `ensureLoaded`/`refresh` (4.3) |
| 6 | `src/app/core/services/subscription-state.service.spec.ts` | zmiana | sekcja 8.3 |
| 7 | `src/app/pages/settings/services/profile-settings.facade.ts` | zmiana | `applyProfile` w `next` (4.4) |
| 8 | `src/app/pages/settings/services/profile-settings.facade.spec.ts` | zmiana | sekcja 8.4 |
| 9 | `src/app/pages/auth/complete-profile/complete-profile-page.component.ts` | zmiana | zachowanie odpowiedzi PUT, `applyProfile` przed `markComplete` (4.5) |
| 10 | `src/app/pages/auth/complete-profile/complete-profile-page.component.spec.ts` | **NOWY** | sekcja 8.5 |
| 11 | `src/app/layout/main-layout/components/topbar/topbar.component.ts` | zmiana | sygnały `displayName`, `userGreeting`; importy Material (4.6) |
| 12 | `src/app/layout/main-layout/components/topbar/topbar.component.html` | zmiana | przycisk + nagłówek menu (4.6) |
| 13 | `src/app/layout/main-layout/components/topbar/topbar.component.scss` | zmiana | style (4.7) + kalibracja (sekcja 5) |
| 14 | `src/app/layout/main-layout/components/topbar/topbar.component.spec.ts` | zmiana | sekcja 8.6 |

**Bez zmian (potwierdzić `git diff --stat`):** `WelcomeHeader`, `PublicLayout`, `MainLayoutComponent`, `LayoutService`, `MainNavigationComponent`, `app.routes.ts`, `MeApiService`, `ProfileSettingsApiService`, `ProfileCompletionService`, `shared/contracts/**`, `supabase/**`, `package.json`, `package-lock.json`.

Nie dodajemy modułu Material „zbiorczego" — projekt importuje moduły Material bezpośrednio w `imports` komponentów (zgodnie z istniejącym `TopbarComponent`).

---

## 4. Szczegóły implementacji

Zasady wspólne: wcięcie 4 spacje, standalone, `OnPush`, sygnały, `inject()`, modyfikatory dostępu (`private`/`readonly`), guard clauses i wczesne `return`, brak RxJS w nowym serwisie, brak `any`. Nazwa użytkownika **nie trafia do logów** i do żadnego storage.

### 4.1 `CurrentUserStateService` (nowy)

- Plik: `core/services/current-user-state.service.ts`, `@Injectable({ providedIn: 'root' })`, **bez zależności** (brak cykli: `AuthService`, `SubscriptionStateService`, fasada i strona mogą go bezpiecznie wstrzyknąć).
- Typy wejściowe: `Pick<MeDto, 'id' | 'username'>`, `Pick<ProfileSettingsDto, 'id' | 'username'>` (import `type` z `../../../../shared/contracts/types`).

Szkic (kontrakt z planu API 4.2; implementer może zmienić szczegóły, nie semantykę):

```ts
@Injectable({ providedIn: 'root' })
export class CurrentUserStateService {
    private activeUserId: string | null = null;
    private readonly usernameState = signal<string | null>(null);

    /** Surowa nazwa z ostatniej udanej odpowiedzi API (lub null). */
    readonly username = this.usernameState.asReadonly();
    /** Nazwa po trim; null, gdy brak / pusta / same białe znaki. Źródło dla UI. */
    readonly displayName = computed(() => this.usernameState()?.trim() || null);

    switchUser(userId: string | null): void {
        if (userId === this.activeUserId) {
            return;
        }
        this.activeUserId = userId;
        this.usernameState.set(null);
    }

    applyMe(me: Pick<MeDto, 'id' | 'username'>): void {
        this.applyUsername(me.id, me.username);
    }

    applyProfile(profile: Pick<ProfileSettingsDto, 'id' | 'username'>): void {
        this.applyUsername(profile.id, profile.username);
    }

    private applyUsername(userId: string, username: unknown): void {
        if (this.activeUserId === null || userId !== this.activeUserId) {
            return;
        }
        if (typeof username !== 'string') {
            return;
        }
        this.usernameState.set(username);
    }
}
```

Reguły (każda ma test w 8.1):

1. `activeUserId` to zwykłe pole (nie sygnał) — nikt go nie czyta reaktywnie.
2. **Brak metody „błąd ⇒ czyść"** — nazwa jest czyszczona wyłącznie przez `switchUser(null | inny id)` (scenariusz 8, przypadek 14).
3. `switchUser` jest idempotentne dla tego samego id (`TOKEN_REFRESHED` ⇒ ponowne `updateAuthState` tego samego użytkownika nie czyści nazwy).
4. `applyMe`/`applyProfile` bez aktywnego użytkownika lub z `id` ≠ aktywny — ignorowane (obrona przed spóźnioną odpowiedzią A po przełączeniu na B).
5. `''` z serwera **jest** prawdą (ustawia stan; `displayName` ⇒ `null`); `null`/`undefined` — ignorowane.
6. Brak migania (scenariusz 12): `displayName` to `computed` — `'  Jan '` → `'Jan'` po wcześniejszym `'Jan'` nie powiadamia konsumentów (równość `Object.is` na wyniku).

### 4.2 `AuthService`

Zmiany minimalne, bez zmiany istniejących zachowań (kredyty AI, subskrypcja, logowanie diagnostyki):

- `private readonly currentUserState = inject(CurrentUserStateService);`
- `updateAuthState`, gałąź niezalogowana: `this.currentUserState.switchUser(null);` zaraz po `this.userId.set(null)`.
- `updateAuthState`, gałąź zalogowana: `this.currentUserState.switchUser(userId);` zaraz po `this.userId.set(userId)` — **bezwarunkowo** (nie tylko przy `userChanged`; idempotentność serwisu załatwia `TOKEN_REFRESHED`).
- `bootstrapAiCredits`: po istniejącym guardzie `userId() !== expectedUserId` i po `subscriptionState.applyMe(me)` dodać `this.currentUserState.applyMe(me);`. Gałąź `catch` — **bez zmian** (nie dotyka stanu nazwy; `console.error` bez danych osobowych jak dotąd).

Kolejność jest istotna: `switchUser` (synchronicznie) poprzedza `await bootstrapAiCredits`, więc `applyMe` zawsze trafia na właściwego aktywnego użytkownika.

### 4.3 `SubscriptionStateService`

- `private readonly currentUserState = inject(CurrentUserStateService);` (bez cyklu: nowy serwis nic nie wstrzykuje).
- `ensureLoaded` i `refresh`: w gałęzi sukcesu, **wewnątrz** istniejącego `if (this.generation === requestGeneration)`, po `this.applyMe(me)` dodać `this.currentUserState.applyMe(me);`.
- **Nie** zmieniać publicznego `applyMe()` ani `mapMeToSnapshot` (bootstrap woła `applyMe` bezpośrednio i sam przekazuje nazwę — brak podwójnego wywołania, `SubscriptionSnapshot` bez nowego pola).
- Gałęzie błędu bez zmian.

### 4.4 `ProfileSettingsFacade`

- `private readonly currentUserState = inject(CurrentUserStateService);` (serwis `root` w fasadzie zakresu komponentu — zwykłe `inject`).
- `saveProfile`, `next`: po `this.profile.set(this.normalizeProfile(profile))` dodać `this.currentUserState.applyProfile(profile);` (nazwa z **odpowiedzi** serwera, już po `trim`). `error` — bez zmian i bez `applyProfile` (scenariusz 11).
- Blokada `isSavingProfile` zostaje (przypadek 15: stan odzwierciedla ostatni **udany** zapis; zapis w toku/z błędem nie zmienia nazwy).
- `loadProfile` **nie** wywołuje `applyProfile` (brak wymagania; patrz 12.3).

### 4.5 `CompleteProfilePageComponent`

- `private readonly currentUserState = inject(CurrentUserStateService);`
- `handleSave`: zachować odpowiedź:
  ```ts
  const profile = await firstValueFrom(this.profileSettingsApi.updateProfileSettings({ … }));
  this.currentUserState.applyProfile(profile);
  this.profileCompletion.markComplete();
  await this.router.navigateByUrl(this.postAuthRedirect.consume() ?? '/dashboard');
  ```
- Kolejność **`applyProfile` → `markComplete` → nawigacja** jest wymogiem (test 8.5). Gałąź `catch` (401/409/inne) bez zmian i bez zmiany stanu nazwy.
- Szablon, style i `CompleteProfileFormComponent` bez zmian.

### 4.6 `TopbarComponent` — TS i HTML

**`topbar.component.ts`:**

- Importy: `MatTooltipModule` (`@angular/material/tooltip`), `MatDividerModule` (`@angular/material/divider`) do tablicy `imports`; `CurrentUserStateService`.
- Pola:
  ```ts
  private readonly currentUserState = inject(CurrentUserStateService);

  /** Nazwa do wyświetlenia; null = nie pokazujemy nic (ładowanie, błąd, pusta). */
  readonly displayName = this.currentUserState.displayName;

  /** Jedna treść dla aria-label i tooltipu (identyczna ⇒ AriaDescriber nie dubluje komunikatu). */
  readonly userGreeting = computed(() => {
      const name = this.displayName();
      return name ? `Zalogowano jako ${name}` : null;
  });
  ```
- `aria-label` w szablonie: `userGreeting() ?? 'Menu użytkownika'`; tooltip: `userGreeting() ?? ''`.
- Reszta klasy (`mainNavItems`, `logout`, `toggleSidebar`) **bez zmian**. `OnPush` zostaje (zmiany przez sygnały).

**`topbar.component.html`** — sekcja `topbar__right`. Jeden element `<button>` **bez** przełączania gałęzi `@if/@else` na całym przycisku (nie odtwarzamy elementu i nie gubimy fokusu, gdy nazwa pojawia się po `/me`):

```html
<button
    mat-icon-button
    type="button"
    class="topbar__avatar topbar__user-button"
    [class.topbar__user-button--named]="displayName() !== null"
    [matMenuTriggerFor]="userMenu"
    [attr.aria-label]="userGreeting() ?? 'Menu użytkownika'"
    [matTooltip]="userGreeting() ?? ''"
    [matTooltipDisabled]="displayName() === null"
    #userTooltip="matTooltip"
    (menuOpened)="userTooltip.hide(0)"
>
    @if (displayName(); as name) {
        <span class="topbar__username" aria-hidden="true">{{ name }}</span>
    }
    <mat-icon aria-hidden="true">account_circle</mat-icon>
</button>
```

Menu — nagłówek **przed** istniejącymi pozycjami (które pozostają bez zmian):

```html
<mat-menu #userMenu="matMenu" xPosition="before">
    @if (displayName(); as name) {
        <div class="topbar__menu-header" role="presentation">
            Zalogowano jako <span class="topbar__menu-username">{{ name }}</span>
        </div>
        <mat-divider></mat-divider>
    }
    <a mat-menu-item routerLink="/settings">…</a>   <!-- bez zmian -->
    …
</mat-menu>
```

Uwagi:

- Nazwa wyłącznie przez interpolację `{{ }}` i `[attr.aria-label]` — brak `innerHTML`/`bypassSecurityTrust*` (przypadek 4).
- `type="button"` dodajemy jawnie (przycisk nie jest w formularzu, ale to dobra praktyka a11y; nie zmienia zachowania).
- `aria-hidden` na spanie i ikonie: nazwę dostępną daje `aria-label`, który **zawiera** widoczny tekst (WCAG 2.5.3). Treść `aria-label` = treść tooltipu ⇒ CDK `AriaDescriber` nie dodaje `aria-describedby` (przypadek 18) — ten warunek jest sprawdzany w teście (8.6); jeśli w Material 21 kolejność bindowania da chwilowy `aria-describedby`, implementer dokumentuje to w review i rozważa `[attr.aria-describedby]="null"`.
- `(menuOpened)="userTooltip.hide(0)"` — zapobiega nakładaniu tooltipu na otwierane menu (oba kotwiczone pod przyciskiem). Element dodatkowy względem planu UI; do potwierdzenia ręcznie (sekcja 9). Jeśli okaże się zbędny — usunąć.
- Nagłówek nie jest `mat-menu-item` ⇒ nie wchodzi do `FocusKeyManager`; kolejność fokusu Ustawienia → Admin → Wyloguj bez zmian (scenariusz 6). Precedens: istniejący `@if (isAdmin())` w tym samym menu już czyta sygnał w treści menu (widok „transplantowany") — wzorzec działa.
- Brak własnych animacji (żadnych `transition`/`animation` na nazwie) ⇒ przypadek 20 spełniony z definicji.

### 4.7 `TopbarComponent` — SCSS

Zasady: zmienne `--mat-sys-*`, brak stałych kolorów, wcięcie 4 spacje, nie ruszać istniejących `@media (max-width: 960px)` / `480px` (N5 — błąd preexistujący, poza zakresem).

1. **Zmienna** w `.topbar`: `--topbar-username-max-width: 160px;` (wartość bazowa dla 600–959 px).
2. **Desktop ≥960 px** (zgodnie z `isMobileOrTablet` = `<959.99px`): nadpisanie zmiennej przez `clamp()` — **wartości startowe są hipotezą, finalne ustala kalibracja (sekcja 5)**:
   ```scss
   @media (min-width: 960px) {
       .topbar {
           --topbar-username-max-width: clamp(72px, calc(50vw - 392px), 160px);
       }
   }
   ```
3. **Układ elastyczny** (siatka bezpieczeństwa dla 600–959 px i wąskiego desktopu):
   - `&__right { min-width: 0; flex-shrink: 1; }` (dziś `flex-shrink: 0`),
   - `&__left` i `&__pricing-link`: `flex-shrink: 0` (logo, hamburger i „Cennik" nigdy nie są wypychane ani skracane),
   - `&__user-button { min-width: 0; max-width: 100%; flex-shrink: 1; }` — **jawne `flex-shrink: 1` jest wymagane**, bo `.mat-mdc-icon-button` ma `flex-shrink: 0` (zweryfikowane w Material 21.0.2; plan UI tego nie uwzględniał, patrz 12.1).
4. **Tryb „z nazwą" — wyłącznie ≥600 px** (poniżej klasa `--named` nie ma efektu ⇒ przycisk identyczny z dzisiejszym, scenariusz 3 i przypadek 10):
   ```scss
   @media (min-width: 600px) {
       .topbar__user-button--named {
           --mat-icon-button-container-shape: 20px;   // pill; focus/ripple dziedziczą radius
           display: inline-flex;
           align-items: center;
           gap: 8px;
           width: auto;                                // nadpisuje width tokenu state-layer-size
           padding: 0 8px 0 12px;                      // nadpisuje padding liczony z tokenów
       }
   }
   ```
   Wysokość pozostaje 40 px (`height` z tokenu) ⇒ cel dotykowy ≥40 px. Do zmiany promienia używamy **tokenu** `--mat-icon-button-container-shape`, a nie `border-radius` (mniej kruche, warstwa stanu i wskaźnik fokusu dziedziczą `border-radius: inherit`). Ikona w trybie nazwanym: `flex-shrink: 0`.
5. **Nazwa:**
   ```scss
   &__username {
       display: block;
       min-width: 0;
       max-width: var(--topbar-username-max-width);
       overflow: hidden;
       text-overflow: ellipsis;
       white-space: nowrap;
       color: var(--mat-sys-on-surface);
       font: var(--mat-sys-label-large);
       line-height: 1.5;   // MUSI być PO `font:` (skrót `font` resetuje line-height); chroni diakrytyki (Żółć_Łukasz-1) przed obcięciem przez overflow
   }
   @media (max-width: 599.98px) {
       .topbar__username { display: none; }
   }
   ```
   `font-size` przycisku to 24 px (token ikony) — span musi mieć własny `font`, inaczej nazwa byłaby zbyt duża.
6. **Nagłówek menu:**
   ```scss
   &__menu-header {
       max-width: min(280px, calc(100vw - 32px));
       padding: 12px 16px;
       white-space: normal;          // zawijanie zamiast poszerzania menu (przypadek 17)
       overflow-wrap: anywhere;      // 50 znaków bez spacji
       color: var(--mat-sys-on-surface-variant);
       font: var(--mat-sys-body-medium);
   }
   &__menu-username { color: var(--mat-sys-on-surface); font-weight: 600; }
   ```
   Uwaga: `mat-menu` renderuje treść w overlayu poza hierarchią `.topbar`, ale `ViewEncapsulation.Emulated` stosuje atrybut komponentu do elementów zadeklarowanych w szablonie topbara — style `&__menu-header` zadziałają bez `::ng-deep` (tak jak istniejące elementy menu). Potwierdzić wizualnie (sekcja 9).
7. Fokus: widoczny wskaźnik zapewnia Material (`mat-focus-indicator`); po zmianie promienia sprawdzić ręcznie (sekcja 9).

---

## 5. Kalibracja `clamp()` (pomiar ręczny)

### 5.1 Model

Na ≥960 px `.topbar__center` jest pozycjonowany absolutnie (`left: 50%`, `translateX(-50%)`) i **nie oddaje miejsca** w układzie flex. Grupa prawa (`__right`: opcjonalny „Cennik" + przycisk użytkownika) przylega do prawej krawędzi. Bez nakładania się na nawigację obowiązuje:

```
nameBudget(vw) = 50vw − C
C = padding(16) + navWidth/2 + G + pricingWidth + 8 + buttonChrome
```

- `navWidth` — szerokość `.topbar__center` (stała dla roli: `user`/`premium` 3 pozycje, `admin` 4 pozycje),
- `G` — wymagany odstęp bezpieczeństwa między nawigacją a grupą prawą (**przyjęte G = 16 px**; plan UI pominął margines, stąd 376 zamiast 392),
- `pricingWidth` — szerokość „Cennik" (tylko rola `user`; dla `premium`/`admin` = 0 i brak dodatkowego `8` gap),
- `buttonChrome` — `button.width − name.width` (padding 12+8, gap 8, ikona 28 ⇒ szacunkowo 56 px).

`C` nie zależy od `vw` (nawigacja jest wyśrodkowana), więc **jedna seria pomiarów wystarcza do dopasowania formuły**. Najgorszy przypadek to rola `user` (jest „Cennik"); `admin` ma szerszą nawigację, ale brak „Cennik" i zwykle większy budżet.

### 5.2 Szacunek wyjściowy (hipoteza, nie wynik pomiaru)

| Składnik | Szacunek |
|---|---|
| padding | 16 (8 przy dokładnie 960 px przez N5 — dodatkowy zapas) |
| `navWidth` (rola `user`) | 360–400 px (3 linki: „Odkrywaj przepisy" > 100 px, pozostałe `min-width: 100`) |
| `G` | 16 |
| `pricingWidth` + gap | ≈ 68–88 + 8 |
| `buttonChrome` | ≈ 56–64 |
| **C (rola `user`)** | **≈ 344–392 px** |

Wartość startowa w SCSS: `clamp(72px, calc(50vw - 392px), 160px)` (górna granica C — bezpieczna). Przy tym C budżet = 88 px przy 960 px, 160 px od 1104 px.

### 5.3 Procedura pomiaru (implementer, `ng serve` + lokalny Supabase, konto testowe z `.env.local`)

1. Przygotować nazwę **50 × `W`** (Ustawienia ⇒ zapis) — najszerszy przypadek. Rola `user` (z „Cennik"), następnie `admin`.
2. W DevTools ustawić `document.querySelector('.topbar').style.setProperty('--topbar-username-max-width', '9999px')` (nazwa nieobcinana).
3. Dla szerokości okna **960, 1024, 1100, 1200** uruchomić w konsoli:
   ```js
   const r = (s) => document.querySelector(s)?.getBoundingClientRect();
   const vw = document.documentElement.clientWidth;
   const nav = r('.topbar__center'), right = r('.topbar__right');
   const pricing = r('.topbar__pricing-link'), btn = r('.topbar__user-button'), name = r('.topbar__username');
   const G = 16;                                    // wymagany odstęp nav ↔ grupa prawa
   const rightWithoutName = right.width - name.width; // pricing + gap + chrome przycisku (niezależne od nazwy)
   const budget = (vw - 16) - (nav.right + G) - rightWithoutName; // maks. szerokość nazwy bez nakładania
   const C = 0.5 * vw - budget;                     // stała do formuły calc(50vw - C)
   console.table({ vw, navWidth: nav.width, pricing: pricing?.width ?? 0,
       chrome: btn.width - name.width, rightWithoutName, budget, C });
   ```
   Nazwa 50 × `W` przy limicie 9999 px zwęża się flexem do dostępnego miejsca, ale `right.width − name.width` pozostaje poprawną częścią „bez nazwy". Padding topbara to 16 px przy ≥961 px (przy dokładnie 960 px działa 8 px z N5 — zapas, nie uwzględniać w pomiarze).
4. Wpisać wyniki do tabeli 5.4. Przyjąć `C_final = ceil(max(C))` z obu ról (zaokrąglić w górę do 4 px).
5. Podstawić `calc(50vw − C_final)` do SCSS i **zweryfikować wizualnie** dla `user` i `admin` przy 960/1024/1100/1280: brak nakładania `.topbar__center` na „Cennik"/przycisk (odstęp ≥ 16 px), brak poziomego przewijania.
6. Reguła dla dolnej granicy `clamp()`:
   - jeśli `budget(960) ≥ 72 px` ⇒ `MIN = floor(budget(960))` (nie mniej niż 72), formuła bez dodatkowych reguł;
   - jeśli `budget(960) < 72 px` (nazwa bez sensu: <~5 znaków) ⇒ ukryć nazwę w przedziale `960 px ≤ vw < 2·(C_final + 72)` przez media query. **Wtedy również zresetować tryb „pill"** (nie zostawiać `--named` z asymetrycznym paddingiem przy ukrytym spanie): zdefiniować mixin SCSS `username-hidden` (span `display: none` + brak stylów `--named`) i użyć go w obu zakresach (<600 px oraz węższy desktop). Zapisać decyzję w review.
7. Zmierzyć dodatkowo **600–959 px** (rola `user` z hamburgerem na 600 px i bez sidebara): potwierdzić, że `__right` nie wypycha logo/hamburgera/„Cennik" (siatka bezpieczeństwa z 4.7 pkt 3) i że przy 160 px nazwa mieści się lub jest obcinana, a nie przepełnia. Szacunek: dostępne miejsce na grupę prawą przy 600 px ≈ 280–310 px (hamburger + logo ≈ 270 px) ⇒ nazwa ≈ 160 px mieści się; **do potwierdzenia pomiarem**.
8. Test obciążeniowy: zoom 200% (efektywnie 960 px → układ 480 px; sprawdzić, że poniżej 600 px nazwa jest ukryta, a powyżej zgodnie z progiem) oraz powiększona czcionka systemowa — szczególnie szerokość „Cennik" i `navWidth`.

### 5.4 Tabela wyników (do wypełnienia przy implementacji; wynik zapisać też w review widoków — N7)

| Rola | vw | navWidth | pricing | buttonChrome | C | Odstęp nav↔prawa grupa | Status |
|---|---|---|---|---|---|---|---|
| user | 960 | — | — | — | — | — | `NIE_WYKONANO` |
| user | 1024 | — | — | — | — | — | `NIE_WYKONANO` |
| user | 1100 | — | — | — | — | — | `NIE_WYKONANO` |
| user | 1200 | — | — | — | — | — | `NIE_WYKONANO` |
| admin | 960 | — | n/d | — | — | — | `NIE_WYKONANO` |
| admin | 1100 | — | n/d | — | — | — | `NIE_WYKONANO` |
| user | 600 / 768 / 959 (siatka bezpieczeństwa) | n/d | — | — | n/d | brak wypychania | `NIE_WYKONANO` |
| **Finalna wartość `clamp()`** | | | | | `clamp(__px, calc(50vw − __px), 160px)` | | `NIE_WYKONANO` |

Maksymalna szerokość nazwy w przedziale 160–200 px z historyjki: wybrano **160 px** (dolna granica). Zmiana na wartość > 160 px wymaga ponownego pomiaru 600–959 px.

---

## 6. Stany UI

Brak szkieletów, placeholderów, tekstu zastępczego i komunikatów błędów w topbarze (wymóg historyjki — decyzja 5). Wszystkie stany wynikają z jednego sygnału `displayName`.

| Stan | `displayName` | Przycisk | Tooltip | `aria-label` | Nagłówek menu |
|---|---|---|---|---|---|
| Ładowanie `/me` | `null` | sama ikona | brak | `Menu użytkownika` | brak |
| Błąd `/me` (bez wcześniejszej nazwy) | `null` | sama ikona | brak | `Menu użytkownika` | brak |
| Pusta / same białe znaki / OAuth przed uzupełnieniem | `null` | sama ikona | brak | `Menu użytkownika` | brak |
| Nazwa znana, ≥600 px | `"X"` | nazwa + ikona (wielokropek) | `Zalogowano jako X` | `Zalogowano jako X` | `Zalogowano jako X` + separator |
| Nazwa znana, <600 px | `"X"` | sama ikona (`display: none` na nazwie) | j.w. | j.w. | j.w. |
| Nieudane ponowne `/me` po sukcesie | bez zmian | bez zmian | bez zmian | bez zmian | bez zmian |
| Wylogowanie / zmiana konta | `null` do czasu `/me` nowego użytkownika | sama ikona | brak | `Menu użytkownika` | brak |
| Pojawienie się nazwy po `/me` | `null → "X"` | ten sam element `<button>` (fokus nie ginie) | pojawia się | zmienia się | pojawia się |

Responsywność (CSS, bez `BreakpointObserver` — decyzja planu UI):

| Szerokość | Zachowanie |
|---|---|
| <600 px (≤599,98 px) | tylko ikona; span `display: none`; klasa `--named` bez efektu |
| 600–959 px | nazwa widoczna, `max-width` 160 px, wielokropek; grupa prawa może się zwężać (`min-width: 0`) |
| ≥960 px | nazwa widoczna, `max-width: clamp(…)` zależnie od budżetu; nawigacja centralna nie nakłada się |

---

## 7. Interakcje, dostępność, bezpieczeństwo

- Klawiatura: Enter/Spacja otwiera menu, Esc zamyka (zapewnia `matMenuTriggerFor`); nagłówek nie jest fokusowalny.
- Czytnik ekranu: jedno odczytanie `Zalogowano jako {nazwa}` z `aria-label`; ikona i tekst nazwy `aria-hidden`; nagłówek menu jako tekst w DOM (N6 — `role="presentation"` w `role="menu"` to kompromis; potwierdzić czytnikiem i `axe`).
- Kontrast: wyłącznie `--mat-sys-on-surface` / `--mat-sys-on-surface-variant`.
- Bezpieczeństwo: interpolacja Angulara (HTML w nazwie to zwykły tekst); brak `localStorage`/`sessionStorage`; brak logowania nazwy; brak nowych żądań sieciowych.

---

## 8. Testy Vitest

Zasady (`vitest.mdc`): na początku pliku `import 'zone.js'; import 'zone.js/testing';`, `initTestEnvironment` w `beforeAll`, `NoopAnimationsModule` dla komponentów Material, natywne asercje (`toBeTruthy`, `getAttribute`, `classList.contains`, `toBeNull`), funkcja pomocnicza `setup…()`, Arrange-Act-Assert, `vi.clearAllMocks()`/`mockReset()` w `beforeEach`. Uruchamianie: `npm run test:run -- <ścieżka>` (skrypt `test:run` = `vitest run`).

### 8.1 `current-user-state.service.spec.ts` (nowy)

- stan początkowy: `username() === null`, `displayName() === null`;
- `switchUser('u1')` + `applyMe({ id: 'u1', username: 'Jan' })` ⇒ `username() === 'Jan'`, `displayName() === 'Jan'`;
- trim: `'  Jan  '` ⇒ `displayName() === 'Jan'`, `username() === '  Jan  '`;
- `''` i `'   '` ⇒ `displayName() === null`;
- `username: undefined`/`null` (rzutowanie na typ) ⇒ ignorowane, poprzednia wartość zostaje;
- `applyProfile` aktualizuje nazwę (zmiana `Kasia_Gotuje` → `Kasia_Kuchnia`);
- `switchUser(null)` czyści; `switchUser('B')` po `A` czyści; `switchUser('A')` ponownie dla A — **no-op** (nazwa zostaje);
- `applyMe`/`applyProfile` z `id` ≠ aktywny (spóźniona odpowiedź A po przełączeniu na B) ⇒ ignorowane (nazwa B nietknięta);
- `applyMe` bez wcześniejszego `switchUser` ⇒ ignorowane;
- brak miejsc czyszczących przy błędzie: seria wywołań bez `applyMe` nie zmienia nazwy (test dokumentujący kontrakt);
- brak migania: `computed`/`effect` zliczający uruchomienia (`TestBed.runInInjectionContext(() => effect(...))` + `TestBed.tick()`); `applyProfile` z identycznym `displayName` (także `'  Jan '` po `'Jan'`) ⇒ licznik bez zmiany.

### 8.2 `auth.service.spec.ts` (rozszerzenie bloku `initAuthState()`)

Do `providers` dodać mock `CurrentUserStateService` (`{ switchUser: vi.fn(), applyMe: vi.fn() }`) dla asercji wywołań, plus jeden test integracyjny z prawdziwym serwisem (osobny `describe`, `TestBed.overrideProvider`).

- sesja poprawna ⇒ `switchUser('user-1')` przed `getMe` (porównanie `mock.invocationCallOrder`), `applyMe(me)` po `subscriptionState.applyMe(me)`; istniejący test `powinien zasilić kredyty…` nadal przechodzi (m.in. `reset` ×1, kredyty);
- brak sesji ⇒ `switchUser(null)`, `getMe` niewołane, `applyMe` niewołane;
- nieprawidłowa sesja (`getUser` błąd) ⇒ `switchUser(null)` (istniejący test rozszerzyć o asercję);
- `getMe` rzuca błąd ⇒ `applyMe` **niewołane**, `console.error` wołane jak dotąd (spy), `switchUser` nie czyści stanu (integracyjny: nazwa z wcześniejszego sukcesu zostaje);
- `TOKEN_REFRESHED` tego samego użytkownika (callback `onAuthStateChange` z tą samą sesją) ⇒ `switchUser('user-1')` ponownie, a **prawdziwy** serwis nie czyści nazwy (test integracyjny);
- **wyścig**: `initAuthState` bez sesji (kończy się, rejestruje callback) → callback z sesją `user-1` (`getMe` ⇒ `Subject` A) → callback z sesją `user-2` (`getMe` ⇒ `Subject` B) → `B.next(meB)` → `A.next(meA)` ⇒ `applyMe` wołane **tylko** z `meB` (guard `expectedUserId` oraz guard `id`); dla prawdziwego serwisu `displayName() === meB.username`. Uwaga: `initAuthState` czeka na bootstrap przed rejestracją callbacka, dlatego scenariusz startuje bez sesji.

### 8.3 `subscription-state.service.spec.ts`

Prawdziwy `CurrentUserStateService` + `vi.spyOn(currentUserState, 'applyMe')` (serwis root, nie wymaga providera).

- `ensureLoaded` sukces ⇒ `currentUserState.applyMe(me)` wołane raz; `refresh` sukces ⇒ wołane z `me`;
- błąd `getMe` (`ensureLoaded` i `refresh`) ⇒ `applyMe` niewołane;
- `reset()` w trakcie żądania (zmiana `generation`) ⇒ `applyMe` niewołane (oba warianty);
- publiczne `service.applyMe(me)` **nie** woła `currentUserState.applyMe` (kontrakt: bootstrap przekazuje nazwę sam);
- istniejące testy (`mapMeToSnapshot`, deduplikacja, `reset`) bez zmian i zielone.

### 8.4 `profile-settings.facade.spec.ts`

Prawdziwy `CurrentUserStateService` z `switchUser(profileDto.id)` w `beforeEach` + `vi.spyOn(..., 'applyProfile')` tam, gdzie liczy się wywołanie.

- sukces zapisu z nową nazwą ⇒ `applyProfile` z odpowiedzią API; `displayName()` = nowa nazwa; **bez** `getProfileSettings` (brak dodatkowych żądań);
- 409 ⇒ brak `applyProfile`, `displayName()` bez zmian, `saveError` jak dotąd;
- 500 ⇒ jw.;
- zapis tylko zgody marketingowej (ta sama nazwa) ⇒ `displayName()` bez zmian i bez przejścia przez `null` (licznik `effect` jak w 8.1);
- drugi `saveProfile` w trakcie zapisu (`isSavingProfile`) ⇒ ignorowany, `updateProfileSettings` ×1, `applyProfile` ×1;
- odpowiedź z nazwą ze spacjami (`'  Jan '`) ⇒ `displayName()` = `'Jan'`;
- `loadProfile` **nie** zmienia `displayName()` (kontrakt z 4.4);
- istniejące testy (`loadProfile`, 409, zmiana hasła 422) bez zmian.

### 8.5 `complete-profile-page.component.spec.ts` (nowy)

Dziś brak specu strony. Izolacja logiki: `TestBed.overrideComponent(CompleteProfilePageComponent, { set: { imports: [], template: '' } })` (formularz potomny ma własny spec).

Mocki: `SupabaseService` (`auth.getUser` ⇒ `{ data: { user: { email } }, error: null }`), `ProfileCompletionService` (`ensureChecked` ⇒ `false`, `markComplete` `vi.fn()`), `ProfileSettingsApiService` (`updateProfileSettings`), `PostAuthRedirectService` (`consume` ⇒ `null`), `provideRouter([])` + `vi.spyOn(router, 'navigateByUrl'/'navigate')`, `MatSnackBar` (`vi.spyOn(TestBed.inject(MatSnackBar), 'open')`), prawdziwy `CurrentUserStateService` z `switchUser('user-1')`.

- sukces `handleSave('  Jan ')` ⇒ `updateProfileSettings` z `username: 'Jan'`; `applyProfile` wołane z odpowiedzią; **kolejność** `applyProfile` < `markComplete` < `navigateByUrl` (`mock.invocationCallOrder`); `displayName()` = nazwa z odpowiedzi; nawigacja do `/dashboard` (lub wartość `consume()`);
- pusta/biała nazwa ⇒ brak wywołania API, `applyProfile` niewołane;
- 409 ⇒ `serverError` „Ta nazwa użytkownika jest już zajęta.", `applyProfile` niewołane, brak `markComplete`, `isSaving` wraca do `false`;
- 401 ⇒ snackbar + nawigacja `/login`, `applyProfile` niewołane;
- inny błąd (`500`) ⇒ `serverError` z komunikatem, `applyProfile` niewołane;
- inicjalizacja (`ngOnInit`): `isProfileComplete === true` ⇒ nawigacja do `/dashboard` (smoke dla nowego specu).

### 8.6 `topbar.component.spec.ts`

Przebudowa konfiguracji pod renderowanie: `NoopAnimationsModule`, `provideRouter([])` **zamiast** mocka `Router` (mock bez `events` łamie `RouterLink`); `logout` testować przez `vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)`. `AuthService` mock (`appRole`, `signOut`), `LayoutService` mock jak dziś. Domyślnie `isMobileOrTablet = true` (nawigacja niewyrenderowana), a osobny test z `false` renderuje `pych-main-navigation` (wymaga tylko `Router`/`LayoutService`). Dostęp do `CurrentUserStateService` przez `TestBed.inject` + `switchUser('u1')` / `applyMe`.

Zachować istniejące 2 testy (`mainNavItems`; po przejściu na `createComponent` lub bez zmian z `runInInjectionContext`).

- **Render nazwy:** `Kasia_Gotuje` ⇒ `.topbar__username` w DOM z tym tekstem, w tym samym `<button>` co `mat-icon`, **przed** ikoną; jeden `<button>` w `.topbar__right` z `matMenuTriggerFor` (nazwa i ikona to nie dwa przyciski); klasa `topbar__user-button--named` obecna;
- **`aria-label`:** `Zalogowano jako Kasia_Gotuje`; zawiera widoczny tekst; `aria-hidden="true"` na spanie i ikonie; **brak** `aria-describedby` na przycisku;
- **Tooltip:** `debugElement.injector.get(MatTooltip)` ⇒ `message === 'Zalogowano jako Kasia_Gotuje'` i `disabled === false` (bez budowania overlayu w jsdom); dla `null` ⇒ `disabled === true`;
- **Brak nazwy:** `null`, `''`, `'   '` ⇒ brak `.topbar__username`, `aria-label === 'Menu użytkownika'`, brak klasy `--named`, tooltip `disabled`;
- **Trim:** `'  Jan  '` ⇒ `aria-label` `Zalogowano jako Jan` (bez podwójnych spacji);
- **HTML jako tekst:** `<b>x</b>` i `&amp;` ⇒ `textContent` dosłowny, brak elementu `<b>` w przycisku i w `aria-label`;
- **50 znaków:** pełna nazwa w DOM i `aria-label` (obcięcie realizuje CSS; asercja na klasę `topbar__username`);
- **Nagłówek menu:** otwarcie przez `debugElement.query(By.directive(MatMenuTrigger)).injector.get(MatMenuTrigger).openMenu()` + `detectChanges` + `await fixture.whenStable()`; asercje na `document.querySelector('.topbar__menu-header')` (overlay): tekst `Zalogowano jako Kasia_Gotuje`, `mat-divider` przed pierwszym `.mat-mdc-menu-item`; nagłówek **nie** jest `mat-mdc-menu-item`; kolejność pozycji bez zmian (Ustawienia, Wyloguj się); dla `null` brak nagłówka i separatora;
- **Rola `admin`:** nagłówek jest pierwszym dzieckiem panelu, przed „Admin"; kolejność Ustawienia → Admin → Wyloguj;
- **Aktualizacja reaktywna:** `applyProfile` z nową nazwą po `detectChanges` ⇒ nowy tekst w przycisku, `aria-label`, nagłówku; `null → nazwa` nie odtwarza elementu `<button>` (ta sama referencja DOM przed i po);
- **`logout()`** bez regresji (`signOut` + `navigate(['/login'])`, także przy błędzie `signOut`);
- **Ograniczenie jsdom:** media queries nie są ewaluowane w `getComputedStyle` ⇒ ukrycie <600 px i obcięcie wielokropkiem **nie są testowane jednostkowo**; zastępnik: span zawsze w DOM i ma klasę `topbar__username` (N1) + weryfikacja ręczna 599/600 px (sekcja 9).

### 8.7 Brak regresji (scenariusz 15)

- `git diff --stat` nie zawiera `WelcomeHeader`, `PublicLayout`, `MainLayout`, `shared/contracts`, `supabase`;
- istniejące specy tych komponentów i `main-layout.component.spec.ts` przechodzą bez zmian.

---

## 9. Weryfikacja manualna (wszystkie pozycje `NIE_WYKONANO` do czasu implementacji)

Dane testowe: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` z lokalnego `.env.local` (nie zapisywać w repo). Środowisko: `ng serve` + lokalny Supabase.

| Obszar | Kroki | Status |
|---|---|---|
| Kalibracja `clamp()` | Procedura i tabela z sekcji 5 | `NIE_WYKONANO` |
| Próg 600 px | 479, 480–599, **599 (ukryta) / 600 (widoczna)** | `NIE_WYKONANO` |
| Tablet / desktop | 600–959, 959/960, 960–1100, ≥1280; brak poziomego przewijania; logo/„Cennik"/hamburger nie wypychane | `NIE_WYKONANO` |
| Długość i znaki nazwy | 3 znaki, 50 × `W`, `Żółć_Łukasz-1` (diakrytyki nieobcięte), `<b>x</b>` | `NIE_WYKONANO` |
| Role | `user` (z „Cennik"), `premium`, `admin` (`/admin/dashboard` — ten sam topbar) | `NIE_WYKONANO` |
| Kształt przycisku | pill ≥600 px: ripple, hover i **wskaźnik fokusu** przylegają do promienia; wysokość ≥40 px; <600 px przycisk identyczny jak przed zmianą (porównanie ze zrzutem `main`) | `NIE_WYKONANO` |
| Tooltip | hover i fokus klawiaturą: pełna nazwa; po otwarciu menu tooltip znika (`menuOpened`) i nie zasłania menu | `NIE_WYKONANO` |
| Nagłówek menu | wygląd, separator, zawijanie 50 znaków bez spacji na 320 px, menu nie wychodzi poza ekran; style bez `::ng-deep` działają | `NIE_WYKONANO` |
| Zmiana nazwy | Ustawienia: zmiana ⇒ natychmiast; 409 ⇒ bez zmian; F5 ⇒ nowa nazwa; sama zgoda marketingowa ⇒ brak migania; w Network brak dodatkowego `GET /me` po zapisie | `NIE_WYKONANO` |
| Konto OAuth | brak nazwy ⇒ ikona; po uzupełnieniu ⇒ nazwa w topbarze po przejściu do `/dashboard` (bez przeładowania) | `NIE_WYKONANO` |
| Wylogowanie/zmiana konta | A → B: brak nazwy A; po `/me` nazwa B | `NIE_WYKONANO` |
| Błąd `/me` | zablokowanie żądania `me` w DevTools ⇒ sama ikona, bez toastów, reszta topbara działa | `NIE_WYKONANO` |
| Dostępność | Tab/Enter/Spacja/Esc, widoczny fokus, czytnik (jedno odczytanie „Zalogowano jako …", nagłówek menu), `axe`, zoom 200%, brak animacji nazwy | `NIE_WYKONANO` |
| Goście / `WelcomeHeader` | bez zmian wizualnych | `NIE_WYKONANO` |

---

## 10. Kolejność kroków

Każdy krok kończy się bramką: `npm run test:run -- <pliki kroku>` zielone + `ReadLints` na zmienionych plikach bez nowych błędów. Kroki 2–4 mogą iść równolegle po kroku 1; krok 5 zależy tylko od kroku 1.

| # | Krok | Pliki | Bramka |
|---|---|---|---|
| 0 | Baseline: `git status` czysty względem zakresu PS-37; uruchomić istniejące specy dotykanych plików (auth, subscription-state, facade, topbar) — zielone przed zmianą | — | `PASS` baseline |
| 1 | `CurrentUserStateService` + spec | #1, #2 | spec 8.1 `PASS` |
| 2 | Integracja `AuthService` + spec | #3, #4 | spec 8.2 `PASS`, istniejące testy auth bez regresji |
| 3 | Integracja `SubscriptionStateService` + spec | #5, #6 | spec 8.3 `PASS` |
| 4 | Integracja fasady Ustawień + spec | #7, #8 | spec 8.4 `PASS` |
| 5 | `CompleteProfilePageComponent` + nowy spec | #9, #10 | spec 8.5 `PASS`, kolejność `applyProfile`→`markComplete`→nawigacja |
| 6 | `TopbarComponent` TS + HTML (bez nowych stylów poza koniecznymi) + spec | #11, #12, #14 | spec 8.6 `PASS` (bez asercji CSS) |
| 7 | Style topbara z **wartościami startowymi** `clamp()` | #13 | `npm run build` bez błędów SCSS; wizualna weryfikacja w `ng serve` |
| 8 | **Kalibracja `clamp()`** (sekcja 5): pomiar, wpis do tabeli 5.4, korekta SCSS, ewentualny mixin `username-hidden` | #13 | tabela 5.4 uzupełniona, brak nakładania nawigacji |
| 9 | Weryfikacja manualna (sekcja 9) + wyniki do review | — | statusy jawne w review |
| 10 | Bramki końcowe: `npm run lint` · `npm run test:run` · `npm run build` · `git diff --stat origin/main -- supabase shared/contracts` (pusty) · `git diff --stat` bez `WelcomeHeader`/`PublicLayout` | — | każdy wynik `PASS`/`FAIL` (nie `NIE_WYKONANO`) |
| 11 | Przekazanie do `ps-code-reviewer`; po akceptacji `ps-summary-updater` (project-summary sekcje 0 i 6) | — | review widoków `r{R}` albo `BEZ_REVIEW` z powodem |

Uzasadnienie kolejności: serwis stanu (1) nie ma zależności i odblokowuje wszystko; integracje źródeł (2–5) dają dane, zanim UI (6) je pokaże; style (7) przed kalibracją (8), bo pomiar wymaga działającego układu; pełne bramki (10) dopiero po kalibracji, bo ta może zmienić SCSS.

---

## 11. Macierz scenariuszy: GWT → implementacja → test

| Sc. | Zachowanie | Implementacja | Test |
|---|---|---|---|
| 1 | Nazwa w jednym przycisku obok ikony (desktop) | 4.6 (span przed ikoną, jeden `<button>`), 4.7 (2, 4, 5) | 8.6 render; manual: ≥960, kalibracja |
| 2 | Tooltip, `aria-label`, semantyka menu, fokus, ≥40 px | 4.6 (`aria-label`, `matTooltip`, `matMenuTriggerFor`), 4.7 (4, 7) | 8.6 (`MatTooltip.message`, aria); manual |
| 3 | <600 px: tylko ikona, `aria-label` z nazwą | 4.7 (4, 5) | 8.6 (DOM + aria); **CSS — manual** |
| 4 | 600–959 px: wielokropek, elementy nie wypychane | 4.7 (3, 4, 5) | manual 600/768/959; 8.6 (klasa) |
| 5 | 50 znaków: wielokropek, pełna nazwa w tooltipie i nagłówku | 4.7 (1, 2, 5, 6) | 8.6 (pełna nazwa w DOM/aria/nagłówku); manual |
| 6 | Nagłówek menu, nieklikalny, fokus bez zmian | 4.6 (nagłówek + `mat-divider`, nie `mat-menu-item`) | 8.6 (menu, kolejność) |
| 7 | Ładowanie `/me`: sama ikona | `displayName === null` | 8.1, 8.6 |
| 8 | Błąd `/me`: sama ikona, bez toastów | brak zmiany stanu w `catch` (4.2) | 8.2 (błąd ⇒ brak `applyMe`), 8.6; manual |
| 9 | Pusta nazwa (OAuth); po uzupełnieniu widoczna | 4.5 (`applyProfile` przed nawigacją) | 8.1, 8.5, 8.6; manual OAuth |
| 10 | Zmiana nazwy natychmiast, bez `GET /me` | 4.4 | 8.4, 8.6 (aktualizacja reaktywna); manual F5/Network |
| 11 | Nieudany zapis nie zmienia topbara | 4.4 (`error` bez zmian) | 8.4 (409, 500) |
| 12 | Inne ustawienia nie zmieniają/nie migają | 4.1 (reguła 6) | 8.1, 8.4 (zgoda marketingowa) |
| 13 | Wylogowanie/zmiana konta, wyścig `/me` | 4.1 (reguły 2–4), 4.2 | 8.1, 8.2 (wyścig, `TOKEN_REFRESHED`) |
| 14 | Panel administracyjny | ten sam topbar | 8.6 (rola `admin`); manual |
| 15 | Goście i `WelcomeHeader` bez zmian | brak edycji | 8.7 |

Przypadki brzegowe: 1, 5, 7–10 → 4.7 + manual; 2 → 4.7 (4); 3 → 4.7 (5) `line-height` po `font`; 4 → 4.6/8.6; 6 → 8.1/8.6; 11 → manual; 12 → bez wymagań; 13 → 4.3 + 8.3; 14 → 8.1; 15 → 4.4/8.4; 16 → 8.2; 17 → 4.7 (6); 18 → 4.6/8.6; 19 → 8.6; 20 → 4.6.

---

## 12. Rozbieżności względem planu UI, uwagi i ryzyka

### 12.1 Korekty względem `PS-37-…-ui-plan.md` (implementer stosuje ten plan)

| # | Plan UI | Ten plan | Powód |
|---|---|---|---|
| C1 | `&__user-button { min-width: 0; max-width: 100%; }` | dodatkowo **`flex-shrink: 1`** | `.mat-mdc-icon-button` ma `flex-shrink: 0` (Material 21.0.2); bez tego przycisk nie zwęża się w `__right` i nazwa wypycha elementy |
| C2 | `line-height: 1.5` przed `font: var(--mat-sys-label-large)` | `font` **najpierw**, `line-height` po | skrót `font` resetuje `line-height`; w kolejności z planu UI ochrona diakrytyków nie działałaby |
| C3 | `border-radius: 24px` + nadpisanie rozmiaru | token `--mat-icon-button-container-shape: 20px`, `width: auto`, `padding: 0 8px 0 12px` | Material ustawia `width/height/padding` z tokenów; zmiana tokenu kształtu zachowuje spójność ripple/focus (`border-radius: inherit`); 20 px = połowa 40 px |
| C4 | `clamp(96px, calc(50vw − 376px), 160px)` | start `clamp(72px, calc(50vw − 392px), 160px)` + kalibracja z marginesem G = 16 px | plan UI nie uwzględniał odstępu między nawigacją a grupą prawą; przy 376 i min 96 nazwa mogła stykać się z nawigacją przy 960 px dla roli `user` |
| C5 | Test tooltipu przez `mouseenter`/overlay | odczyt `MatTooltip.message`/`disabled` z injectora | stabilniejsze w jsdom, bez zależności od opóźnień i overlayu |
| C6 | `(menuOpened)` nieobecne | `#userTooltip="matTooltip"` + `(menuOpened)="userTooltip.hide(0)"` | tooltip i menu kotwiczone pod przyciskiem — zapobieganie nakładaniu (do potwierdzenia ręcznie) |
| C7 | `provideRouter([])` wspomniany ogólnie | konkretnie: usunąć mock `Router` z istniejącego specu topbara | mock `Router` bez `events` nie pozwala renderować `RouterLink` |

### 12.2 Ryzyka

| # | Ryzyko | Wpływ | Mitygacja |
|---|---|---|---|
| R1 | Szerokości `navWidth`/„Cennik" różnią się od szacunku (czcionka, zoom, system) | nakładanie nawigacji na grupę prawą na 960–1100 px | kalibracja z sekcji 5, margines G = 16, zapas przy 960 px (padding 8 przez N5); fallback „ukryj nazwę na wąskim desktopie" |
| R2 | Nadpisanie `width/padding` mat-icon-button koliduje z przyszłymi zmianami tokenów Material | regres wyglądu | użycie tokenu kształtu; w razie kruchości dopuszczalny `mat-button` z modyfikatorem `--icon-only` (jeden element, identyczny wygląd bez nazwy — warunek planu UI 4.3 pkt 4) |
| R3 | `touch-target` Material (48×48) jest wyśrodkowany i węższy niż „pill" | brak wpływu na wysokość ≥40 px; hit-area całego przycisku zapewnia sam `<button>` | potwierdzić na urządzeniu dotykowym |
| R4 | `role="presentation"` w `role="menu"` (N6) | drobna niezgodność narzędzi a11y | test czytnikiem i `axe`; w razie ostrzeżeń rozważyć `aria-hidden` + zachowanie informacji w tooltipie |
| R5 | Wyścig tego samego użytkownika (stary `/me` po `PUT /profile`) — N8 | znikome | akceptacja ryzyka (bootstrap kończy się przed interakcją użytkownika); brak liczników wersji |
| R6 | Chwilowy `aria-describedby` z `AriaDescriber` przy pierwszym renderze | podwójny odczyt czytnika | asercja w 8.6; opcja `[attr.aria-describedby]="null"` |
| R7 | Zmiana kolejności wywołań w `AuthService` złamie istniejący test (`reset` ×1 itp.) | regres | `switchUser` nie wywołuje `reset`; dodanie wywołań nie zmienia liczby `reset` — potwierdzone w 8.2 |

### 12.3 Decyzje świadome (poza zakresem)

- `GET /profile` (`ProfileCompletionService`, `auth-callback`, `dashboard/profile.service`) **nie** zasila `CurrentUserStateService` — źródłem pozostaje `GET /me` i `PUT /profile`; dodatkowe sprzężenia zwiększyłyby ryzyko wyścigów bez wymagania w historyjce.
- Brak synchronizacji nazwy między kartami (przypadek 12) i brak ponowienia `GET /me` po błędzie bootstrapu (zgodnie ze scenariuszem 8).
- Brak refaktoryzacji N5 (preexistujący `max-width: 960px`).

### 12.4 Zgodność z korektami historyjki (N1–N4)

Plan nie wymaga dalszych zmian historyjki. Testy `<600 px` realizowane są zgodnie z N1 (span zawsze w DOM + weryfikacja ręczna progu), hook `/auth/complete-profile` i nowy spec zgodnie z N2, panel `/admin` jako trasa w `MainLayout` zgodnie z N3, wyłącznie `PUT` zgodnie z N4.

---

## 13. Definicja ukończenia tego planu

- [ ] Kroki 0–11 z sekcji 10 wykonane, bramki zapisane jawnie (`PASS`/`FAIL`)
- [ ] Tabela kalibracji 5.4 uzupełniona; finalna wartość `clamp()` zapisana w SCSS i w review widoków
- [ ] Wszystkie testy z sekcji 8 dodane i zielone; pełny `npm run test:run` = `PASS`
- [ ] `npm run lint` i `npm run build` = `PASS`
- [ ] Weryfikacja manualna (sekcja 9) wykonana lub pozostałe pozycje jawnie oznaczone `NIE_WYKONANO` z powodem
- [ ] Zakres plików zgodny z sekcją 3 (brak zmian w `supabase/**`, `shared/contracts/**`, `WelcomeHeader`, `PublicLayout`)
- [ ] Review widoków `PS-37-topbar-username-display-review-views-r{R}.md` (lub `BEZ_REVIEW` z powodem); review API: `BEZ_REVIEW` — brak zmian API/DB/kontraktów
