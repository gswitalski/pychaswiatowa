# Jednolity model uprawnień — plan UI

## 1. Przegląd zmian

Brak nowych tras `/pricing` i `/account/subscription`. PREM-001 dopasowuje istniejące widoki i guardy do entitlements z `GET /me`.

| Widok / warstwa | Ścieżka | Zmiana |
|---|---|---|
| Ustawienia | `/settings` | Nowa karta „Plan i uprawnienia” (tylko odczyt). |
| Lista użytkowników | `/admin/users` | Kolumna statusu subskrypcji i chip efektywnego planu. |
| Dialog zmiany roli | overlay na `/admin/users` | Opis skutku `premium` (override) i `user` (cofnięcie override). |
| Wybór trybu kreatora | `/recipes/new/start` | Blokada AI na podstawie `effective_tier`, nie JWT. |
| Formularz przepisu | `/recipes/new`, `/recipes/:id/edit` | Przycisk zdjęcia AI lockowany entitlements. |
| Guard Premium | `/recipes/new/assist` | `premiumRoleMatchGuard` czyta entitlements. |
| Guard Admin | `/admin/*` | Bez zmian koncepcyjnych — tożsamość `admin`. |
| App Shell | layout | Bootstrap entitlements razem z `/me`. |

Desktop-first, Angular Material, istniejący App Shell (Sidebar + Topbar + Page Header + Footer). Gość nie widzi karty planu.

---

## 2. Warstwa frontendu (nie jest widokiem)

**Nowy obszar:** np. `src/app/core/services/entitlements.service.ts`  
**Źródło danych:** pole `entitlements` z istniejącego bootstrapu `GET /me` (App Shell).

Serwis trzyma sygnał `EntitlementsDto | null`. Po wylogowaniu czyści stan. Guardy i widoki **nie** dekodują JWT w celu gatingu Premium.

`AuthService.appRole()` pozostaje do tożsamości administratora (pozycja „Admin” w Topbarze, `adminRoleMatchGuard`). Gating Premium nie używa `appRole() === 'premium'`.

Dopóki `/me` się ładuje, chronione trasy Premium czekają na entitlements (spinner / blokada nawigacji). Fallback przed odpowiedzią: traktuj jak Free — lepiej odmówić niż pokazać AI na chwilę (uniknięcie migania, analogicznie do widoczności Admin w nawigacji).

---

## 3. Zmieniony widok: ustawienia

**Ścieżka:** `/settings`  
**Istniejący obszar:** `src/app/pages/settings/`  
**Auth:** zalogowany + uzupełniony `username`

Widok zachowuje karty „Dane konta” i „Bezpieczeństwo”. **Poniżej** karty danych konta, **powyżej** bezpieczeństwa, dodawana jest trzecia karta.

### 3.1. Nowa karta „Plan i uprawnienia”

`mat-card appearance="outlined"` w tym samym rytmie co `.settings-card`.

| Element | Opis UX |
|---|---|
| Tytuł | „Plan i uprawnienia”. |
| Etykieta planu | Jedna wyraźna wartość: **Free**, **Premium**, **Trial**, **Administrator**. Trial gdy `subscription_status = trial` i `effective_tier = premium`. Administrator gdy `capabilities.admin`. W pozostałych przypadkach Free vs Premium z `effective_tier`. |
| Status | Czytelna etykieta, nie surowy enum: „Brak subskrypcji”, „Okres próbny”, „Aktywna”, „Oczekuje na płatność”, „Anulowana (dostęp do końca okresu)”. |
| Źródło | Widoczne dla override: krótki tekst „Dostęp Premium nadany przez administratora.” Nie pokazuj `grant_source` jako technicznego kodu. |
| Data końca | Jeśli `current_period_end` nie jest puste: „Dostęp do {data}” (format lokalny PL). Ukryte gdy `null`. |
| Grace | Gdy `past_due` i jest `grace_period_end`: komunikat ostrzegawczy (`mat-icon` `warning`), np. „Płatność nieudana. Premium do {data}.” Nie strasz usunięciem przepisów. |
| Kredyty | Trzy wiersze pul: „Import tekst / URL”, „Import zdjęcia / skan”, „Zdjęcie AI”. Wartości w PREM-001: „Wkrótce” albo `0 / 0` z podpisem, że naliczanie ruszy później. Nie obiecuj nielimitowanego AI. |
| CTA `/pricing` | **Nieaktywne albo ukryte** — trasy jeszcze nie ma. Dopuszczalny szary tekst: „Porównanie planów będzie dostępne wkrótce.” Brak twardego przycisku „Kup”, który prowadzi donikąd. |

### 3.2. Stany karty

| Stan | Zachowanie |
|---|---|
| Ładowanie | Ten sam overlay / „Ładowanie ustawień…” co reszta strony; karta nie miga pustką. |
| Błąd `/me` lub profilu | Istniejący error-state strony; karta planu nie udaje danych. |
| Free | Etykieta Free, status „Brak subskrypcji”, bez daty końca, placeholdery kredytów. |
| Override | Etykieta Premium + zdanie o nadaniu przez administratora. |
| Admin | Etykieta Administrator; brak presji zakupowej. |
| `canceled` w okresie | Premium + data końca. |
| `past_due` w grace | Premium + warning grace. |

Karta jest **tylko do odczytu** — brak formularza, brak przycisku anulowania subskrypcji (PREM-007).

---

## 4. Zmieniony widok: lista użytkowników admina

**Ścieżka:** `/admin/users`  
**Istniejący obszar:** `src/app/pages/admin/admin-users/`

Tabela zachowuje kolumny: ID, login, username, daty, liczba przepisów, rola, akcje.

### 4.1. Nowe kolumny

| Kolumna | Zawartość |
|---|---|
| Plan | Chip `effective_tier`: Free (neutral) / Premium (accent). Dla admina chip „Admin” może zastąpić Premium albo stać obok roli — rola już ma własną kolumnę, więc tu wystarczy **Free / Premium**. |
| Subskrypcja | Etykieta statusu (`Brak` / `Trial` / `Aktywna` / `Po terminie` / `Anulowana`) oraz opcjonalnie skrócona data `current_period_end`. Tooltip z `grant_source` po polsku: „Nadane przez admina”, „Subskrypcja”, „Okres próbny”, „Brak”. |

Na wąskich ekranach kolumny planu i subskrypcji pozostają w poziomym scrollu tabeli (jak dziś ID i akcje) — bez osobnego layoutu kartkowego.

Sortowanie po nowych kolumnach nie jest wymagane w PREM-001.

### 4.2. Dialog „Zmień rolę użytkownika”

Istniejący `MatDialog`. Dodany krótki tekst pod wyborem roli (nie nowa strona):

- Wybór **Premium**: „Nadaje dostęp Premium bez płatności (override administratora). Obowiązuje od razu na serwerze; sesja użytkownika w przeglądarce odświeży uprawnienia przy następnym `GET /me` / ponownym wejściu.”
- Wybór **Użytkownik**: „Cofa override. Jeśli konto nie ma ważnej subskrypcji, straci funkcje Premium.”
- Wybór **Administrator**: bez zmiany sensu — pełne uprawnienia admina, w tym Premium.

Usunąć lub złagodzić zdanie „Zmiana zacznie obowiązywać po kolejnym zalogowaniu” w kontekście **funkcji Premium**: entitlements są liczone na serwerze od razu. JWT `app_role` nadal może być stale do czasu odświeżenia tokenu, ale AI i `/me` nie ufają samemu JWT.

Stany dialogu (ładowanie, sukces, 409, 403) bez zmian względem planu edycji ról.

Po sukcesie wiersz aktualizuje `role`, `effective_tier`, `subscription_status`, `grant_source` z odpowiedzi `PATCH`.

---

## 5. Zmieniony widok: wybór trybu tworzenia przepisu

**Ścieżka:** `/recipes/new/start`  
**Istniejący obszar:** `src/app/pages/recipes/recipe-new-start/`

Dziś `isPremiumLocked` = `authService.appRole() === 'user'`.

Docelowo: `isPremiumLocked = entitlements.effective_tier !== 'premium'` (albo `!capabilities.ai_assist`).

| Element | Zachowanie |
|---|---|
| Karta „Pusty formularz” | Bez zmian — wszyscy zalogowani. |
| Karta „Z tekstu lub zdjęcia (AI)” | Badge Premium zostaje. Gdy lock: karta nieaktywna, tooltip / krótki tekst „Dostępne w Premium”. Klik nie nawiguje. |
| Admin i override | Karta odblokowana — jak dziś dla JWT `premium`/`admin`. |
| Stary JWT `premium` + Free | Karta **zablokowana** (to główna zmiana UX względem MVP). |

Nie dodawać tu przycisku „Kup Premium” prowadzącego do nieistniejącego `/pricing`.

---

## 6. Zmieniony widok: formularz przepisu (zdjęcie AI)

**Ścieżka:** `/recipes/new`, `/recipes/:id/edit`  
**Istniejący obszar:** `src/app/pages/recipes/recipe-form/`

`isAiPremiumFeatureLocked` przechodzi z `appRole() === 'user'` na `effective_tier !== 'premium'`.

Przycisk AI pozostaje widoczny dla zalogowanych (jak dziś `isAiImageButtonVisible`), ale disabled + tooltip przy locku. Wywołanie API i tak wróci `403 FEATURE_LOCKED` — UI nie jest autoryzacją.

Obsługa błędu 403: istniejący `AiImagePremiumRequiredError`; treść komunikatu może zostać („wymaga Premium”), bez CTA checkout.

---

## 7. Guardy i `/forbidden`

### 7.1. `premiumRoleMatchGuard`

**Plik:** `src/app/core/guards/premium-role-match.guard.ts`  
**Trasa:** `/recipes/new/assist`

1. Brak sesji → istniejący AuthGuard wcześniej na rodzicu (bez zmian).
2. Poczekaj na załadowane entitlements z `/me`.
3. `effective_tier === 'premium'` → `true`.
4. W przeciwnym razie `navigate(['/forbidden'])` i `false`.

Nie używać `authService.appRole() === 'premium' || === 'admin'` jako jedynego warunku.

Testy guarda: Free → forbidden; override / trial w terminie / admin → pass; JWT premium + entitlements free → forbidden.

### 7.2. `adminRoleMatchGuard`

Bez zmiany kryterium: wyłącznie `app_role === 'admin'`. Konto Premium (override lub przyszła subskrypcja) nie widzi „Admin” i nie wchodzi na `/admin/*`.

### 7.3. Widok `/forbidden`

Bez nowego layoutu. Istniejący komunikat 403 jest wystarczający. Opcjonalnie (niekrytyczne): jedno zdanie „Ta funkcja wymaga planu Premium” gdy wejście było z guarda Premium — bez linku do `/pricing`.

---

## 8. Przepływy użytkownika

### 8.1. Free otwiera asystę AI

1. Użytkownik na `/recipes/new/start` widzi zablokowaną kartę AI.
2. Ręczne wejście na `/recipes/new/assist` → guard → `/forbidden`.
3. Podrobione żądanie `POST /ai/recipes/draft` → `403 FEATURE_LOCKED`.

### 8.2. Admin nadaje Premium testerowi

1. Admin na `/admin/users` otwiera dialog, wybiera Premium, czyta informację o override.
2. Zapis → wiersz: rola Premium, plan Premium, subskrypcja „Brak”, tooltip „Nadane przez admina”.
3. Tester odświeża aplikację (lub wraca z tła → ponowny `/me`): `/settings` pokazuje Premium + informację o nadaniu; karta AI odblokowana.

### 8.3. Wygasły JWT `premium`

1. `/me` zwraca `effective_tier: free`.
2. Ustawienia: Free. Kreator: lock AI. Guard: `/forbidden`.
3. Topbar nie pokazuje Admin (chyba że tożsamość admin).

---

## 9. Responsywność i dostępność

- Karta planu na `/settings`: pełna szerokość kolumny ustawień; na mobile stack pionowy (etykieta, status, daty, pule).
- Chip planu: kontrast zgodny z istniejącymi `roleTone` na liście admina.
- Tooltipi i `aria-label` na zablokowanej karcie AI i przycisku zdjęcia AI.
- Nie polegać na kolorze jako jedynym nośniku statusu (`past_due` ma też tekst).

## 10. Poza zakresem UI

- Strona `/pricing`, checkout, faktury, anulowanie odnowienia.
- Dedykowany ekran zużycia Storage i progi 70–80% (PREM-003).
- Baner reklamowy i jego ukrywanie w runtime.
- Wymuszone wylogowanie po zmianie roli.
- Nowa pozycja w Bottom Barze ani Sidebarze.
