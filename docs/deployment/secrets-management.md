# Zarządzanie sekretami – PychaŚwiatowa

## Kompletna lista sekretów

### Sekrety Supabase (Backend)

| Nazwa | Gdzie użyty | Jak uzyskać | Wymagany |
|-------|-------------|-------------|----------|
| `SUPABASE_ACCESS_TOKEN` | GitHub Actions (CLI auth) | Supabase Dashboard → Account → Access Tokens | ✅ |
| `SUPABASE_PROJECT_ID` | GitHub Actions (link) | Supabase Dashboard → Settings → General → Reference ID | ✅ |
| `SUPABASE_DB_PASSWORD` | GitHub Actions (db push) | Hasło bazy danych ustawione przy tworzeniu projektu | ✅ |
| `SUPABASE_URL` | Frontend (environment.prod.ts) | Supabase Dashboard → Settings → API → Project URL | ✅ |
| `SUPABASE_ANON_KEY` | Frontend (environment.prod.ts) | Supabase Dashboard → Settings → API → anon/public key | ✅ |
| `APP_PUBLIC_URL` | Edge Functions | URL aplikacji (np. `https://pychaswiatowa.pl`) | ✅ |

### Sekrety AI (Edge Functions)

| Nazwa | Gdzie użyty | Jak uzyskać | Wymagany |
|-------|-------------|-------------|----------|
| `OPENAI_API_KEY` | Edge Function `ai` | [OpenAI Platform](https://platform.openai.com/api-keys) | ✅ |
| `GEMINI_API_KEY` | Edge Function `ai` | [Google AI Studio](https://aistudio.google.com/) → "Get API key" | ✅ |

### Sekrety Workera

| Nazwa | Gdzie użyty | Jak uzyskać | Wymagany |
|-------|-------------|-------------|----------|
| `INTERNAL_WORKER_SECRET` | Edge Function `internal` + Cron | Wygenerowany losowo (patrz niżej) | ✅ |
| `NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE` | Edge Function `internal` | Wartość liczbowa (domyślnie `10`) | Opcjonalny |

### Sekrety Firebase (Frontend)

| Nazwa | Gdzie użyty | Jak uzyskać | Wymagany |
|-------|-------------|-------------|----------|
| `FIREBASE_SERVICE_ACCOUNT_PYCHASWIATOWA_PROD` | GitHub Actions (frontend deploy) | Firebase Console → Project Settings → Service Accounts → Generate new private key (JSON) | ✅ |

---

## Gdzie przechowywane są sekrety

### GitHub Secrets (Actions)

Sekrety używane przez workflow CI/CD:
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `APP_PUBLIC_URL`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT_PYCHASWIATOWA_PROD`

**Lokalizacja:** GitHub → Settings → Secrets and variables → Actions

### Supabase Edge Function Secrets

Sekrety dostępne w runtime Edge Functions:
- `APP_PUBLIC_URL`
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `INTERNAL_WORKER_SECRET`
- `NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE`

**Ustawiane automatycznie** przez workflow (krok "Set Edge Function secrets") przy każdym wdrożeniu.

### Frontend Environment (podmiana w build time)

Sekrety wstrzykiwane do `src/environments/environment.prod.ts` podczas budowania:
- `SUPABASE_URL` – adres API Supabase
- `SUPABASE_ANON_KEY` – publiczny klucz anon

**Ważne:** Klucze te nigdy nie są zapisane w kodzie źródłowym – są dynamicznie podmieniane w workflow przed `npm run build`.

### Supabase Database (funkcja PostgreSQL)

Sekret workera przechowywany w funkcji `get_internal_worker_secret()`:
- `INTERNAL_WORKER_SECRET` (musi być identyczny z wartością w Edge Function Secrets)

---

## Dodawanie / aktualizacja sekretów

### W GitHub Secrets

1. Przejdź do repozytorium na GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Kliknij **New repository secret** (lub **Update** przy istniejącym)
4. Wpisz **Name** i **Secret**
5. Kliknij **Add secret**

### W Supabase (przez CLI)

```bash
# Połącz z projektem (jeśli jeszcze nie połączony)
supabase link --project-ref <PROJECT_ID>

# Ustaw sekret
supabase secrets set NAZWA_SEKRETU=wartość

# Ustaw wiele naraz
supabase secrets set \
    OPENAI_API_KEY=sk-proj-... \
    GEMINI_API_KEY=AIza...

# Sprawdź listę ustawionych sekretów
supabase secrets list
```

### W Supabase (przez Dashboard)

1. Supabase Dashboard → **Project Settings** → **Edge Functions**
2. Zakładka **Secrets**
3. Dodaj/edytuj wartość
4. Kliknij **Save**

---

## Generowanie bezpiecznych sekretów

### INTERNAL_WORKER_SECRET

**PowerShell:**
```powershell
$bytes = New-Object Byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

**Bash / Linux / Mac:**
```bash
openssl rand -base64 32
```

---

## Konfiguracja w workflow (GitHub Actions)

Krok "Set Edge Function secrets" w `.github/workflows/main-deploy.yml`:

```yaml
- name: Set Edge Function secrets
  run: |
    supabase secrets set \
      APP_PUBLIC_URL=${{ secrets.APP_PUBLIC_URL }} \
      OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }} \
      GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### Dodanie nowego sekretu do workflow

1. Dodaj sekret do GitHub Secrets (patrz wyżej)
2. Dodaj zmienną do komendy `supabase secrets set` w workflow:
   ```yaml
   supabase secrets set \
     APP_PUBLIC_URL=${{ secrets.APP_PUBLIC_URL }} \
     OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }} \
     GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }} \
     NOWY_SEKRET=${{ secrets.NOWY_SEKRET }}
   ```
3. Commit i push zmiany workflow

---

## Ważne ostrzeżenia

### Nadpisywanie sekretów

⚠️ Krok `supabase secrets set` w workflow **nadpisuje** wartości przy każdym wdrożeniu. Jeśli sekret istnieje w Supabase ale **nie jest** w GitHub Secrets, workflow ustawi go na pustą wartość.

**Zasada:** Każdy sekret wymagany przez Edge Functions **musi** być również w GitHub Secrets.

### Sprawdzanie przed pierwszym wdrożeniem

Przed aktualizacją workflow sprawdź jakie sekrety już istnieją w Supabase:

```bash
supabase link --project-ref <PROJECT_ID>
supabase secrets list
```

Jeśli widzisz sekret (np. `OPENAI_API_KEY`) którego nie ma w GitHub Secrets — **najpierw dodaj go do GitHub Secrets**, a dopiero potem aktualizuj workflow.

### Rotacja kluczy

Przy rotacji klucza API:
1. Zaktualizuj wartość w GitHub Secrets
2. Uruchom workflow (push lub ręcznie) — nowa wartość zostanie automatycznie ustawiona w Supabase
3. Zweryfikuj: `supabase secrets list`

---

## Troubleshooting

### Sekret nie jest widoczny w Edge Function

**Przyczyny:**
- Sekret nie dodany do GitHub Secrets
- Sekret nie dodany do komendy `supabase secrets set` w workflow
- Workflow nie uruchomił się po dodaniu sekretu

**Rozwiązanie:**
1. Sprawdź GitHub Secrets (Settings → Secrets)
2. Sprawdź workflow YAML — czy sekret jest w `supabase secrets set`
3. Re-run workflow lub ustaw ręcznie: `supabase secrets set KLUCZ=wartość`

### Błąd "Failed to set secrets" w workflow

**Przyczyny:**
- `SUPABASE_ACCESS_TOKEN` wygasł
- Brak połączenia z projektem (krok `Link Supabase project` failed)

**Rozwiązanie:**
1. Wygeneruj nowy Access Token: Supabase Dashboard → Account → Access Tokens
2. Zaktualizuj `SUPABASE_ACCESS_TOKEN` w GitHub Secrets
3. Re-run workflow

---

**Powiązane dokumenty:**
- [CI/CD Pipeline](./ci-cd-pipeline.md) – jak workflow wykorzystuje sekrety
- [Gemini API Setup](./gemini-api-setup.md) – konfiguracja klucza Gemini
- [Worker NI](./worker-production-deployment.md) – konfiguracja `INTERNAL_WORKER_SECRET`

---

**Ostatnia aktualizacja:** 2026-07-21
