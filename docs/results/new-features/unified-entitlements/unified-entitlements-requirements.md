# Jednolity model uprawnień (entitlements) — wymagania

## 1. Cel

Wprowadzenie jednego źródła prawdy o tym, co konto może zrobić (tożsamość roli, status subskrypcji, trial, kredyty, limity Free), tak aby UI i backend konsekwentnie pozwalały albo odmawiały dostępu do funkcji Premium.

Funkcja realizuje historyjkę **PREM-001** z `docs/historyjki-premium.md`. Rozszerza istniejący RBAC (`US-035`: `app_role` w JWT) o warstwę **entitlements** liczoną po stronie serwera. Nie zastępuje CRUD przepisów, auth ani panelu admina — zmienia sposób podejmowania decyzji o dostępie.

Źródłem prawdy jest tabela PostgreSQL `account_entitlements` oraz wspólny resolver w Edge Functions. Claim JWT `app_role` pozostaje **tożsamością i podpowiedzią (cache)**; nie jest samodzielną podstawą do przyznania Premium.

## 2. Zakres funkcjonalny

1. Istnieje warstwa uprawnień (frontend + backend) zwracająca dla zalogowanej sesji:
    - `app_role` (`user` / `premium` / `admin`),
    - `effective_tier` (`free` / `premium`),
    - status subskrypcji (`none` / `trial` / `active` / `past_due` / `canceled`),
    - źródło grantu (`none` / `subscription` / `trial` / `admin_override`),
    - datę końca okresu (`current_period_end`) oraz ewentualny koniec grace (`grace_period_end`),
    - pozostałe kredyty per pula (`import_text_url`, `import_image`, `image_generate`) — kontrakt z wartościami zerowymi do czasu PREM-002,
    - zestaw `capabilities` (m.in. `ai_assist`, `ai_image`, `ads_disabled`, `admin`).
2. Konto z `app_role = admin` ma co najmniej uprawnienia Premium (bez reklam, dostęp do funkcji Premium) oraz dostęp do `/admin/*`. Admin nie wymaga subskrypcji.
3. Guardy Angular i Edge Functions nie polegają wyłącznie na ukryciu przycisku w UI — decyzja jest weryfikowana po stronie serwera na podstawie resolvera entitlements.
4. Brak ważnego grantu (subskrypcja / trial / grace / admin override) = traktowanie jak Free (`user`), nawet jeśli w JWT kiedyś była rola `premium`.
5. Administrator może nadać Premium bez płatności (`grant_source = admin_override`) przez istniejącą zmianę roli na `premium`. Ustawienie roli `user` cofa override; jeśli nie ma ważnej subskrypcji ani trialu, konto staje się Free.
6. Ekran `/settings` pokazuje stan planu i uprawnień (tylko odczyt). Lista `/admin/users` pokazuje status subskrypcji i efektywny tier.
7. Istniejące endpointy AI (`POST /ai/recipes/draft`, `POST /ai/recipes/image`) sprawdzają `effective_tier`, a nie wyłącznie claim JWT.

## 3. Historyjki użytkownika

### PREM-001 — Jednolity model uprawnień (entitlements)

**Jako** system  
**chcę** jedno źródło prawdy o tym, co konto może zrobić (rola, trial, kredyty, limity Free)  
**aby** UI i backend konsekwentnie odmawiały lub pozwalały na funkcje Premium.

#### Kryteria akceptacji

1. Dla każdej zalogowanej sesji backend zwraca kompletny obiekt entitlements: `app_role`, `effective_tier`, `subscription_status`, `grant_source`, `current_period_end`, `grace_period_end`, pozostałe kredyty per pula oraz `capabilities`.
2. Resolver działa identycznie dla `GET /me` (bootstrap App Shell) i dla Edge Functions chroniących funkcje Premium.
3. Konto `admin` ma `effective_tier = premium`, `capabilities.admin = true`, `capabilities.ads_disabled = true` oraz dostęp do `/admin/*`, niezależnie od statusu subskrypcji.
4. Konto bez ważnego grantu ma `effective_tier = free`, nawet gdy JWT zawiera `app_role = premium`.
5. Status `past_due` zachowuje Premium do `grace_period_end` (domyślnie 3 dni od wejścia w `past_due`).
6. Status `canceled` z datą `current_period_end` w przyszłości zachowuje Premium do końca opłaconego okresu; po tej dacie konto jest Free.
7. Pule kredytów są obecne w kontrakcie (`import_text_url`, `import_image`, `image_generate`) z wartościami `remaining = 0` i `limit = 0` do czasu wdrożenia ledgeru PREM-002. PREM-001 **nie** odmawia AI kodem `NO_CREDITS`.
8. Ukrycie przycisku, badge albo trasy w UI nie jest mechanizmem autoryzacji — serwer ponownie wylicza uprawnienia przy każdym chronionym żądaniu.

### PREM-001-FE — Guardy i App Shell oparte o entitlements

**Jako** zalogowany użytkownik  
**chcę** żeby interfejs pokazywał mi funkcje zgodne z rzeczywistym stanem mojego konta  
**aby** nie wchodzić na ekrany Premium, do których serwer i tak mi odmówi, oraz żeby wygasła subskrypcja nie zostawiała mi „fałszywego” Premium z starego JWT.

#### Kryteria akceptacji

1. App Shell przy starcie sesji pobiera entitlements z `GET /me` i przechowuje je w serwisie (sygnał / BehaviorSubject), analogicznie do obecnego bootstrapu profilu.
2. Guard trasy `/recipes/new/assist` (`premiumRoleMatchGuard`) wpuszcza wyłącznie przy `effective_tier = premium` (w tym admin). Odczyt roli wyłącznie z JWT jest niewystarczający.
3. Ekran wyboru trybu tworzenia przepisu (`/recipes/new/start`) pokazuje badge i dostępność asysty AI na podstawie entitlements, nie na podstawie `authService.appRole()` z tokenu.
4. Gdy entitlements wskazują Free, a JWT nadal ma `premium`, użytkownik jest traktowany jak Free: asysta AI i generowanie zdjęcia są zablokowane, a wejście na chronioną trasę kończy się `/forbidden`.
5. Guard `/admin/*` (`adminRoleMatchGuard`) nadal opiera się na tożsamości `app_role = admin`, a nie na `effective_tier`.
6. Na `/settings` widoczna jest karta „Plan i uprawnienia” z etykietą planu, statusem, datą końca okresu (jeśli dotyczy) oraz placeholderami pul kredytów.
7. Gość nie widzi karty planu; brak sesji nie wywołuje resolvera entitlements.

### PREM-001-ADMIN — Nadanie i odczyt uprawnień z panelu administratora

**Jako** zalogowany administrator  
**chcę** nadać lub odebrać Premium bez płatności oraz widzieć status subskrypcji na liście użytkowników  
**aby** obsługiwać testerów, refundy i support zanim powstanie checkout (PREM-005 / PREM-006).

#### Kryteria akceptacji

1. Tabela `/admin/users` pokazuje obok roli: `effective_tier`, `subscription_status` oraz `grant_source` (lub równoważne czytelne etykiety).
2. Zmiana roli na `premium` przez istniejący dialog ustawia `grant_source = admin_override` i daje `effective_tier = premium` bez subskrypcji.
3. Zmiana roli na `user` cofa `admin_override`. Jeśli konto nie ma ważnej subskrypcji, trialu ani grace — `effective_tier = free`. Jeśli ma ważny grant z płatności/trialu (przyszły PREM-006) — pozostaje Premium z `grant_source = subscription` albo `trial`.
4. Zmiana roli na `admin` nadaje tożsamość administratora; entitlements dają co najmniej Premium plus `capabilities.admin`.
5. Nadal obowiązują istniejące reguły: zakaz zmiany własnej roli, ochrona ostatniego administratora, wyłącznie `admin` może wywołać `PATCH`.
6. Sama widoczność kolumny i dialogu nie jest autoryzacją — backend weryfikuje JWT admina i zapisuje entitlements w tej samej operacji co `app_role`.
7. Po zmianie roli wiersz tabeli odświeża zarówno `role`, jak i pola entitlements bez pełnego przeładowania strony.

## 4. Reguły biznesowe i bezpieczeństwa

| Reguła | Opis |
|---|---|
| Źródło prawdy uprawnień | Tabela `account_entitlements` + resolver serwerowy. JWT `app_role` jest tożsamością (`admin`) i cache roli; **nie** przyznaje samodzielnie Premium. |
| Tożsamość vs uprawnienie | `app_role` w `auth.users.raw_app_meta_data` pozostaje. Tabela `profiles` nadal nie przechowuje roli ani subskrypcji. |
| Priorytet grantów | `admin` (tożsamość) > `admin_override` > ważna subskrypcja / trial / grace (`trial`, `active`, `past_due` w grace, `canceled` do `current_period_end`) > Free. |
| Stary JWT `premium` | Brak ważnego grantu = Free. Edge Function nie może wpuścić użytkownika wyłącznie na podstawie claimu. |
| Admin | Zawsze `effective_tier = premium` oraz dostęp do `/admin/*`. Nie wymaga wiersza subskrypcji w statusie `active`. |
| Admin override | Ręczne `premium` z panelu = Premium bez płatności. Nie ustawia `subscription_status = active`. |
| `past_due` | Premium do `grace_period_end` (konfiguracja: `ENTITLEMENTS_GRACE_DAYS`, domyślnie 3). Po grace = Free, dopóki webhook PREM-006 nie przywróci `active`. |
| `canceled` | Premium do `current_period_end` włącznie (koniec opłaconego okresu), potem Free. |
| `trial` | Status i daty są w modelu. Start trialu i zakaz drugiego trialu należą do PREM-005; PREM-001 tylko honoruje już zapisany trial. |
| Kredyty | Kontrakt trzech pul z zerami. Brak ledgeru, brak 402 `NO_CREDITS`. Gating AI w PREM-001 = `effective_tier`. |
| Zaufanie do klienta | Klient może pokazywać lub ukrywać UI. Każde chronione wywołanie (AI, admin, przyszłe importy URL) ponownie liczy entitlements na serwerze. |
| Dostęp do `/admin/*` | Wyłącznie tożsamość `app_role = admin` w JWT (jak dziś). `effective_tier = premium` nie otwiera panelu admina. |
| Zapis entitlements | Użytkownik ma SELECT własnego wiersza. INSERT/UPDATE/DELETE tylko service role lub RPC administracyjne / przyszłe webhooki. |
| Backfill | Istniejące konta z `app_role = premium` (testerzy) otrzymują `grant_source = admin_override`, aby nie stracić dostępu po wdrożeniu. |

### 4.1. Algorytm `effective_tier` (skrót)

1. Brak sesji → brak entitlements (gość).
2. Jeśli `app_role = admin` → `premium` + `capabilities.admin`.
3. W przeciwnym razie, jeśli `grant_source = admin_override` → `premium`.
4. W przeciwnym razie, jeśli status `trial` albo `active` i `now < current_period_end` → `premium`.
5. W przeciwnym razie, jeśli status `past_due` i `now < grace_period_end` → `premium`.
6. W przeciwnym razie, jeśli status `canceled` i `now < current_period_end` → `premium`.
7. W przeciwnym razie → `free` (nawet przy JWT `premium`).

`capabilities.ai_assist` i `capabilities.ai_image` są `true` wyłącznie przy `effective_tier = premium`. `capabilities.ads_disabled` jest `true` przy `effective_tier = premium`. Wartości te przygotowują UI na reklamy (PREM-013); w PREM-001 nie ma jeszcze serwowania reklam.

## 5. Zależności

| Zależność | Znaczenie |
|---|---|
| `US-035` | Rola w JWT (`user` / `premium` / `admin`) — tożsamość, nie jedyne źródło Premium. |
| `US-ADM-003` / `US-ADM-004` | Lista użytkowników i zmiana roli — rozszerzane o entitlements. |
| `US-036` / `US-037` | Asysta AI i zdjęcie AI — gating przechodzi z JWT na `effective_tier`. |
| PREM-002 | Ledger kredytów wypełni zera w kontrakcie i doda 402 `NO_CREDITS`. |
| PREM-005 / PREM-006 | Checkout i webhook ustawią `subscription` / `trial` / `active`; PREM-001 dostarcza model i odczyt. |
| PREM-003 / PREM-004 | Pełny ekran zużycia i `/pricing` — poza tym ficerem. |

## 6. Poza zakresem

- Checkout, operator płatności, trial startujący z rejestracji lub z `/pricing` (PREM-004, PREM-005).
- Webhooki płatności i automatyczna synchronizacja `app_role` po opłaceniu (PREM-006).
- Ledger kredytów, odejmowanie po udanej operacji, idempotencja retry, 402 `NO_CREDITS` (PREM-002).
- Publiczna strona `/pricing` i dedykowana trasa `/account/subscription`.
- Pełny ekran zużycia Storage i progi 70–80% z CTA zakupu (PREM-003) — PREM-001 pokazuje tylko skrót statusu i placeholdery pul.
- Egzekwowanie limitów Free: przestrzeń zdjęć, szerokość planu, cap antyspamowy liczby przepisów.
- Serwowanie reklam i ich wyłączanie w runtime (flaga `ads_disabled` jest w kontrakcie).
- Konto rodzinne, import z URL, planer tygodniowy.
- Custom Access Token Hook wymuszający świeży claim przy każdym odświeżeniu JWT — JWT pozostaje cache, resolver i tak czyta bazę.
- Wymuszone wylogowanie użytkownika po zmianie entitlements.
- Audyt historii zmian grantów (osobny ticket admina).
