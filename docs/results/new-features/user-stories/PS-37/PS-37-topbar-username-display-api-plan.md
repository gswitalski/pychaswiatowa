# PS-37: Wyświetlanie nazwy użytkownika w topbarze — Plan API

> **User Story:** `PS-37-topbar-username-display-user-story.md`
> **Data:** listopad 2026
> **Runda planowania:** 1
> **Zakres:** wyłącznie frontend — **brak zmian API, bazy danych, RLS, Edge Functions i kontraktów**

---

## 1. Werdykt

PS-37 **nie wprowadza nowych endpointów ani nie zmienia istniejących**. Nazwa użytkownika
pochodzi z dwóch już istniejących źródeł, które frontend dziś zna, ale ignoruje lub
przetwarza lokalnie:

| Rola w PS-37 | Endpoint (istniejący) | Metoda | Auth | Pole użyte |
|---|---|---|---|---|
| Źródło początkowe nazwy (bootstrap sesji) | `me` (`GET /me`) | `GET` | JWT; role `user` / `premium` / `admin` | `MeDto.username`, `MeDto.id` |
| Źródło po zmianie nazwy (Ustawienia) | `profile` (`PUT /profile`) | `PUT` | JWT; role `user` / `premium` / `admin` | `ProfileSettingsDto.username`, `ProfileSettingsDto.id` z odpowiedzi |
| Źródło po uzupełnieniu profilu OAuth | `profile` (`PUT /profile`) | `PUT` | JWT | j.w. |
| Odświeżenie przy okazji innych akcji | `GET /me` (`SubscriptionStateService.refresh/ensureLoaded`) | `GET` | JWT | `MeDto.username` |

Nie jest wykonywane żadne dodatkowe wywołanie sieciowe (wymaganie niefunkcjonalne
historyjki). W szczególności zapis profilu **nie** wywołuje ponownie `GET /me`.

> Uwaga do historyjki: scenariusze 10–11 mówią „`PUT`/`PATCH`". Faktyczna metoda to **wyłącznie `PUT`**
> (`ProfileSettingsApiService.updateProfileSettings`). `PATCH` nie istnieje — patrz sekcja 7.

---

## 2. Weryfikacja kodu (dowody)

| Fakt | Dowód w kodzie |
|---|---|
| `GET /me` zwraca `username` (pusty string, gdy brak profilu/nazwy) | `supabase/functions/me/me.service.ts` — `PROFILE_SELECT_COLUMNS = 'id, username'`, `username: profileData.username ?? ''` |
| `MeDto` zawiera `id` i `username` | `shared/contracts/types.ts` (`MeDto`) |
| `PUT /profile` zwraca `ProfileSettingsDto` z `id` i `username` (po `trim()` po stronie serwera) | `profile.service.ts` (`payload.username.trim()`, odpowiedź z wiersza DB), `profile.types.ts` (`z.string().trim().min(3).max(50)`) |
| Frontend woła API tylko przez `supabase.functions.invoke` | `MeApiService.getMe()`, `ProfileSettingsApiService.updateProfileSettings()` |
| `mapMeToSnapshot` pomija `username` | `subscription-state.service.ts` |
| `AuthService.bootstrapAiCredits` zabezpiecza wyścig przez `expectedUserId` | `auth.service.ts` (`bootstrapAiCredits`) |

Frontend **nie** czyta nazwy z tabel (`supabase.from(...)` — zabronione regułą `frontend.mdc`); plan tego
nie zmienia.

---

## 3. Kontrakty i DTO

| Element | Decyzja |
|---|---|
| `shared/contracts/types.ts` | **Bez zmian** (`MeDto.username`, `ProfileSettingsDto.username` wystarczają) |
| Nowe DTO / Command | **Brak** |
| Walidacja serwerowa | **Bez zmian** — `username` 3–50 znaków, bez białych znaków, trim po stronie serwera |
| Kody odpowiedzi | **Bez zmian** — `GET /me`: 200/401/500; `PUT /profile`: 200/401/409/422/500 |
| Migracje / RPC / RLS / seed | **Brak** |
| Sekrety / zmienne środowiskowe | **Brak** |

---

## 4. Frontendowy kontrakt konsumpcji danych (decyzja architektoniczna)

Ponieważ plan API dotyczy sposobu użycia istniejących endpointów, decyzje dotyczące wspólnego stanu
nazwy są częścią tego planu (szczegóły UI — w `PS-37-…-ui-plan.md`).

### 4.1 Miejsce stanu: **nowy serwis `CurrentUserStateService`** (rozstrzygnięcie punktu z historyjki)

Plik: `src/app/core/services/current-user-state.service.ts` (`providedIn: 'root'`, **bez zależności**).

| Opcja | Ocena | Powód |
|---|---|---|
| `AuthService` | Odrzucona | Rozdęcie odpowiedzialności (sesja, rola, OAuth, kredyty); `ProfileSettingsFacade` i strona uzupełniania profilu musiałyby ciągnąć `AuthService` → `SupabaseService`; trudniejsze testy |
| `SubscriptionStateService` | Odrzucona | Semantyka „subskrypcja"; jego `reset()` i generacje dotyczą subskrypcji; nazwa użytkownika nie jest jej częścią (nazwa „snapshot" zmieniłaby model `SubscriptionSnapshot`) |
| **Nowy `CurrentUserStateService`** | **Wybrana** | Jedno źródło prawdy dla tożsamości wyświetlanej w UI; brak cyklicznych zależności (serwis nic nie wstrzykuje); łatwe testy; rozszerzalny (np. przyszły avatar) bez dotykania auth/subskrypcji |

### 4.2 Publiczne API serwisu (kontrakt dla implementera)

```ts
@Injectable({ providedIn: 'root' })
export class CurrentUserStateService {
    /** Surowa nazwa z ostatniej udanej odpowiedzi API (lub null). */
    readonly username: Signal<string | null>;
    /** Nazwa po trim; null, gdy brak / pusta / same białe znaki. Źródło dla UI. */
    readonly displayName: Signal<string | null>;

    /** Ustawia aktywnego użytkownika. Inny użytkownik (lub null) → czyści nazwę. Ten sam → no-op. */
    switchUser(userId: string | null): void;
    /** Z GET /me. Ignorowane, gdy me.id !== aktywny użytkownik lub username nie jest stringiem. */
    applyMe(me: Pick<MeDto, 'id' | 'username'>): void;
    /** Z odpowiedzi PUT /profile. Te same reguły ochronne co applyMe. */
    applyProfile(profile: Pick<ProfileSettingsDto, 'id' | 'username'>): void;
}
```

Reguły (wynikają ze scenariuszy 7–15 i przypadków brzegowych):

1. **Brak czyszczenia przy błędzie** — serwis nie ma metody „błąd"; wywołania w gałęziach `catch` **nie istnieją**
   (przypadek brzegowy 14, scenariusz 8). Czyszczenie wyłącznie przez `switchUser(null | inny id)`.
2. **Odporność na wyścigi między użytkownikami** (scenariusz 13) — podwójna ochrona:
   - istniejąca: `AuthService.bootstrapAiCredits` odrzuca odpowiedź, gdy `userId() !== expectedUserId`;
   - nowa (defense in depth): serwis porównuje `dto.id` z aktywnym użytkownikiem — spóźniona odpowiedź
     `GET /me` użytkownika A lub spóźnione `PUT /profile` użytkownika A nie nadpisze nazwy użytkownika B,
     także gdy kod wywołujący nie ma własnej ochrony (ścieżki `SubscriptionStateService`, fasada, strona
     uzupełniania profilu).
3. **`switchUser` jest idempotentne** dla tego samego `userId` — `TOKEN_REFRESHED` w Supabase wywołuje
   `updateAuthState` ponownie z tym samym użytkownikiem; nazwa nie może wtedy zniknąć ani migać
   (scenariusz 12, przypadek brzegowy 13).
4. **Puste `username` z serwera jest prawdą** — `''` ustawia stan, `displayName` zwraca `null`
   (scenariusz 9). Wartość nie-string (`null`/`undefined`) jest ignorowana (traktowana jak „brak informacji").

### 4.3 Punkty integracji z istniejącymi serwisami

| # | Miejsce | Zmiana | Uzasadnienie |
|---|---|---|---|
| 1 | `AuthService.updateAuthState` | `currentUserState.switchUser(userId)` zaraz po `this.userId.set(userId)`; w gałęzi niezalogowanej `switchUser(null)` | Czyszczenie przy wylogowaniu/zmianie konta (scenariusz 13) |
| 2 | `AuthService.bootstrapAiCredits` | Po `subscriptionState.applyMe(me)` dodać `currentUserState.applyMe(me)` (za istniejącym guardem `expectedUserId`) | Główne zasilenie z jednego, już istniejącego `GET /me` (brak dodatkowego żądania) |
| 3 | `SubscriptionStateService.ensureLoaded` / `refresh` | W gałęzi sukcesu (wewnątrz guardu `generation`) `currentUserState.applyMe(me)`; **nie** w `applyMe()` serwisu subskrypcji | Przypadek brzegowy 13 (odświeżenie `/me` po płatności aktualizuje nazwę); jawnie, bez podwójnego wywołania z bootstrapu; `mapMeToSnapshot` pozostaje bez zmian |
| 4 | `ProfileSettingsFacade.saveProfile` (`next`) | `currentUserState.applyProfile(profile)` po ustawieniu lokalnego `profile` | Scenariusze 10, 12; **tylko** w `next` (scenariusz 11, przypadek 15) |
| 5 | `CompleteProfilePageComponent.handleSave` | Zachować odpowiedź `updateProfileSettings`, wywołać `currentUserState.applyProfile(profile)` **przed** `markComplete()` i nawigacją | Scenariusz 9 — ta strona zapisuje przez `ProfileSettingsApiService` **z pominięciem fasady** (patrz sekcja 7, uwaga 2) |

Brak zmian w: `MeApiService`, `ProfileSettingsApiService`, `ProfileCompletionService`, `AiCreditsService`,
`supabase/**`, `shared/contracts/**`.

---

## 5. Autoryzacja i bezpieczeństwo

- Brak nowych powierzchni ataku: żadnego nowego endpointu, żadnego nowego odczytu danych.
- Nazwa jest wartością kontrolowaną przez użytkownika → wyłącznie interpolacja Angulara / `[attr.aria-label]`
  (brak `innerHTML`, brak `bypassSecurityTrust*`) — przypadek brzegowy 4 (HTML w nazwie).
- Nazwa **nie** jest zapisywana w `localStorage`/`sessionStorage`/cookies; stan żyje tylko w pamięci karty
  i jest czyszczony przy wylogowaniu (scenariusz 13). Brak synchronizacji między kartami (przypadek 12).
- Dane widoczne tylko dla zalogowanego użytkownika (topbar w `MainLayout` za `authenticatedMatchGuard`);
  goście (`PublicLayout`) nie mają topbara.
- Logowanie błędów `/me` pozostaje w `AuthService` (`console.error`) — bez nowych logów z danymi osobowymi
  (nazwa użytkownika **nie** trafia do logów).

---

## 6. Pokrycie scenariuszy GWT przez API

| Scenariusz | Źródło danych | Zachowanie wymagane od warstwy API/stanu |
|---|---|---|
| 1, 2, 4, 5, 6, 14 | `GET /me` → `applyMe` | `displayName` = `trim(username)` |
| 3 | — | brak zależności od API (CSS) |
| 7 | `GET /me` w toku | `displayName === null`, dopóki brak odpowiedzi |
| 8 | `GET /me` błąd (500/401/sieć) | stan bez zmian (`null`), błąd logowany jak dotąd; brak toastów |
| 9 | `GET /me` → `''`; `PUT /profile` na `/auth/complete-profile` | `''` ⇒ `null`; po sukcesie `applyProfile` ⇒ nowa nazwa |
| 10 | `PUT /profile` 200 | `applyProfile`, **bez** `GET /me` |
| 11 | `PUT /profile` 409 / 5xx | brak wywołania `applyProfile` |
| 12 | `PUT /profile` 200, ta sama nazwa | `applyProfile` z tą samą wartością ⇒ sygnał bez zmiany (brak migotania) |
| 13 | `switchUser(null / B)`; spóźnione `GET /me` A | czyszczenie; odrzucenie `me.id !== aktywny` |
| 15 | — | brak zmian w API |

---

## 7. Uwagi i rozbieżności względem historyjki (zgłoszone)

1. **`PUT`/`PATCH`** — historyjka (sc. 10) wspomina `PATCH`; faktyczny kontrakt to `PUT /profile`. Plan używa `PUT`.
   Zalecana korekta brzmienia historyjki (bez wpływu na zachowanie).
2. **Strona `/auth/complete-profile` omija `ProfileSettingsFacade`** — `CompleteProfilePageComponent.handleSave`
   woła `ProfileSettingsApiService.updateProfileSettings` bezpośrednio, więc samo podpięcie fasady **nie spełni**
   scenariusza 9 („po uzupełnieniu nazwy topbar pokazuje nową nazwę"). Plan dodaje punkt integracji nr 5.
   Historyjka w „Powiązaniach" i DoD wskazuje tylko fasadę — wymaga uzupełnienia o test strony
   (`complete-profile-page.component.spec.ts` dziś **nie istnieje**).
3. **Wyścig tego samego użytkownika** (spóźniony stary `GET /me` po udanym `PUT /profile`) — poza zakresem
   historyjki (przypadek 15 dotyczy tylko zapisów). Okno jest bardzo wąskie (bootstrap `/me` kończy się przed
   interakcją użytkownika), więc plan **nie** wprowadza liczników wersji; ryzyko akceptowane i opisane.
   Stan zawsze zbiega do prawdy po F5 / kolejnym udanym `/me`.
4. **Brak ponowienia `GET /me`** po błędzie bootstrapu — nazwa pozostaje niewidoczna do następnego udanego
   `/me` (np. strony subskrypcji, `TOKEN_REFRESHED`, F5). Zgodne z historyjką (scenariusz 8), bez zmian.

---

## 8. Czego NIE robi PS-37 w warstwie API

| Element | Uwaga |
|---|---|
| Nowy endpoint / nowa Edge Function | Brak |
| Zmiana `GET /me`, `PUT /profile`, `GET /profile` | Brak |
| Zmiana `shared/contracts/types.ts` | Brak |
| Migracja SQL / RLS / RPC | Brak |
| Nowy endpoint `PATCH /profile` | Nie istnieje i nie jest planowany |
| Dodatkowe żądania sieciowe | Brak (wymaganie niefunkcjonalne) |
| Bezpośredni odczyt tabel z frontendu | Zabroniony (`frontend.mdc`) |
