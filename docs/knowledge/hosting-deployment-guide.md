# Przewodnik Wdrożenia PychaŚwiatowa na Hosting Produkcyjny

Ten dokument zawiera szczegółową instrukcję krok po kroku dotyczącą uruchomienia aplikacji PychaŚwiatowa na zewnętrznym hostingu produkcyjnym.

## Spis Treści

1. [Wymagania Wstępne](#1-wymagania-wstępne)
2. [Konfiguracja Supabase (Backend)](#2-konfiguracja-supabase-backend)
3. [Konfiguracja Firebase Hosting (Frontend)](#3-konfiguracja-firebase-hosting-frontend)
4. [Konfiguracja GitHub Actions (CI/CD)](#4-konfiguracja-github-actions-cicd)
5. [Konfiguracja Sekretów GitHub](#5-konfiguracja-sekretów-github)
6. [Pierwsze Wdrożenie](#6-pierwsze-wdrożenie)
7. [Weryfikacja i Rozwiązywanie Problemów](#7-weryfikacja-i-rozwiązywanie-problemów)

---

## 1. Wymagania Wstępne

### Konta i dostęp

Upewnij się, że posiadasz:

- [ ] **Konto GitHub** - z dostępem do repozytorium projektu
- [ ] **Konto Supabase** - [supabase.com](https://supabase.com) (darmowy plan wystarczy na start)
- [ ] **Konto Google/Firebase** - [console.firebase.google.com](https://console.firebase.google.com) (darmowy plan Spark)

### Narzędzia lokalne

Zainstaluj na swoim komputerze:

```bash
# Node.js (zalecana wersja 20+)
node --version

# npm
npm --version

# Supabase CLI
npm install -g supabase

# Firebase CLI
npm install -g firebase-tools

# Sprawdź instalację
supabase --version
firebase --version
```

---

## 2. Konfiguracja Supabase (Backend)

### Krok 2.1: Utworzenie projektu Supabase

1. Zaloguj się do [Supabase Dashboard](https://supabase.com/dashboard)
2. Kliknij **"New Project"**
3. Wypełnij formularz:
   - **Organization**: Wybierz lub utwórz organizację
   - **Project name**: `pychaswiatowa-prod` (lub inna nazwa)
   - **Database Password**: Wygeneruj silne hasło i **zapisz je bezpiecznie** (będzie potrzebne później)
   - **Region**: Wybierz najbliższy region (np. `eu-central-1` dla Europy)
4. Kliknij **"Create new project"**
5. Poczekaj na utworzenie projektu (może zająć kilka minut)

### Krok 2.2: Pobranie kluczy API

Po utworzeniu projektu:

1. Przejdź do **Settings** → **Data API**
2. Zapisz następujące wartości:
   - **Project URL**: np. `https://xxxxxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: klucz publiczny API
   - **Project Reference ID**: widoczny w URL dashboardu (np. `xxxxxxxxxxxxxxxx`)

### Krok 2.3: Wygenerowanie tokenu dostępu

1. Przejdź do [Account Settings](https://supabase.com/dashboard/account/tokens)
2. Kliknij **"Generate new token"**
3. Nazwij token: `pychaswiatowa-deploy`
4. Skopiuj i **zapisz bezpiecznie** wygenerowany token

### Krok 2.4: Linkowanie lokalnego projektu z Supabase Cloud

```bash
# Zaloguj się do Supabase CLI
supabase login

# Połącz lokalne repozytorium z projektem w chmurze
supabase link --project-ref <PROJECT_REFERENCE_ID>

# Zostaniesz poproszony o hasło do bazy danych
```

### Krok 2.5: Wdrożenie schematu bazy danych

```bash
# Wypchnij migracje do produkcyjnej bazy danych
supabase db push
# lub
supabase db push  --include-seed

# Potwierdź operację gdy zostaniesz zapytany
```

### Krok 2.6: Wdrożenie Edge Functions

```bash
# Wdróż wszystkie funkcje Edge
supabase functions deploy

# Opcjonalnie: wdróż pojedynczą funkcję
supabase functions deploy recipes
```

### Krok 2.7: Konfiguracja Storage (dla zdjęć przepisów)

1. W Supabase Dashboard przejdź do **Storage**
2. Utwórz nowy bucket:
   - Kliknij **"New bucket"**
   - **Name**: `recipe-images`
   - **Public bucket**: ✓ (zaznacz, aby zdjęcia były publicznie dostępne)
3. Skonfiguruj polityki RLS dla bucketa (opcjonalnie, dla większego bezpieczeństwa)

### Krok 2.8: Konfiguracja Authentication

1. Przejdź do **Authentication** → **URL Configuration**
2. Ustaw **Site URL**: adres Twojej aplikacji na Firebase (np. `https://pychaswiatowa.web.app`)
3. Dodaj do **Redirect URLs**:
   - `https://pychaswiatowa.web.app`
   - `https://pychaswiatowa.web.app/**`
   - `https://your-custom-domain.pl` (jeśli używasz własnej domeny)

---

## 3. Konfiguracja Firebase Hosting (Frontend)

### Krok 3.1: Utworzenie projektu Firebase

1. Przejdź do [Firebase Console](https://console.firebase.google.com)
2. Kliknij **"Add project"** (lub "Utwórz projekt")
3. Wypełnij formularz:
   - **Project name**: `pychaswiatowa-prod`
   - Google Analytics: możesz wyłączyć lub włączyć (opcjonalne)
4. Kliknij **"Create project"**

### Krok 3.2: Inicjalizacja Firebase w projekcie

```bash
# Zaloguj się do Firebase CLI
firebase login

# Zainicjalizuj Firebase w katalogu projektu
firebase init hosting
```

Podczas inicjalizacji wybierz:
- **Use an existing project**: Wybierz utworzony projekt Firebase
- **Public directory**: `dist/pychaswiatowa/browser`
- **Configure as a single-page app**: `Yes`
- **Set up automatic builds**: `No` (będziemy używać GitHub Actions)
- **Overwrite index.html**: `No`

### Krok 3.3: Konfiguracja firebase.json

Utwórz lub zmodyfikuj plik `firebase.json` w głównym katalogu projektu:

```json
{
  "hosting": {
    "public": "dist/pychaswiatowa/browser",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=86400"
          }
        ]
      }
    ]
  }
}
```

### Krok 3.4: Wygenerowanie klucza serwisowego

1. W Firebase Console przejdź do **Project settings** → **Service accounts**
2. Kliknij **"Generate new private key"**
3. Pobierz plik JSON i **zapisz jego zawartość** (będzie potrzebna jako sekret GitHub)

---

## 4. Konfiguracja GitHub Actions (CI/CD)

### Krok 4.1: Utworzenie workflow

Utwórz plik `.github/workflows/main-deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  # Job 1: Testy jednostkowe
  test:
    name: 🧪 Run Unit Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:run

  # Job 2: Wdrożenie backendu (Supabase)
  deploy-backend:
    name: 🚀 Deploy Backend (Supabase)
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Link Supabase project
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Push database migrations
        run: |
          supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}

      - name: Set Edge Function secrets
        run: |
          supabase secrets set APP_PUBLIC_URL=${{ secrets.APP_PUBLIC_URL }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Deploy Edge Functions
        run: |
          supabase functions deploy
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  # Job 3: Wdrożenie frontendu (Firebase)
  deploy-frontend:
    name: 🌐 Deploy Frontend (Firebase)
    runs-on: ubuntu-latest
    needs: [deploy-backend]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Configure production environment
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

      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_PYCHASWIATOWA_PROD }}'
          channelId: live
          projectId: pychaswiatowa-prod
```

### Krok 4.2: Alternatywny workflow dla Pull Requestów (opcjonalny)

Utwórz plik `.github/workflows/pr-preview.yml` dla podglądu zmian:

```yaml
name: PR Preview

on:
  pull_request:
    branches:
      - main

jobs:
  test:
    name: 🧪 Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:run
      - run: npm run lint

  preview:
    name: 🔍 Deploy Preview
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Configure environment
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
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_PYCHASWIATOWA_PROD }}'
          projectId: pychaswiatowa-prod
```

---

## 5. Konfiguracja Sekretów GitHub

### Krok 5.1: Przejdź do ustawień repozytorium

1. W repozytorium GitHub kliknij **Settings**
2. W menu bocznym wybierz **Secrets and variables** → **Actions**
3. Kliknij **"New repository secret"** dla każdego sekretu

### Krok 5.2: Dodaj wymagane sekrety

| Nazwa sekretu | Opis | Gdzie znaleźć |
|---------------|------|---------------|
| `SUPABASE_URL` | Publiczny URL projektu Supabase | Supabase Dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Publiczny klucz API | Supabase Dashboard → Settings → API → anon/public |
| `SUPABASE_PROJECT_ID` | Reference ID projektu | Widoczny w URL dashboardu Supabase |
| `SUPABASE_DB_PASSWORD` | Hasło do bazy danych | Ustawione podczas tworzenia projektu |
| `SUPABASE_ACCESS_TOKEN` | Token dostępu CLI | [Account Settings → Access Tokens](https://supabase.com/dashboard/account/tokens) |
| `FIREBASE_SERVICE_ACCOUNT_PYCHASWIATOWA_PROD` | Klucz serwisowy Firebase (JSON) | Firebase Console → Project Settings → Service accounts |
| `APP_PUBLIC_URL` | Publiczny URL aplikacji | np. `https://pychaswiatowa.web.app` |

### Krok 5.3: Weryfikacja sekretów

Po dodaniu wszystkich sekretów, lista powinna wyglądać następująco:

```
✓ SUPABASE_URL
✓ SUPABASE_ANON_KEY
✓ SUPABASE_PROJECT_ID
✓ SUPABASE_DB_PASSWORD
✓ SUPABASE_ACCESS_TOKEN
✓ FIREBASE_SERVICE_ACCOUNT_PYCHASWIATOWA_PROD
✓ APP_PUBLIC_URL
```

---

## 6. Pierwsze Wdrożenie

### Krok 6.1: Przygotowanie kodu

```bash
# Upewnij się, że jesteś na gałęzi main
git checkout main

# Pobierz najnowsze zmiany
git pull origin main

# Upewnij się, że testy przechodzą lokalnie
npm run test:run
```

### Krok 6.2: Ręczne wdrożenie backendu (pierwszy raz)

Przed pierwszym wdrożeniem automatycznym, warto wykonać ręczne wdrożenie:

```bash
# Połącz z projektem Supabase
supabase link --project-ref <PROJECT_REFERENCE_ID>

# Wypchnij migracje
supabase db push

# Wdróż funkcje
supabase functions deploy
```

### Krok 6.3: Uruchomienie automatycznego wdrożenia

```bash
# Wypchnij zmiany do gałęzi main
git push origin main
```

### Krok 6.4: Monitorowanie procesu

1. Przejdź do zakładki **Actions** w repozytorium GitHub
2. Obserwuj postęp workflow `Deploy to Production`
3. Workflow powinien przejść przez trzy etapy:
   - ✅ Run Unit Tests
   - ✅ Deploy Backend (Supabase)
   - ✅ Deploy Frontend (Firebase)

### Krok 6.5: Weryfikacja wdrożenia

Po zakończeniu workflow:

1. **Sprawdź frontend**: Otwórz URL aplikacji (np. `https://pychaswiatowa.web.app`)
2. **Sprawdź backend**: 
   - Otwórz Supabase Dashboard → Edge Functions
   - Zweryfikuj, że funkcje są aktywne
3. **Przetestuj aplikację**:
   - Spróbuj się zarejestrować
   - Spróbuj się zalogować
   - Dodaj testowy przepis

---

## 7. Weryfikacja i Rozwiązywanie Problemów

### Częste problemy i rozwiązania

#### Problem: "CORS error" przy wywołaniach API

**Rozwiązanie**: Sprawdź, czy funkcje Edge mają poprawnie skonfigurowane nagłówki CORS:

```typescript
// W każdej funkcji Edge
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

#### Problem: "Failed to push database migrations"

**Rozwiązanie**: 
1. Sprawdź czy hasło do bazy danych jest poprawne
2. Sprawdź czy masz aktualne migracje lokalnie
3. Sprawdź konflikty ze zdalną bazą: `supabase db diff`

#### Problem: "Firebase deployment failed"

**Rozwiązanie**:
1. Sprawdź czy klucz serwisowy jest poprawny (kompletny JSON)
2. Upewnij się, że `projectId` w workflow odpowiada nazwie projektu Firebase
3. Zweryfikuj, że katalog `dist/pychaswiatowa/browser` jest poprawnie generowany

#### Problem: "Environment variables not working"

**Rozwiązanie**:
1. Sprawdź czy plik `environment.production.ts` jest generowany podczas build
2. Zweryfikuj, że Angular używa konfiguracji produkcyjnej: `ng build --configuration production`
3. Sprawdź sekrety GitHub - nie mogą zawierać białych znaków na początku/końcu

### Komendy diagnostyczne

```bash
# Sprawdź status połączenia z Supabase
supabase status

# Wyświetl logi funkcji Edge
supabase functions logs <function-name>

# Sprawdź różnice w schemacie bazy
supabase db diff

# Lokalny build produkcyjny
npm run build -- --configuration production

# Test lokalny Firebase
firebase serve --only hosting
```

### Przydatne linki

- [Supabase Dashboard](https://supabase.com/dashboard)
- [Firebase Console](https://console.firebase.google.com)
- [GitHub Actions Logs](https://github.com/<owner>/<repo>/actions)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [Firebase CLI Documentation](https://firebase.google.com/docs/cli)

---

## Podsumowanie

Po wykonaniu wszystkich kroków, Twoja aplikacja PychaŚwiatowa będzie:

1. ✅ **Backend** hostowany na Supabase (baza danych + API + Auth + Storage)
2. ✅ **Frontend** hostowany na Firebase (CDN, szybkie ładowanie)
3. ✅ **CI/CD** skonfigurowane przez GitHub Actions (automatyczne wdrożenia)
4. ✅ **Bezpieczeństwo** zapewnione przez sekrety GitHub i RLS w Supabase

Każdy `push` do gałęzi `main` automatycznie uruchomi proces wdrożenia, który:
- Uruchomi testy jednostkowe
- Wdroży zmiany w bazie danych
- Wdroży funkcje Edge
- Zbuduje i wdroży frontend

---

*Ostatnia aktualizacja: Grudzień 2024*

