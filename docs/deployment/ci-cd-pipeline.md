# CI/CD Pipeline – PychaŚwiatowa

## Przegląd

Aplikacja wykorzystuje automatyczny proces CI/CD oparty na **GitHub Actions**. Wdrożenie na produkcję odbywa się automatycznie po każdym `push` do gałęzi `main`.

**Plik workflow:** `.github/workflows/main-deploy.yml`

---

## Architektura pipeline

```
push do main
    │
    ▼
┌─────────────────────────┐
│  Job 1: Run Unit Tests  │  ~2-3 min
│  (Angular tests)        │
└───────────┬─────────────┘
            │ ✅ (needs: test)
            ▼
┌─────────────────────────┐
│  Job 2: Deploy Backend  │  ~3-5 min
│  (Supabase)             │
└───────────┬─────────────┘
            │ ✅ (needs: deploy-backend)
            ▼
┌─────────────────────────┐
│  Job 3: Deploy Frontend │  ~5-7 min
│  (Firebase Hosting)     │
└─────────────────────────┘
```

Joby wykonują się **sekwencyjnie** – każdy następny czeka na pomyślne zakończenie poprzedniego. Dzięki temu frontend jest wdrażany dopiero po poprawnym wdrożeniu backendu, co zapewnia spójność środowiska.

**Całkowity czas wdrożenia:** ~10-15 minut

---

## Job 1: Run Unit Tests

- Instalacja zależności (`npm ci`)
- Uruchomienie testów Angular (`ng test --watch=false`)
- Jeśli testy nie przejdą → pipeline przerywa się, brak wdrożenia

---

## Job 2: Deploy Backend (Supabase)

Kroki:
1. **Setup Supabase CLI** – instalacja narzędzia CLI
2. **Link Supabase project** – połączenie z projektem produkcyjnym
3. **Push database migrations** – zastosowanie migracji SQL
4. **Set Edge Function secrets** – ustawienie zmiennych środowiskowych (patrz [Zarządzanie sekretami](./secrets-management.md))
5. **Deploy Edge Functions** – wdrożenie wszystkich funkcji (ai, categories, collections, internal, ...)

---

## Job 3: Deploy Frontend (Firebase)

Kroki:
1. **Install dependencies** – `npm ci`
2. **Replace environment variables** – dynamiczna podmiana kluczy deweloperskich na produkcyjne w `src/environments/environment.prod.ts` (na podstawie GitHub Secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`)
3. **Build Angular app** – budowanie aplikacji (`npm run build` w trybie produkcyjnym)
4. **Deploy to Firebase Hosting** – wdrożenie plików statycznych

### Hosting SPA

Firebase Hosting jest skonfigurowany do obsługi aplikacji jednostronicowej (SPA) – wszystkie ścieżki (np. `/recipes/123`) są przekierowywane do `index.html`, a routingiem zajmuje się Angular w przeglądarce.

### CORS

Komunikacja między frontendem (domena Firebase) a backendem (domena Supabase) wymaga CORS. Każda Edge Function automatycznie:
- Dołącza nagłówki `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`
- Obsługuje żądania `OPTIONS` (preflight requests)

---

## Monitorowanie wdrożenia

### Przez GitHub

1. Przejdź do repozytorium → zakładka **Actions**
2. Znajdź najnowszy workflow **"Deploy to Production"**
3. Kliknij, aby zobaczyć szczegóły poszczególnych jobów i kroków

### Oczekiwany sukces

```
✅ Unit tests passed
✅ Database migrations applied
✅ Edge Functions deployed
✅ Frontend deployed to Firebase
```

---

## Ręczne uruchomienie workflow

Jeśli workflow nie uruchomił się automatycznie:

1. GitHub → **Actions** → wybierz workflow
2. Kliknij **"Run workflow"**
3. Wybierz gałąź `main`
4. Kliknij **"Run workflow"**

---

## Troubleshooting

### Workflow się nie uruchomił

**Przyczyny:**
- Push nie był do gałęzi `main` – sprawdź: `git branch`
- Workflow jest zablokowany – sprawdź: Settings → Actions → General → "Allow all actions"
- Plik workflow ma błąd składni YAML

**Rozwiązanie:**
```bash
# Sprawdź gałąź
git branch  # Powinna być * main

# Uruchom ręcznie
GitHub → Actions → "Run workflow"
```

### Krok "Set Edge Function secrets" failed

**Przyczyny:**
- `SUPABASE_ACCESS_TOKEN` wygasł lub jest niepoprawny
- Błąd w składni komendy `supabase secrets set`
- Supabase CLI nie zainstalowało się w poprzednim kroku

**Rozwiązanie:**
1. Sprawdź czy `SUPABASE_ACCESS_TOKEN` jest aktualny w GitHub Secrets
2. Wygeneruj nowy token: Supabase Dashboard → Account → Access Tokens
3. Zaktualizuj wartość w GitHub Secrets

### Frontend wdrożony, ale zmiany nie widoczne

**Przyczyny:**
- Cache przeglądarki
- CDN Firebase nie odświeżył się

**Rozwiązanie:**
1. Wyczyść cache przeglądarki (Ctrl+Shift+Del)
2. Otwórz w trybie incognito
3. Sprawdź Firebase Console → Hosting → Release history
4. (Fallback) Re-run job "Deploy Frontend" w GitHub Actions

### Migracje bazy danych failed

**Przyczyny:**
- Konflikt z istniejącą migracją
- Nieprawidłowa składnia SQL

**Rozwiązanie:**
1. Sprawdź logi kroku "Push database migrations"
2. Porównaj status migracji: `supabase db remote list`
3. Napraw SQL i push ponownie

---

## Koszty infrastruktury

### Supabase Edge Functions

| Plan | Limit wywołań |
|------|---------------|
| Free | 500 000 / miesiąc |
| Pro ($25/mies) | 2 000 000 / miesiąc |

### Firebase Hosting

| Plan | Transfer |
|------|----------|
| Spark (darmowy) | 10 GB / miesiąc (360 MB/dzień) |
| Blaze (pay-as-you-go) | $0.15 / GB powyżej limitu |

Aplikacja Angular po zbudowaniu (~2-5 MB) mieści się w darmowym limicie dla małego/średniego ruchu.

---

**Powiązane dokumenty:**
- [Zarządzanie sekretami](./secrets-management.md) – konfiguracja sekretów dla pipeline
- [Gemini API Setup](./gemini-api-setup.md) – dodanie nowego klucza API do workflow

---

**Ostatnia aktualizacja:** 2026-07-21
