# Kopia produkcji (staging) – PychaŚwiatowa

## Cel

Instrukcja opisuje, jak postawić **drugą, w pełni niezależną kopię aplikacji**
na tych samych hostingach co produkcja (**Supabase Cloud** + **Firebase
Hosting**) i jak ją wdrażać. Kopia służy do sprawdzania zmian (migracje,
Edge Functions, UI, płatności w trybie testowym) zanim trafią na `main`.

**Główny scenariusz:** kopia najpierw odtwarza **stan produkcji** (kod z
`main` + anonimizowane dane z produkcji), a dopiero potem wdrażasz na nią
`develop`, żeby **przetestować jego migracje na prawdziwych danych**
(Krok 12). Kolejność ma znaczenie – patrz [Krok 12](#krok-12-test-migracji-developa-na-danych-z-main).

**Założenia:**

- Repozytorium jest na **GitHubie** (`github.com/gswitalski/pychaswiatowa`),
  a pipeline to **GitHub Actions** – instrukcja nie dotyczy GitLaba.
- Produkcja (`main` → `.github/workflows/main-deploy.yml`) **nie jest
  zmieniana** przez tę instrukcję.
- Dokument powstał na podstawie analizy kodu i dokumentacji. Polecenia nie
  były uruchamiane na prawdziwych projektach, więc **po pierwszym przejściu
  całości** popraw wszystko, co się nie zgodzi (patrz
  [Troubleshooting](#troubleshooting)).

## Spis treści

1. [Rekomendowane rozwiązanie](#1-rekomendowane-rozwiązanie)
2. [Jak dziś wdrażana jest produkcja](#2-jak-dziś-wdrażana-jest-produkcja)
3. [Architektura kopii](#3-architektura-kopii)
4. [Wymagania wstępne](#4-wymagania-wstępne)
5. [Krok 1: Projekt Supabase](#krok-1-projekt-supabase-kopii)
6. [Krok 2: Projekt Firebase](#krok-2-projekt-firebase-kopii)
7. [Krok 3: GitHub Environment i sekrety](#krok-3-github-environment-i-sekrety)
8. [Krok 4: Workflow wdrożenia](#krok-4-workflow-wdrożenia-staging-deployyml)
9. [Krok 5: Pierwsze wdrożenie](#krok-5-pierwsze-wdrożenie-schemat-funkcje-frontend)
10. [Krok 6: Dane z anonimizacją](#krok-6-dane-produkcyjne-z-anonimizacją)
11. [Krok 7: Zadania cron](#krok-7-zadania-cron-i-sekret-workera)
12. [Krok 8: Konfiguracja Auth](#krok-8-konfiguracja-auth-w-supabase)
13. [Krok 9: Stripe (tryb testowy)](#krok-9-stripe-tryb-testowy)
14. [Krok 10: Zdjęcia przepisów](#krok-10-zdjęcia-przepisów-opcjonalnie)
15. [Krok 11: Testy dymne](#krok-11-testy-dymne)
16. [Krok 12: Test migracji `develop` na danych z `main`](#krok-12-test-migracji-developa-na-danych-z-main)
17. [Codzienna praca](#codzienna-praca)
18. [Odświeżanie danych](#odświeżanie-danych-kopii)
19. [Powrót do stanu `main` (powtórzenie testu migracji)](#powrót-do-stanu-main-powtórzenie-testu-migracji)
20. [Bezpieczeństwo i RODO](#bezpieczeństwo-i-rodo)
21. [Troubleshooting](#troubleshooting)
22. [Rozwój: wspólny workflow](#rozwój-wspólny-workflow-dla-main-i-develop)

---

## 1. Rekomendowane rozwiązanie

| Decyzja | Wybór | Dlaczego |
|---------|-------|----------|
| Platforma CI/CD | GitHub Actions (jak produkcja) | Brak nowych narzędzi; ten sam zestaw akcji i sekretów |
| Wyzwalacz | **Automatycznie po pushu do `develop` i `staging/**`** + **ręczne uruchomienie** z wyborem gałęzi | Zwykła praca nie wymaga klikania; `staging/baseline` służy do wdrożenia stanu `main`; dowolną gałąź funkcjonalną można sprawdzić przed scaleniem |
| Kolejność pierwszego uruchomienia | **1) `main` (baza) → 2) dane z produkcji → 3) `develop`** | Migracje z `develop` działają na bazie z danymi produkcyjnymi, a nie na pustej |
| Frontend | **Osobny projekt Firebase** (np. `pychaswiatowa-staging`) | Własne konto serwisowe, pełna izolacja od produkcji |
| Backend | **Osobny projekt Supabase** | Własna baza, Auth, Storage, sekrety i cron |
| Sekrety | **GitHub Environment `staging`** | Te same nazwy sekretów co na produkcji, bez ryzyka pomylenia wartości |
| Dane | Kopia danych produkcyjnych z **anonimizacją** | Realistyczne dane, ale bez e-maili, haseł, płatności i prywatnych notatek |
| Integracje | Stripe w trybie testowym, osobne klucze AI z limitem budżetu | Kopia nie generuje prawdziwych płatności ani kosztów |

**Przepływ pracy po wdrożeniu rozwiązania:**

```
JEDNORAZOWO (przygotowanie kopii):
  staging/baseline (= main + plik workflow) ──push──▶ STAGING w stanie produkcji
  dane z produkcji (anonimizowane) ──────────────────▶ STAGING
  develop ──push──▶ STAGING  ◀── test migracji na danych (Krok 12)

CODZIENNIE:
  gałąź funkcjonalna ──PR──▶ develop ──push──▶ STAGING (automatycznie)
                                    │
                                    └──PR──▶ main ──push──▶ PRODUKCJA (automatycznie, bez zmian)
```

Zalety: migracje i funkcje najpierw trafiają na kopię, więc błędy wychodzą
przed produkcją. `develop` jest dziś przed `main` (12 commitów), więc **nie
pushuj `develop` na kopię przed Krokiem 12** – pierwsze wdrożenie ma być
z `main`.

---

## 2. Jak dziś wdrażana jest produkcja

Plik: `.github/workflows/main-deploy.yml`, wyzwalacz: `push` do `main`.

```
push do main
    │
    ├── test        (Vitest: npm run test:run)
    ├── test-deno   (deno test supabase/functions)
    ├── lint        (npm run lint)
    └── build       (build produkcyjny z wartościami zastępczymi)
            │  wszystkie 4 muszą się udać
            ▼
    deploy-backend   supabase link → db push → secrets set → functions deploy
            │
            ▼
    deploy-frontend  generuje environment.production.ts z sekretów
                     → npm run build → Firebase Hosting (projekt pychaswiatowa, kanał live)
```

**Uwagi z analizy, które wpływają na kopię:**

1. Krok `supabase secrets set` ustawia tylko część sekretów (`APP_PUBLIC_URL`,
   `OPENAI_API_KEY`, `GEMINI_API_KEY`, `AI_*`). Pozostałe (`STRIPE_*`,
   `INTERNAL_WORKER_SECRET`, `APP_BASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`,
   `SUBSCRIPTION_TERMS_VERSION`, `BILLING_EXPIRY_GRACE_DAYS`) ustawia się
   ręcznie. Workflow kopii zachowuje się inaczej – patrz Krok 4.
2. Krok `secrets set` na produkcji **nadpisuje pustą wartością** sekret, którego
   nie ma w GitHub Secrets. Workflow kopii pomija puste wartości.
3. Kod czyta `APP_BASE_URL` (checkout, webhook), a workflow produkcji ustawia
   `APP_PUBLIC_URL`. Na kopii ustaw **oba**.
4. Zadania cron `normalized-ingredients-worker` i `billing-expire-subscriptions`
   oraz funkcja `public.get_internal_worker_secret()` **nie są w migracjach** –
   zakłada się je ręcznie w SQL. Kopia wymaga tego samego (Krok 7).
5. `docs/deployment/ci-cd-pipeline.md` jest częściowo nieaktualny (opisuje 3 joby
   i plik `environment.prod.ts`, a workflow ma 6 jobów i generuje
   `environment.production.ts`).

---

## 3. Architektura kopii

| Zasób | Produkcja | Kopia (staging) |
|-------|-----------|-----------------|
| Gałąź | `main` | `staging/baseline` (stan `main`, jednorazowo), potem `develop` (+ ręcznie dowolna) |
| Workflow | `main-deploy.yml` | `staging-deploy.yml` (nowy) |
| Supabase | projekt produkcyjny | **nowy projekt** (`<STAGING_REF>`) |
| Firebase | projekt `pychaswiatowa` | **nowy projekt** (np. `pychaswiatowa-staging`) |
| Adres frontendu | `https://pychaswiatowa.pl` / `pychaswiatowa.web.app` | `https://<projekt-firebase>.web.app` |
| Sekrety GitHub | sekrety repozytorium | **Environment `staging`** |
| Stripe | tryb live | tryb testowy |
| Dane | prawdziwe | anonimizowana kopia |

---

## 4. Wymagania wstępne

Konta i uprawnienia:

- właściciel organizacji Supabase (tworzenie projektów),
- właściciel/edytor w Google Cloud/Firebase (tworzenie projektu),
- administrator repozytorium GitHub (Environments, sekrety),
- dostęp do Stripe (tryb testowy), OpenAI, Google AI Studio, Resend.

Narzędzia lokalne (Windows, PowerShell):

```powershell
node --version        # 20.x
supabase --version    # Supabase CLI
docker version        # wymagany przez `supabase db dump`
psql --version        # klient PostgreSQL
gh --version          # opcjonalnie, GitHub CLI
```

Jeżeli `psql` nie jest dostępny, zainstaluj wersję zgodną z PostgreSQL projektu:

```powershell
winget install --id PostgreSQL.PostgreSQL.17 --exact
```

Instalator może nie dodać klienta do bieżącego `PATH`. Wtedy otwórz nowe
okno PowerShell albo ustaw tymczasowo:

```powershell
$env:Path += ';C:\Program Files\PostgreSQL\17\bin'
psql --version
```

**Zasady bezpieczeństwa pracy z dwiema bazami:**

- **Nie wykonuj `supabase link` lokalnie.** Wszystkie polecenia lokalne
  podawaj z jawnym `--db-url` / `--project-ref`, żeby przypadkowo nie zapisać
  nic na produkcji. Sprawdź, czy repozytorium nie jest podlinkowane:
  `Get-Content supabase\.temp\project-ref -ErrorAction SilentlyContinue`.
- Połączenia do produkcji używaj **wyłącznie do odczytu** (dump, `\copy`).
- Pliki z danymi z produkcji trzymaj **poza repozytorium** (np.
  `$env:TEMP\ps-staging`) i usuń po zakończeniu.

Przygotuj katalog roboczy i zmienne sesji. URI wprowadzaj przez `Read-Host`,
żeby nie zapisały się w historii PowerShell. Używaj **wyłącznie Session
Poolera** (port `5432`), ponieważ połączenie bezpośrednie wymaga IPv6 i nie
działa z części sieci ani GitHub Actions. Jeżeli hasło zawiera `@`, `:`, `/`,
`?`, `#` lub `%`, zakoduj je jako URL-encoded przed wklejeniem do URI.

```powershell
$work = Join-Path $env:TEMP 'ps-staging'
New-Item -ItemType Directory -Force -Path $work | Out-Null

$env:STAGING_REF = '<STAGING_REF>'
$env:STAGING_DB_URL = Read-Host 'Wklej Session Pooler URI staging'
$env:PROD_DB_URL = Read-Host 'Wklej Session Pooler URI produkcji'

$env:STAGING_DB_URL -like "*$($env:STAGING_REF)*" # musi zwrócić True
$env:STAGING_DB_URL -ne $env:PROD_DB_URL          # musi zwrócić True
```

---

## Krok 1: Projekt Supabase kopii

1. Supabase Dashboard → **New project**.
    - Organizacja: ta sama co produkcja.
    - Nazwa: np. `pychaswiatowa-staging`.
    - **Region: taki sam jak produkcja** (Dashboard produkcji → *Project
      Settings → General*).
    - Hasło bazy: wygeneruj silne, zapisz w menedżerze haseł
      (to będzie `SUPABASE_DB_PASSWORD`).
2. Zapisz **Reference ID** (*Project Settings → General*) – to `<STAGING_REF>`.
3. *Project Settings → API Keys*: zapisz **Project URL**
   (`https://<STAGING_REF>.supabase.co`) oraz klucz **Publishable** (albo
   legacy **anon**). Klucz Secret (`sb_secret_…`, następca `service_role`) jest
   potrzebny tylko tymczasowo w Kroku 10.
4. *Project Overview → Connect → Direct → Session pooler* → skopiuj URI
   (kompatybilne z IPv4, w odróżnieniu od połączenia bezpośredniego). Format:
   `postgresql://postgres.<STAGING_REF>:<HASŁO>@aws-<n>-<region>.pooler.supabase.com:5432/postgres`.
5. To samo dla produkcji → `$env:PROD_DB_URL` (hasło bazy produkcji).
6. Sprawdź, które rozszerzenia ma produkcja (*Database → Extensions*) i
   upewnij się, że kopia ma te same. Migracje same tworzą `pg_cron` i `pg_net`,
   ale jeśli czegoś brakuje, włącz ręcznie.
7. Plan: darmowy plan pozwala na ograniczoną liczbę aktywnych projektów i
   **pauzuje nieaktywne** (cron i funkcje wtedy nie działają). Sprawdź aktualny
   cennik Supabase przed utworzeniem projektu.

---

## Krok 2: Projekt Firebase kopii

1. [Firebase Console](https://console.firebase.google.com) → utwórz osobny
   projekt, np. `pychaswiatowa-staging`. Zapisz **Project ID** i zaktualizuj
   `.firebaserc`, aby `projects.default` wskazywał ten projekt.
2. *Build → Hosting* → **Get started** (włącza Hosting; wystarczy kliknąć
   dalej, wdrożenie zrobi workflow).
3. Konto serwisowe do CI: *Project settings → Service accounts → Generate new
   private key*. Zapisany JSON będzie sekretem `FIREBASE_SERVICE_ACCOUNT_STAGING`.
   Jeśli wdrożenie zwróci błąd 403, nadaj temu kontu rolę
   **Firebase Hosting Admin** w Google Cloud → IAM.
4. Adres kopii: `https://<PROJECT_ID>.web.app`.

> Autoryzacja użytkowników odbywa się w Supabase, więc nie dodawaj domen w
> Firebase Authentication.

---

## Krok 3: GitHub Environment i sekrety

1. GitHub → repozytorium → **Settings → Environments → New environment** →
   nazwa dokładnie `staging`.
2. *Deployment branches*: zostaw **No restriction** (ręczne wdrożenie dowolnej
   gałęzi) albo wybierz *Selected branches* i dodaj `develop`, `staging/*` oraz
   wzorce np. `feature/*`, `PS-*`.
3. Dodaj **Environment variables** (`vars`):

| Zmienna | Wartość |
|---------|---------|
| `FIREBASE_PROJECT_ID` | Project ID z Kroku 2 |

4. Dodaj **Environment secrets** (tylko dla `staging`; ta sama nazwa na
   produkcji pozostaje w sekretach repozytorium – workflow produkcji nie jest
   zmieniany):

| Sekret | Źródło | Wymagany |
|--------|--------|----------|
| `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens | tak |
| `SUPABASE_PROJECT_ID` | `<STAGING_REF>` | tak |
| `SUPABASE_DB_PASSWORD` | hasło bazy kopii | tak |
| `SUPABASE_URL` | Project URL kopii | tak |
| `SUPABASE_ANON_KEY` | klucz Publishable (lub legacy anon) kopii | tak |
| `STAGING_DB_URL` | pełny URI **Session Poolera** kopii, z URL-encoded hasłem | tak |
| `FIREBASE_SERVICE_ACCOUNT_STAGING` | JSON z Kroku 2 (cała zawartość pliku) | tak |
| `APP_BASE_URL` | `https://<PROJECT_ID>.web.app` | tak |
| `APP_PUBLIC_URL` | to samo co `APP_BASE_URL` | tak |
| `INTERNAL_WORKER_SECRET` | losowy (wygeneruj poniżej), **inny niż na produkcji** | tak |
| `OPENAI_API_KEY` | **osobny** klucz/projekt OpenAI z limitem budżetu | tak |
| `GEMINI_API_KEY` | **osobny** klucz Gemini | tak |
| `AI_DRAFT_CREDITS_FREE`, `AI_DRAFT_CREDITS_PREMIUM`, `AI_IMAGE_CREDITS_PREMIUM`, `AI_CREDITS_WARN_THRESHOLD_PERCENT`, `AI_CREDITS_CRON_SECRET` | jak na produkcji (wartości liczbowe) | zalecane |
| `STRIPE_SECRET_KEY` | Stripe **tryb testowy**, klucz `rk_test_…` (Krok 9) | do płatności |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` webhooka testowego (Krok 9) | do płatności |
| `STRIPE_PRICE_PREMIUM_MONTHLY_RECURRING`, `STRIPE_PRICE_PREMIUM_YEARLY_RECURRING` | identyfikatory cen testowych `price_…` | do płatności |
| `SUBSCRIPTION_TERMS_VERSION`, `BILLING_EXPIRY_GRACE_DAYS` | jak na produkcji | do płatności |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend (opcjonalnie) | nie |
| `PLAN_LIMIT_FREE`, `NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE` | opcjonalne nadpisania wartości domyślnych | nie |

Wygenerowanie `INTERNAL_WORKER_SECRET`:

```powershell
$bytes = New-Object Byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:INTERNAL_WORKER_SECRET = [Convert]::ToBase64String($bytes)
$env:INTERNAL_WORKER_SECRET   # skopiuj do sekretu GitHub i zachowaj na Krok 7
```

Sekrety Stripe możesz dodać później (Krok 9) – workflow pomija puste wartości,
więc brak sekretu nie nadpisze niczego pustym ciągiem.

### Minimalny zakres `SUPABASE_ACCESS_TOKEN`

Utwórz token ograniczony do projektu staging. W aktualnym Dashboardzie ustaw:

- *Project Settings*: `Read`,
- *Application services → API Keys*: `Read`,
- *Application services → API Key Secrets*: `Read`,
- *Application services → Edge Functions*: `Read & Write`,
- *Application services → Edge Function Secrets*: `Read & Write`.

Nie nadaj zakresu organizacyjnego ani dostępu do produkcji.

---

## Krok 4: Workflow wdrożenia `staging-deploy.yml`

Plik workflow powstaje **na gałęzi bazowej wychodzącej z `main`**, a nie na
`develop`. Dzięki temu pierwsze wdrożenie na kopię zawiera dokładnie kod
produkcji (Krok 5). Do `develop` trafi później przez `cherry-pick` (Krok 12).

```powershell
git fetch origin
git checkout -b staging/baseline origin/main
```

Utwórz plik `.github/workflows/staging-deploy.yml`:

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - develop
      - 'staging/**'
  workflow_dispatch:
    inputs:
      skip_tests:
        description: 'Pomiń testy, lint i próbny build (szybkie wdrożenie)'
        type: boolean
        default: false

# Wdrożenia kopii ustawiają się w kolejce (bez przerywania trwającej migracji).
concurrency:
  group: staging-deploy
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  # Lint, testy jednostkowe i próbny build (bez sekretów).
  quality:
    name: 🧪 Lint, testy, build
    if: ${{ github.event.inputs.skip_tests != 'true' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v7

      - name: Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run lint
        run: npm run lint

      - name: Run unit tests
        run: npm run test:run

      - name: Write placeholder production environment
        run: |
          cat > src/environments/environment.production.ts << EOF
          export const environment = {
              production: true,
              supabase: {
                  url: 'https://placeholder.supabase.co',
                  anonKey: 'placeholder-anon-key'
              }
          };
          EOF

      - name: Build Angular app
        run: npm run build -- --configuration production

  test-deno:
    name: 🦕 Testy Deno
    if: ${{ github.event.inputs.skip_tests != 'true' }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v7

      - name: Setup Deno
        uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - name: Run Deno tests
        run: deno test --allow-all --unstable --node-modules-dir=none supabase/functions

  deploy-backend:
    name: 🚀 Backend (Supabase staging)
    needs: [quality, test-deno]
    # Uruchom, gdy testy się udały albo zostały pominięte; zatrzymaj przy błędzie.
    if: ${{ !cancelled() && !contains(needs.*.result, 'failure') }}
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Checkout code
        uses: actions/checkout@v7

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v3
        with:
          version: latest

      - name: Link Supabase project
        run: supabase link --project-ref "${{ secrets.SUPABASE_PROJECT_ID }}"
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}

      - name: Push database migrations
        # Jawny URI Session Poolera omija wymaganie IPv6 na runnerach GitHub.
        run: supabase db push --db-url "${{ secrets.STAGING_DB_URL }}" --yes
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}

      # Ustawia tylko niepuste sekrety, żeby nie nadpisać wartości pustym ciągiem.
      - name: Set Edge Function secrets
        run: |
          : > secrets.env
          for name in \
            APP_BASE_URL APP_PUBLIC_URL INTERNAL_WORKER_SECRET \
            OPENAI_API_KEY GEMINI_API_KEY \
            AI_DRAFT_CREDITS_FREE AI_DRAFT_CREDITS_PREMIUM AI_IMAGE_CREDITS_PREMIUM \
            AI_CREDITS_WARN_THRESHOLD_PERCENT AI_CREDITS_CRON_SECRET \
            STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET \
            STRIPE_PRICE_PREMIUM_MONTHLY_RECURRING STRIPE_PRICE_PREMIUM_YEARLY_RECURRING \
            SUBSCRIPTION_TERMS_VERSION BILLING_EXPIRY_GRACE_DAYS \
            RESEND_API_KEY EMAIL_FROM PLAN_LIMIT_FREE NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE
          do
            value="${!name}"
            if [ -n "$value" ]; then
              printf "%s='%s'\n" "$name" "$value" >> secrets.env
            fi
          done
          supabase secrets set --yes --env-file secrets.env
          rm -f secrets.env
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          APP_BASE_URL: ${{ secrets.APP_BASE_URL }}
          APP_PUBLIC_URL: ${{ secrets.APP_PUBLIC_URL }}
          INTERNAL_WORKER_SECRET: ${{ secrets.INTERNAL_WORKER_SECRET }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          AI_DRAFT_CREDITS_FREE: ${{ secrets.AI_DRAFT_CREDITS_FREE }}
          AI_DRAFT_CREDITS_PREMIUM: ${{ secrets.AI_DRAFT_CREDITS_PREMIUM }}
          AI_IMAGE_CREDITS_PREMIUM: ${{ secrets.AI_IMAGE_CREDITS_PREMIUM }}
          AI_CREDITS_WARN_THRESHOLD_PERCENT: ${{ secrets.AI_CREDITS_WARN_THRESHOLD_PERCENT }}
          AI_CREDITS_CRON_SECRET: ${{ secrets.AI_CREDITS_CRON_SECRET }}
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
          STRIPE_PRICE_PREMIUM_MONTHLY_RECURRING: ${{ secrets.STRIPE_PRICE_PREMIUM_MONTHLY_RECURRING }}
          STRIPE_PRICE_PREMIUM_YEARLY_RECURRING: ${{ secrets.STRIPE_PRICE_PREMIUM_YEARLY_RECURRING }}
          SUBSCRIPTION_TERMS_VERSION: ${{ secrets.SUBSCRIPTION_TERMS_VERSION }}
          BILLING_EXPIRY_GRACE_DAYS: ${{ secrets.BILLING_EXPIRY_GRACE_DAYS }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
          PLAN_LIMIT_FREE: ${{ secrets.PLAN_LIMIT_FREE }}
          NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE: ${{ secrets.NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE }}

      # Lista i flagi --no-verify-jwt muszą być zgodne z main-deploy.yml.
      - name: Deploy Edge Functions
        run: |
          # Publiczne endpointy i webhooki bez weryfikacji JWT
          supabase functions deploy --yes explore --no-verify-jwt
          supabase functions deploy --yes public --no-verify-jwt
          supabase functions deploy --yes payments-webhook --no-verify-jwt
          supabase functions deploy --yes internal --no-verify-jwt
          # Endpointy wymagające JWT
          supabase functions deploy --yes admin
          supabase functions deploy --yes ai
          supabase functions deploy --yes billing
          supabase functions deploy --yes categories
          supabase functions deploy --yes checkout
          supabase functions deploy --yes collections
          supabase functions deploy --yes me
          supabase functions deploy --yes plan
          supabase functions deploy --yes profile
          supabase functions deploy --yes recipes
          supabase functions deploy --yes search
          supabase functions deploy --yes tags
          supabase functions deploy --yes shopping-list
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-frontend:
    name: 🌐 Frontend (Firebase staging)
    needs: [deploy-backend]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Checkout code
        uses: actions/checkout@v7

      - name: Setup Node.js
        uses: actions/setup-node@v7
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Configure staging environment
        run: |
          cat > src/environments/environment.production.ts << EOF
          export const environment = {
              production: true,
              supabase: {
                  url: '${{ secrets.SUPABASE_URL }}',
                  anonKey: '${{ secrets.SUPABASE_ANON_KEY }}'
              }
          };
          EOF

      - name: Build Angular app
        run: npm run build

      # Kopia nie ma być indeksowana. Zmiana dotyczy tylko kopii roboczej w runnerze.
      - name: Add noindex header (staging only)
        run: |
          jq '.hosting.headers += [{"source":"**","headers":[{"key":"X-Robots-Tag","value":"noindex, nofollow"}]}]' firebase.json > firebase.staging.json
          mv firebase.staging.json firebase.json

      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_STAGING }}'
          channelId: live
          projectId: ${{ vars.FIREBASE_PROJECT_ID }}
```

Jak to działa:

- **Push do `develop` lub `staging/**`** uruchamia pełny pipeline automatycznie
  (`staging/baseline` = stan `main`, `develop` = stan do przetestowania).
- **Ręczne uruchomienie:** GitHub → *Actions* → *Deploy to Staging* → *Run
  workflow* → w polu *Use workflow from* wybierz gałąź (np. `feature/PS-31-recipe-private-note`).
  Opcja `skip_tests` pomija lint i testy.
- Przycisk *Run workflow* pojawia się dopiero, gdy plik workflow jest na
  **domyślnej gałęzi (`main`)**. Dopóki go tam nie ma, działa wyzwalacz z pushu
  do `develop`. Scalenie pliku do `main` nie wdraża produkcji (inny wyzwalacz,
  inna nazwa workflow).
- Produkcyjny `main-deploy.yml` nie korzysta z `environment`, więc dalej używa
  sekretów repozytorium – nic się w nim nie zmienia.

Commit i push:

```powershell
git add .github/workflows/staging-deploy.yml
git commit -m "ci: add staging deployment workflow"
# Nie pushuj jeszcze – najpierw wykonaj Kroki 1–3, bo push uruchomi wdrożenie.
```

Jeżeli po pierwszym wdrożeniu poprawisz workflow, w Kroku 12 przenieś
**cały zakres** commitów staging względem `main`, a nie tylko pierwszy hash:
`git cherry-pick origin/main..staging/baseline`. Nie dodawaj workflow do
`develop` ani nie pushuj `develop` wcześniej.

---

## Krok 5: Pierwsze wdrożenie – stan produkcji (kod z `main`)

Celem jest kopia w **dokładnie takim stanie jak produkcja**: schemat z migracji
`main`, Edge Functions z `main`, frontend z `main`.

1. Upewnij się, że Kroki 1–3 są gotowe (projekty, Environment `staging`, sekrety).
2. Wypchnij gałąź bazową: `git push -u origin staging/baseline`.
3. GitHub → *Actions* → *Deploy to Staging*. Czas ok. 10–15 minut.
4. Po zielonym przebiegu sprawdź:
    - Supabase → *Edge Functions*: widoczne wszystkie funkcje, a `explore`,
      `public`, `payments-webhook`, `internal` mają wyłączone *Verify JWT*.
    - Supabase → *Database → Migrations*: wszystkie migracje zastosowane.
    - Supabase → *Edge Functions → Secrets*: widoczne ustawione sekrety.
    - Firebase → *Hosting*: wydanie `live`, a strona `https://<PROJECT_ID>.web.app` się otwiera.

   - Zapisz ostatnią zastosowaną migrację (będzie wynikiem odniesienia dla
     Kroku 12): `supabase migration list --db-url $env:STAGING_DB_URL`.

Na tym etapie baza jest pusta (bez użytkowników) – dane dodajesz w Kroku 6.
**Nie pushuj jeszcze `develop`.**

---

## Krok 6: Dane produkcyjne z anonimizacją

**Zasada:** dane osobowe w ogóle nie opuszczają produkcji.

- Z `auth.users` pobierasz **tylko `id` i rolę** (`app_role`) – bez e-maili,
  haseł, metadanych ani tokenów. Konta w kopii powstają od nowa, z
  fikcyjnymi adresami `…@staging.invalid` i jednym hasłem staging.
- Z `public` pobierasz dane przepisów, kolekcji, tagów, ocen itd., ale
  **z pominięciem** tabel `billing_customers`, `subscriptions`,
  `subscription_payments`, `payment_webhook_events` (dane płatności) oraz
  `user_recipe_notes` (prywatne notatki).
- Nazwy użytkowników (`profiles.username`) są zastępowane pseudonimami, a zgody
  marketingowe zerowane.
- **Nie są anonimizowane** treści tworzone przez użytkowników: nazwy, opisy,
  składniki i kroki przepisów, nazwy kolekcji. Patrz
  [Bezpieczeństwo i RODO](#bezpieczeństwo-i-rodo).

### 6.0. Sprawdź, czy schemat kopii jest taki sam jak produkcji

Test migracji ma sens tylko wtedy, gdy kopia (zbudowana z migracji `main`)
ma ten sam schemat co produkcja. Produkcja bywa zmieniana ręcznie (np. skrypt
`docs/scripts/enable_rls_for_production.sql`, ręczne zadania cron), więc
porównaj oba schematy – to zrzut **bez danych**:

```powershell
cd $work
supabase db dump --db-url $env:PROD_DB_URL    --schema public -f prod-schema.sql
supabase db dump --db-url $env:STAGING_DB_URL --schema public -f staging-schema.sql

git diff --no-index --stat .\staging-schema.sql .\prod-schema.sql
git diff --no-index .\staging-schema.sql .\prod-schema.sql
```

- **Brak różnic (poza kolejnością lub komentarzami):** przejdź do 6.1.
- **Są różnice** (np. RLS włączone tylko na produkcji, dodatkowe indeksy lub
  polityki): zapisz je. Albo odtwórz je na kopii (to samo, co robiono ręcznie
  na produkcji), albo zaakceptuj jako znane odstępstwo. Różnice dotyczące
  tabel i kolumn **muszą** zostać usunięte przed ładowaniem danych (Krok 6.5),
  inaczej `public-data.sql` się nie załaduje.

> **Znane odstępstwa obecnego projektu:** produkcja ma ręcznie włączone RLS i
> polityki z `docs/scripts/enable_rls_for_production.sql`, a także funkcję
> `public.get_internal_worker_secret()`. Pierwsza różnica zostanie odtworzona
> przed testami funkcjonalnymi, a funkcję utworzy Krok 7. Nie uruchamiaj
> bezpośrednio skryptu `enable_rls_for_production.sql` na kopii: nie jest
> idempotentny i może zakończyć się błędem istniejących polityk. Zanim powtórzysz
> proces, przenieś ręczne zmiany RLS do migracji albo przygotuj idempotentny
> skrypt różnicowy dla aktualnego stanu produkcji.

### 6.1. Pobranie danych z produkcji (tylko odczyt)

```powershell
cd $work

# Lista kont: tylko identyfikator, rola i data utworzenia
psql $env:PROD_DB_URL -v ON_ERROR_STOP=1 -c "\copy (select id, coalesce(raw_app_meta_data->>'app_role','user') as app_role, created_at from auth.users) to 'users.csv' with csv header"

# Dane schematu public (bez płatności i prywatnych notatek)
supabase db dump --db-url $env:PROD_DB_URL --data-only --use-copy --schema public `
    -x public.billing_customers `
    -x public.subscriptions `
    -x public.subscription_payments `
    -x public.payment_webhook_events `
    -x public.user_recipe_notes `
    -f public-data.sql
```

Weryfikacja (oba polecenia muszą dać wynik tylko dla tabel, które mają być w kopii):

```powershell
Select-String -Path .\public-data.sql -Pattern 'COPY "public"\."(recipes|profiles)"' | Select-Object -First 3
Select-String -Path .\public-data.sql -Pattern 'billing_customers|subscription_payments|user_recipe_notes'   # ma nic nie zwrócić
```

Jeśli druga komenda coś zwraca, **przerwij** i popraw listę `-x` – dump
nie może zawierać danych płatności ani notatek.

### 6.2. Skrypt czyszczący kopię (`reset-staging.sql`)

Zapisz w `$work\reset-staging.sql`. Skrypt jest idempotentny, więc posłuży
też do późniejszego odświeżania danych.

```sql
-- Czyści dane aplikacji i konta w kopii. NIE uruchamiaj na produkcji.
do $$
declare
    r record;
begin
    for r in select tablename from pg_tables where schemaname = 'public' loop
        execute format('truncate table public.%I restart identity cascade', r.tablename);
    end loop;
end $$;

truncate table auth.users cascade;
```

### 6.3. Skrypt tworzący konta (`create-users.sql`)

Zapisz w `$work\create-users.sql`. Skrypt odtwarza konta na podstawie
`users.csv` w tym samym formacie, co `supabase/seeds/01_seed_users.sql`.

```sql
\set ON_ERROR_STOP on

-- Wyłącza wyzwalacze (m.in. automatyczne tworzenie profilu), bo profile
-- przyjdą z zrzutu danych public.
set session_replication_role = replica;

create temp table src_users (
    id uuid,
    app_role text,
    created_at timestamptz
);

\copy src_users from 'users.csv' with csv header

with pw as (
    select extensions.crypt(:'staging_password', extensions.gen_salt('bf')) as hash
)
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    is_sso_user, is_anonymous
)
select
    '00000000-0000-0000-0000-000000000000',
    s.id,
    'authenticated',
    'authenticated',
    s.app_role || '-' || substr(replace(s.id::text, '-', ''), 1, 12) || '@staging.invalid',
    pw.hash,
    now(),
    '', '', '', '', '', '', '',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'app_role', s.app_role),
    jsonb_build_object('email_verified', true, 'marketing_consent_accepted', false),
    s.created_at,
    now(),
    false,
    false
from src_users s
cross join pw;

insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
    gen_random_uuid(),
    u.id::text,
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
    'email',
    null,
    now(),
    now()
from auth.users u;
```

### 6.4. Skrypt anonimizujący profile (`anonymize-profiles.sql`)

Zapisz w `$work\anonymize-profiles.sql`:

```sql
\set ON_ERROR_STOP on
set session_replication_role = replica;

update public.profiles
set username = case
        when username is null then null
        else 'user_' || substr(replace(id::text, '-', ''), 1, 10)
    end,
    marketing_consent = false,
    marketing_consent_updated_at = null,
    marketing_consent_text_version = null;

update auth.users u
set raw_user_meta_data = u.raw_user_meta_data || jsonb_build_object('username', p.username)
from public.profiles p
where p.id = u.id
    and p.username is not null;
```

### 6.5. Wykonanie na kopii

Najpierw **sprawdź, że `$env:STAGING_DB_URL` wskazuje kopię**, a nie produkcję:

```powershell
$env:STAGING_DB_URL -like "*$($env:STAGING_REF)*"    # musi zwrócić True
$env:STAGING_DB_URL -ne $env:PROD_DB_URL            # musi zwrócić True
```

Hasło wspólne dla wszystkich kont kopii (silne; nie publikuj go). Wprowadź je
przez `Read-Host`, aby nie znalazło się w historii:

```powershell
$stagingPassword = Read-Host 'Wpisz hasło dla kont staging'
```

Wykonanie (w katalogu `$work`, bo `users.csv` jest ścieżką względną):

```powershell
cd $work

psql $env:STAGING_DB_URL -v ON_ERROR_STOP=1 -f reset-staging.sql

psql $env:STAGING_DB_URL -v ON_ERROR_STOP=1 -v staging_password="$stagingPassword" -f create-users.sql

psql $env:STAGING_DB_URL -v ON_ERROR_STOP=1 --single-transaction `
    --command "SET session_replication_role = replica" `
    --file public-data.sql

psql $env:STAGING_DB_URL -v ON_ERROR_STOP=1 -f anonymize-profiles.sql
```

### 6.6. Weryfikacja anonimizacji

```powershell
psql $env:STAGING_DB_URL -c "select count(*) as users_not_anonymized from auth.users where email not like '%@staging.invalid';"       # 0
psql $env:STAGING_DB_URL -c "select provider, count(*) from auth.identities group by provider;"                                        # tylko email
psql $env:STAGING_DB_URL -c "select count(*) from public.subscriptions;"                                                               # 0
psql $env:STAGING_DB_URL -c "select count(*) from public.user_recipe_notes;"                                                           # 0
psql $env:STAGING_DB_URL -c "select app_role, count(*) from (select raw_app_meta_data->>'app_role' as app_role from auth.users) t group by 1;"
psql $env:STAGING_DB_URL -c "select count(*) as recipes from public.recipes;"
```

Zapisz sobie adresy kont testowych (po jednym na rolę), np.:

```powershell
psql $env:STAGING_DB_URL -c "select raw_app_meta_data->>'app_role' as role, min(email) as email from auth.users group by 1;"
```

Logujesz się nimi hasłem `$stagingPassword`.

### 6.7. Sprzątanie

```powershell
Remove-Item -Recurse -Force $work
Remove-Item Env:PROD_DB_URL
```

Dane z produkcji (nawet bez e-maili) nie powinny zostać na dysku ani w
historii poleceń. Jeśli w historii PowerShell są connection stringi z hasłami,
usuń je (`Clear-History`, plik z `(Get-PSReadLineOption).HistorySavePath`).

---

## Krok 7: Zadania cron i sekret workera

Zadania cron kopii wywołują funkcję `internal` w **kopii**. Zakładasz je
ręcznie, tak samo jak na produkcji (nie ma ich w migracjach). Migracja
`20260915225500_create_ai_credits_monthly_reset.sql` tworzy zadanie
`ai-credits-monthly-reset` sama.

Zapisz `cron-staging.sql` (poza repozytorium, np. w `$work`):

```sql
\set ON_ERROR_STOP on

-- Funkcja z sekretem workera (ta sama wartość co INTERNAL_WORKER_SECRET w kopii).
select format(
    'create or replace function public.get_internal_worker_secret() returns text language sql security definer set search_path = '''' as $f$ select %L::text $f$',
    :'worker_secret'
) \gexec

revoke all on function public.get_internal_worker_secret() from public, anon, authenticated;
grant execute on function public.get_internal_worker_secret() to postgres;

-- Usuń ewentualne stare wersje zadań.
select cron.unschedule(jobid)
from cron.job
where jobname in ('normalized-ingredients-worker', 'billing-expire-subscriptions');

-- Worker normalizacji składników: co minutę.
select cron.schedule(
    'normalized-ingredients-worker',
    '* * * * *',
    format($cmd$
        select net.http_post(
            url := %L,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-internal-worker-secret', public.get_internal_worker_secret()
            ),
            timeout_milliseconds := 55000
        );
    $cmd$, :'project_url' || '/functions/v1/internal/workers/normalized-ingredients/run')
);

-- Wygaszanie subskrypcji: codziennie o 03:00.
select cron.schedule(
    'billing-expire-subscriptions',
    '0 3 * * *',
    format($cmd$
        select net.http_post(
            url := %L,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || public.get_internal_worker_secret()
            ),
            body := '{}'::jsonb,
            timeout_milliseconds := 55000
        );
    $cmd$, :'project_url' || '/functions/v1/internal/billing/expire-subscriptions')
);

select jobname, schedule, active from cron.job order by jobname;
```

Uruchomienie (`INTERNAL_WORKER_SECRET` musi być tą samą wartością co w GitHub Environment):

```powershell
psql $env:STAGING_DB_URL -v ON_ERROR_STOP=1 `
    -v project_url="https://$($env:STAGING_REF).supabase.co" `
    -v worker_secret="$env:INTERNAL_WORKER_SECRET" `
    -f "$work\cron-staging.sql"
```

Test ręczny workera (oczekiwana odpowiedź to JSON z polami `processed`, `succeeded`, `failed`, `skipped`):

```powershell
Invoke-RestMethod -Method POST `
    -Uri "https://$($env:STAGING_REF).supabase.co/functions/v1/internal/workers/normalized-ingredients/run" `
    -Headers @{ 'x-internal-worker-secret' = $env:INTERNAL_WORKER_SECRET }
```

Po kilku minutach sprawdź historię: `select status, return_message from cron.job_run_details order by start_time desc limit 5;`.
Szczegóły monitoringu: [worker-production-deployment.md](./worker-production-deployment.md).

---

## Krok 8: Konfiguracja Auth w Supabase

Supabase Dashboard kopii → *Authentication*. Najpierw otwórz Dashboard
produkcji i **porównaj ustawienia**, żeby zachowanie logowania było takie samo.

1. **URL Configuration**
    - *Site URL*: `https://<PROJECT_ID>.web.app`
    - *Redirect URLs*: `https://<PROJECT_ID>.web.app/auth/callback` oraz
      (jeśli testujesz lokalnie na kopii) `http://localhost:4200/auth/callback`.
2. **Sign In / Providers → Email**: ustaw te same opcje co na produkcji
   (potwierdzenie adresu e-mail, minimalna długość hasła, limity).
3. **Google OAuth** (aplikacja używa `signInWithOAuth` z powrotem na
   `/auth/callback`):
    - *Providers → Google*: włącz, wklej Client ID i Client Secret (może to być
      ten sam klient OAuth co na produkcji albo osobny).
    - [Google Cloud Console](https://console.cloud.google.com) → *APIs & Services
      → Credentials* → klient OAuth → dodaj do *Authorized redirect URIs*:
      `https://<STAGING_REF>.supabase.co/auth/v1/callback`.
    - Konta odtworzone w Kroku 6 mają tylko tożsamość e-mail, więc
      logowanie Google utworzy **nowe** konto.
4. **E-maile**: domyślny nadawca Supabase ma niski limit i zwykle wysyła tylko do
   członków zespołu. Do testów rejestracji skonfiguruj własny SMTP (np. Resend:
   *Authentication → Emails → SMTP Settings*) albo wyłącz wymaganie
   potwierdzenia e-mail w kopii.
5. **Rate limits, sesje, JWT expiry**: skopiuj z produkcji.

---

## Krok 9: Stripe (tryb testowy)

Szczegółowy opis konfiguracji Stripe jest w
`docs/results/new-features/epics/premium-users/premium-users-payments-launch-plan.md`
(sekcja D). Dla kopii powtórz go **w trybie testowym**:

1. Stripe Dashboard → utwórz osobny **Sandbox** dla staging (np.
   `pychaswiatowa-staging`). Sandbox izoluje klientów, ceny i webhooki lepiej
   niż współdzielony Test mode.
2. Utwórz produkty i ceny testowe dokładnie jak na produkcji (kwoty muszą się
   zgadzać z kodem – webhook je weryfikuje: **2400** i **16900 groszy**, waluta PLN).
3. Utwórz **Restricted key** (`rk_test_…`) z uprawnieniami jak na produkcji →
   sekret `STRIPE_SECRET_KEY`.
4. *Developers → Webhooks → Add endpoint*:
    - URL: `https://<STAGING_REF>.supabase.co/functions/v1/payments-webhook`
    - Zdarzenia (dokładnie te 5): `checkout.session.completed`,
      `checkout.session.async_payment_succeeded`,
      `checkout.session.async_payment_failed`, `checkout.session.expired`,
      `invoice.paid`.
    - Skopiuj **Signing secret** `whsec_…` → `STRIPE_WEBHOOK_SECRET`.
5. Dodaj w GitHub Environment `staging`: `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PREMIUM_MONTHLY_RECURRING`,
   `STRIPE_PRICE_PREMIUM_YEARLY_RECURRING`, `SUBSCRIPTION_TERMS_VERSION`,
   `BILLING_EXPIRY_GRACE_DAYS`.
6. Uruchom workflow ponownie, żeby sekrety trafiły do Edge Functions. Przed
   Krokiem 12 zrób to z gałęzi bazowej (`git commit --allow-empty -m "ci: redeploy staging"`
   i `git push origin staging/baseline`), **nie** z `develop`.

Webhook porównuje tryb klucza z `livemode` zdarzenia – klucz testowy i webhook
testowy muszą być użyte razem. Karty testowe: `4242 4242 4242 4242`.

---

## Krok 10: Zdjęcia przepisów (opcjonalnie)

Zrzut z Kroku 6 zawiera ścieżki zdjęć (`recipes.image_path`), ale nie same
pliki (to Storage, nie baza). Bez kopiowania zdjęcia na kopii się nie
załadują. Bucket `recipe-images` tworzy migracja, a identyfikatory
użytkowników są zachowane, więc ścieżki `<user_id>/…` będą pasować.

Zdjęcia dań to treści użytkowników – kopiuj je świadomie
(patrz [Bezpieczeństwo i RODO](#bezpieczeństwo-i-rodo)). Skrypt nie był
uruchamiany – wypróbuj go najpierw z ograniczeniem listy do kilku plików.

Zapisz **tymczasowo w katalogu repozytorium** jako
`.tmp-copy-recipe-images.mjs` (Node rozwiązuje importy względem lokalizacji
skryptu, nie bieżącego katalogu) i usuń plik po wykonaniu:

```javascript
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'recipe-images';
const PAGE_SIZE = 100;
const options = { auth: { persistSession: false } };

const source = createClient(process.env.PROD_SUPABASE_URL, process.env.PROD_SECRET_KEY, options);
const target = createClient(process.env.STAGING_SUPABASE_URL, process.env.STAGING_SECRET_KEY, options);

async function listFiles(prefix = '') {
    const files = [];
    let offset = 0;

    while (true) {
        const { data, error } = await source.storage.from(BUCKET).list(prefix, { limit: PAGE_SIZE, offset });
        if (error) throw error;
        if (!data?.length) break;

        for (const item of data) {
            const path = prefix ? `${prefix}/${item.name}` : item.name;
            // Foldery nie mają identyfikatora.
            if (item.id === null) {
                files.push(...await listFiles(path));
                continue;
            }
            files.push({ path, contentType: item.metadata?.mimetype });
        }

        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
    }

    return files;
}

const files = await listFiles();
console.log(`Do skopiowania: ${files.length} plików`);

let copied = 0;
for (const file of files) {
    const { data, error } = await source.storage.from(BUCKET).download(file.path);
    if (error) {
        console.error(`Pobieranie nieudane: ${file.path}`, error.message);
        continue;
    }

    const { error: uploadError } = await target.storage
        .from(BUCKET)
        .upload(file.path, data, { upsert: true, contentType: file.contentType });
    if (uploadError) {
        console.error(`Wysyłanie nieudane: ${file.path}`, uploadError.message);
        continue;
    }

    copied += 1;
}
console.log(`Skopiowano: ${copied}/${files.length}`);
```

```powershell
$env:PROD_SUPABASE_URL        = 'https://<PROD_REF>.supabase.co'
$env:PROD_SECRET_KEY          = Read-Host 'Wklej tymczasowy Secret key produkcji'
$env:STAGING_SUPABASE_URL     = "https://$($env:STAGING_REF).supabase.co"
$env:STAGING_SECRET_KEY       = Read-Host 'Wklej tymczasowy Secret key staging'

node .\.tmp-copy-recipe-images.mjs

Remove-Item .\.tmp-copy-recipe-images.mjs
Remove-Item Env:PROD_SECRET_KEY, Env:STAGING_SECRET_KEY
```

W aktualnym Supabase użyj osobnych, krótkotrwałych kluczy **Secret**
(`sb_secret_…`, następcy `service_role`) i usuń je w obu projektach po
kopiowaniu. Omijają one RLS — nie wklejaj ich do plików ani nie commituj.

---

## Krok 11: Testy dymne

Wykonaj po pierwszym wdrożeniu i po zmianach konfiguracji.

| # | Test | Oczekiwany wynik |
|---|------|------------------|
| 1 | Otwórz `https://<PROJECT_ID>.web.app`, odśwież na podstronie (np. `/recipes/1`) | Aplikacja ładuje się (rewrite SPA do `index.html`) |
| 2 | Strona publiczna / eksploracja bez logowania | Lista przepisów (funkcje `explore`, `public`) |
| 3 | Logowanie kontem `simple`/`premium`/`admin` z Kroku 6 | Poprawne logowanie, właściwa rola |
| 4 | Panel admina na koncie `admin` | Dostępny, lista przepisów i użytkowników |
| 5 | Dodanie i edycja przepisu | Zapis działa, brak błędów w konsoli |
| 6 | Po ok. 2 minutach status składników znormalizowanych | Zadanie w `normalized_ingredients_jobs` kończy się sukcesem, a przepis dostaje składniki znormalizowane (cron workera działa) |
| 7 | Szkic przepisu AI (konto z kredytami) | Odpowiedź z OpenAI, kredyty maleją |
| 8 | Płatność kartą testową w `/pricing` → `/checkout` | Rola `premium`, wpis w `subscription_payments`, status `processed` w `payment_webhook_events` |
| 9 | Rejestracja nowego konta | E-mail/konto powstaje, profil tworzy się automatycznie |
| 10 | Nagłówek `X-Robots-Tag` | `Invoke-WebRequest https://<PROJECT_ID>.web.app -Method Head` zawiera `noindex, nofollow` |

Sprawdzenie logów: Supabase → *Edge Functions → \<funkcja\> → Logs*; Firebase →
*Hosting → Release history*; GitHub → *Actions*.

Testy dymne wykonaj **na stanie `main` z danymi produkcyjnymi, przed Krokiem 12**.
Dzięki temu wiesz, że ewentualne błędy po wdrożeniu `develop` pochodzą od
`develop`, a nie od konfiguracji kopii.

---

## Krok 12: Test migracji `develop` na danych z `main`

Warunek wstępny: kopia ma kod `main` (Krok 5), anonimizowane dane produkcji
(Krok 6), działający cron (Krok 7) i przeszła testy dymne (Krok 11).

### 12.1. Co dokładnie będzie wdrożone

```powershell
cd <katalog repozytorium>
git fetch origin

# Nowe migracje w develop względem main
git diff --name-status origin/main...origin/develop -- supabase/migrations

# Zmiany w Edge Functions i frontendzie
git diff --stat origin/main...origin/develop -- supabase/functions
```

Przeczytaj każdą nową migrację pod kątem ryzyka na dużej tabeli:
`alter table … add column … not null` bez `default`, zmiana typu kolumny,
`drop column`/`drop table`, backfille (`update` na całej tabeli), nowe
indeksy unikalne (mogą się nie założyć na istniejących danych), nowe
ograniczenia `check`/FK (mogą odrzucić istniejące wiersze), zmiany polityk RLS.
To właśnie te przypadki wychodzą dopiero na prawdziwych danych.

### 12.2. Zdjęcie stanu „przed”

Zapisz liczność tabel i schemat (poza repozytorium):

```powershell
cd $work
$countSql = @"
select table_name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::bigint as row_count
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by 1;
"@

psql $env:STAGING_DB_URL -At -F ',' -c $countSql -o before-counts.csv
supabase db dump --db-url $env:STAGING_DB_URL --schema public -f schema-before.sql
supabase migration list --db-url $env:STAGING_DB_URL
```

### 12.3. Dodanie workflow do `develop` i podgląd migracji

```powershell
git checkout develop
# Przenieś wszystkie poprawki workflow z gałęzi bazowej, nie tylko pierwszy commit.
git cherry-pick origin/main..staging/baseline

# Podgląd: jakie migracje zostaną zastosowane (bez zapisu)
supabase db push --dry-run --db-url $env:STAGING_DB_URL
```

Lista z `--dry-run` ma być równa liście nowych migracji z 12.1. Jeśli zawiera
też inne, oznacza to, że historia kopii odbiega od `main` – rozwiąż to przed
wdrożeniem (patrz [Troubleshooting](#troubleshooting)).

### 12.4. Wdrożenie `develop` na kopię

```powershell
git push origin develop
```

Wdrożenie idzie tym samym pipeline'em, który uruchomi produkcja po scaleniu
(testy → `db push` → sekrety → funkcje → frontend). W logu GitHub Actions
obejrzyj krok **Push database migrations**: zanotuj czas trwania (to przybliżenie
czasu na produkcji) i każdy `NOTICE`/błąd.

Jeśli migracja się **nie powiedzie**: każda migracja wykonuje się w
transakcji, więc nieudana nie zostawia częściowych zmian. Popraw plik
migracji w `develop` i wypchnij ponownie – ponieważ nie została zastosowana,
można ją edytować. Jeśli migracja **się powiodła**, ale chcesz ją zmienić,
najpierw wróć do stanu `main` (sekcja
[Powrót do stanu `main`](#powrót-do-stanu-main-powtórzenie-testu-migracji)).

### 12.5. Zdjęcie stanu „po” i porównanie

```powershell
cd $work
psql $env:STAGING_DB_URL -At -F ',' -c $countSql -o after-counts.csv
Compare-Object (Get-Content before-counts.csv) (Get-Content after-counts.csv)

supabase db dump --db-url $env:STAGING_DB_URL --schema public -f schema-after.sql
git diff --no-index --stat .\schema-before.sql .\schema-after.sql

supabase migration list --db-url $env:STAGING_DB_URL
```

Oczekiwanie:

- liczności tabel zmieniły się **tylko** tam, gdzie migracja to zakłada
  (np. backfill dodał wiersze); nic nie zniknęło nieoczekiwanie,
- różnice w schemacie odpowiadają treści nowych migracji (i niczemu więcej),
- wszystkie migracje mają status zastosowanej (kolumny *Local* i *Remote* zgodne).

### 12.6. Testy funkcjonalne po migracji

1. Powtórz **Krok 11** (testy dymne) na nowej wersji.
2. Przejdź ścieżki, których dotyczą zmienione tabele i funkcje (z listy w 12.1),
   na kontach `simple`, `premium` i `admin`.
3. Sprawdź logi Edge Functions pod kątem błędów po wdrożeniu.
4. Dla migracji zmieniających RLS lub uprawnienia: wywołaj endpointy kontem
   zwykłego użytkownika i potwierdź, że widzi tylko swoje dane.

### 12.7. Wynik i ograniczenia testu

Jeśli 12.5 i 12.6 są zielone, `develop` można scalić do `main` – produkcja
zastosuje te same migracje.

Ograniczenia, o których trzeba pamiętać:

- Tabele `billing_customers`, `subscriptions`, `subscription_payments`,
  `payment_webhook_events` i `user_recipe_notes` są **puste** na kopii. Migracje
  dotykające tych tabel nie zostały sprawdzone na prawdziwych danych – zrób dla
  nich osobny test (np. wstaw kilka rekordów testowych przed migracją).
- Konta są odtworzone od nowa. Migracje modyfikujące `auth.users` lub metadane
  (poza `app_role`) nie zostały sprawdzone na prawdziwych kontach.
- Pliki w Storage są kopiowane tylko w Kroku 10.
- Liczność i rozkład danych są takie jak w chwili zrzutu (Krok 6). Jeśli dump
  jest stary, odśwież go (sekcja „Odświeżanie danych kopii”) i powtórz test.
- Test nie obejmuje ruchu użytkowników – blokady tabel mogą trwać dłużej na
  produkcji przy równoległych zapytaniach.

---

## Codzienna praca

Po przejściu Kroku 12 kopia działa w trybie ciągłym (staging = `develop`).

**Zwykła zmiana:**

1. Praca na gałęzi funkcjonalnej, PR do `develop`.
2. Scalenie PR → automatyczne wdrożenie na kopię (10–15 min).
3. Test na `https://<PROJECT_ID>.web.app`.
4. PR `develop` → `main` → automatyczne wdrożenie produkcji (bez zmian).

**Sprawdzenie gałęzi przed scaleniem (ręcznie):**

- Interfejs: *Actions → Deploy to Staging → Run workflow →* wybierz gałąź.
- GitHub CLI (po scaleniu pliku workflow do `main`):

```powershell
gh workflow run staging-deploy.yml --ref feature/PS-31-recipe-private-note
gh run watch
```

**Uwaga o migracjach.** Kopia i produkcja mają osobną historię migracji.
Jeśli wdrożysz na kopię gałąź z nową migracją, a potem gałąź **bez** niej,
`supabase db push` zgłosi, że zdalna historia ma migracje nieobecne lokalnie.
Dlatego:

- po migracji zawsze scalaj do `develop` i wdrażaj stamtąd,
- nie zmieniaj nazwy ani zawartości migracji, która trafiła na kopię lub produkcję
  (twórz nową),
- podgląd bez zapisu: `supabase db push --dry-run --db-url $env:STAGING_DB_URL`.

**Ręczne wdrożenie z lokalnego komputera (awaryjnie):**

```powershell
supabase db push --db-url $env:STAGING_DB_URL
supabase functions deploy recipes --project-ref $env:STAGING_REF
```

**Wycofanie (rollback):** wdróż ponownie poprzedni commit
(*Run workflow* z gałęzi/tagu ze starym kodem). Migracji nie da się cofnąć
automatycznie – napisz migrację naprawczą albo odśwież dane kopii (sekcja „Odświeżanie danych kopii”).

---

## Odświeżanie danych kopii

Dane na kopii starzeją się. Aby je odświeżyć, powtórz **Krok 6** w całości
(6.1 → 6.5 → 6.6 → 6.7). `reset-staging.sql` czyści wszystko, co potrzeba.
Po odświeżeniu:

- ponownie uruchom Krok 10 (zdjęcia), jeśli ich używasz,
- nie trzeba powtarzać Kroku 7 (cron zostaje).

Nie odświeżaj danych, gdy ktoś testuje na kopii – zalogowani użytkownicy
stracą sesje (konta powstają od nowa).

**Ważne:** dump z produkcji ma schemat z `main`. Jeśli na kopii są już
migracje z `develop`, ładowanie danych (`public-data.sql`) może się nie
udać (brakujące lub zmienione kolumny). Przed odświeżeniem danych wróć do
stanu `main` (następna sekcja) albo odśwież dane dopiero po scaleniu `develop`
do `main` i wdrożeniu produkcji.

---

## Powrót do stanu `main` (powtórzenie testu migracji)

Migracji nie da się cofnąć, więc aby powtórzyć test (np. po zmianie migracji,
która już się zastosowała, albo po odświeżeniu zrzutu z produkcji), trzeba
odtworzyć bazę kopii od zera w stanie `main`. Są dwie drogi.

**Droga A – reset bazy kopii (szybsza):**

```powershell
# Czysty checkout main w osobnym katalogu (migracje = main)
git worktree add ..\pychaswiatowa-main origin/main
cd ..\pychaswiatowa-main

# UWAGA: z jawnym --db-url kopii. W supabase/config.toml seedy są WŁĄCZONE
# (konta z hasłem 12345678) – pomiń je flagą --no-seed.
supabase db reset --db-url $env:STAGING_DB_URL --no-seed
```

Przed uruchomieniem sprawdź `supabase db reset --help`: czy wersja CLI
obsługuje `--db-url` i `--no-seed`. Jeśli nie, użyj drogi B. Po resecie:

1. Sprawdź `supabase migration list --db-url $env:STAGING_DB_URL` – ostatnia
   migracja ma być taka jak w `main`.
2. Wdróż kod `main` na kopię: *Actions → Deploy to Staging → Run workflow*
   z gałęzi `staging/baseline` (albo `git push origin staging/baseline`
   po pustym commicie), żeby funkcje i frontend też odpowiadały `main`.
3. Powtórz Krok 6 (łącznie z 6.0), Krok 7 (cron – skrypt jest idempotentny),
   opcjonalnie Krok 10 i testy dymne (Krok 11).
4. Wróć do Kroku 12.

**Droga B – nowy projekt Supabase (najpewniejsza):** usuń projekt kopii i
utwórz nowy (Krok 1), zaktualizuj sekrety w Environment `staging`
(`SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_DB_PASSWORD`), konfigurację Auth (Krok 8) i webhook Stripe (Krok 9),
a następnie wykonaj Kroki 5–7 i 11.

Po zakończeniu usuń katalog roboczy: `git worktree remove ..\pychaswiatowa-main`.

---

## Bezpieczeństwo i RODO

- Kopia **nie zawiera** e-maili, haseł, tokenów, danych płatności ani prywatnych
  notatek z produkcji (Krok 6). Dane osobowe nie opuszczają produkcji.
- **Zawiera** treści użytkowników (przepisy, opisy, kolekcje, ewentualnie
  zdjęcia), pod pseudonimami. Pozostają to dane pochodzące od użytkowników –
  upewnij się, że polityka prywatności i regulamin dopuszczają taki cel
  (testy jakości). Jeśli nie, zmień wariant danych na same migracje i seedy
  (`supabase/seeds`).
- Wspólne hasło staging jest znane każdemu, kto je dostał; adresy kont
  (`role-<12 znaków>@staging.invalid`) nie są publiczne, ale nie traktuj kopii
  jako bezpiecznej. Nie używaj tego hasła nigdzie indziej.
- Kopia ma nagłówek `X-Robots-Tag: noindex, nofollow`, ale jest dostępna
  publicznie pod adresem `web.app`. Rozważ ograniczenie dostępu (np. wyłączenie
  rejestracji w *Authentication → Sign In* na kopii, jeśli nie jest potrzebna).
- Osobne klucze AI z limitem budżetu, osobny `INTERNAL_WORKER_SECRET`, Stripe
  tylko w trybie testowym.
- Nigdy nie wklejaj kluczy produkcyjnych (`service_role`, `sk_live_`/`rk_live_`)
  do sekretów Environmentu `staging`.

---

## Troubleshooting

| Objaw | Przyczyna | Rozwiązanie |
|-------|-----------|-------------|
| Workflow nie startuje po pushu do `develop` lub `staging/baseline` | Plik workflow nie jest na wypychanej gałęzi lub ma błąd YAML | Sprawdź *Actions*; plik musi być na tej gałęzi (do `develop` dodaj go przez `cherry-pick`, Krok 12.3) |
| Brak przycisku *Run workflow* | Plik workflow nie jest na `main` | Użyj pushu do `develop` lub `staging/baseline`; scalenie pliku do `main` uruchomi produkcyjny pipeline (te same zmiany, nowy deploy), ale go nie zmieni |
| `deploy-backend` czeka na zatwierdzenie | Environment `staging` ma *Required reviewers* | Usuń wymóg lub zatwierdź wdrożenie |
| Kroki wdrożenia dostają puste wartości (np. pusty `SUPABASE_PROJECT_ID`) | Sekret dodano do sekretów repozytorium zamiast do Environment `staging` | Dodaj sekret do **Environment** `staging` |
| `supabase link` / `db push`: błąd uwierzytelnienia | Zły `SUPABASE_ACCESS_TOKEN` lub `SUPABASE_DB_PASSWORD` | Wygeneruj nowy token, zweryfikuj hasło bazy |
| `db push`: *IPv6 is not supported on your current network* | CLI użyła połączenia bezpośredniego | Dodaj sekret `STAGING_DB_URL` z **Session Poolera** i użyj `supabase db push --db-url "${{ secrets.STAGING_DB_URL }}" --yes` |
| `secrets set`: *Confirmation required* | Aktualna CLI wymaga potwierdzenia w CI | Dodaj `--yes`: `supabase secrets set --yes --env-file secrets.env` |
| `db push`: *Remote migration versions not found in local* | Na kopii są migracje z innej gałęzi (np. `develop`), a wdrażasz gałąź bez nich (np. `staging/baseline`) | Wdróż gałąź, która je zawiera (zwykle `develop`), albo wróć do stanu `main` (sekcja „Powrót do stanu `main`”) |
| `public-data.sql` się nie ładuje: brakująca/nadmiarowa kolumna | Kopia ma schemat z `develop`, a dump jest z `main` | Wróć do stanu `main` przed ładowaniem danych |
| `--dry-run` w Kroku 12.3 pokazuje więcej migracji niż nowe z `develop` | Historia kopii odbiega od `main` (np. po ręcznych zmianach) | Porównaj `supabase migration list`, napraw różnicę lub wykonaj „Powrót do stanu `main`” |
| Dump zawiera tabele płatności | Brak flag `-x` lub zła nazwa tabeli | Popraw listę `-x`, usuń plik, powtórz |
| `supabase db dump` nie rozpoznaje `-x` lub `--schema` | Starsza wersja CLI | Zaktualizuj CLI; sprawdź `supabase db dump --help` |
| Przy `create-users.sql`: *permission denied to set session_replication_role* | Połączenie nie jako rola `postgres` | Użyj connection stringa użytkownika `postgres` (pooler: `postgres.<REF>`) |
| Przy `create-users.sql`: *INSERT has more expressions than target columns* | Skrypt ma osiem pustych wartości tokenów zamiast siedmiu | Użyj poprawionej listy siedmiu `''` z Kroku 6.3 |
| Przy `create-users.sql`: kolumna nie istnieje (`reauthentication_token` itp.) | Inna wersja schematu Auth | Usuń nieistniejące kolumny z `insert` (pozostaw puste tokeny w tych, które istnieją) |
| Przy `public-data.sql`: *duplicate key* | Kopia nie została wyczyszczona | Najpierw wykonaj `reset-staging.sql` |
| Po restore: *duplicate key* przy dodawaniu rekordu | Nie zsynchronizowane sekwencje | `select setval(pg_get_serial_sequence('public.<tabela>', 'id'), (select max(id) from public.<tabela>));` |
| Nie można zalogować się kontem testowym | Zły e-mail lub hasło, konto bez tożsamości `email` | Sprawdź `select email from auth.users limit 5;` i `auth.identities` |
| Worker zwraca `401` | `INTERNAL_WORKER_SECRET` w funkcji ≠ wartość w `get_internal_worker_secret()` | Ustaw tę samą wartość w obu miejscach (Krok 3 i 7), uruchom workflow |
| Zdjęcia przepisów się nie ładują | Nie skopiowano plików Storage | Krok 10 |
| Płatność nie nadaje roli Premium | Webhook nie dociera lub zły `STRIPE_WEBHOOK_SECRET` | `select * from payment_webhook_events order by received_at desc limit 5;`, logi `payments-webhook`, *Send test event* w Stripe |
| Logowanie Google kończy się błędem `redirect_uri_mismatch` | Brak URI w Google Cloud | Dodaj `https://<STAGING_REF>.supabase.co/auth/v1/callback` |
| Przekierowanie po logowaniu trafia na produkcję lub localhost | Zły *Site URL* / *Redirect URLs* | Krok 8.1 |
| Frontend łączy się z produkcyjnym Supabase | W Environment `staging` wpisano `SUPABASE_URL`/`SUPABASE_ANON_KEY` produkcji | Popraw sekrety i wdróż ponownie |

---

## Rozwój: wspólny workflow dla `main` i `develop`

Obecnie lista funkcji i kroków wdrożenia jest w **dwóch** plikach
(`main-deploy.yml` i `staging-deploy.yml`). Dodanie nowej Edge Function wymaga
zmiany w obu. Gdy kopia się sprawdzi, rozważ wyodrębnienie wspólnego,
parametryzowanego workflow (`on: workflow_call` z parametrem `environment`) i
wywoływanie go z dwóch cienkich plików (`main` → `production`, `develop` →
`staging`). Pozwoli to też dodać do `production` ręczne zatwierdzenie
(*Required reviewers*). Zmiana wymaga ostrożności, bo dotyka produkcji, więc
zrób ją osobnym PR po wdrożeniu kopii.

---

**Powiązane dokumenty:**

- [CI/CD Pipeline](./ci-cd-pipeline.md) – wdrożenie produkcji
- [Zarządzanie sekretami](./secrets-management.md) – lista sekretów produkcji
- [Worker Normalized Ingredients](./worker-production-deployment.md) – cron i monitoring workera
- [Konfiguracja płatności](../results/new-features/epics/premium-users/premium-users-payments-launch-plan.md) – Stripe

---

**Ostatnia aktualizacja:** 2026-11-24
