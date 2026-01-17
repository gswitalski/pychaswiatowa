# Szybki start: Wdrożenie z kluczem Gemini API

Ten dokument zawiera najważniejsze kroki potrzebne do wdrożenia nowej wersji aplikacji z obsługą Gemini API. Dla szczegółowych informacji zobacz [pełny przewodnik wdrożenia](./deployment-guide-gemini.md).

## Przed pierwszym wdrożeniem (konfiguracja jednorazowa)

### 1. Uzyskaj klucz API Gemini

```
🔗 https://aistudio.google.com/
→ Zaloguj się kontem Google
→ "Get API key" → Skopiuj klucz (AIza...)
```

### 2. Dodaj klucze do GitHub Secrets

**⚠️ WAŻNE:** Sprawdź najpierw czy `OPENAI_API_KEY` istnieje w Supabase:
```bash
supabase secrets list
```

**Jeśli tak, dodaj OPENAI_API_KEY do GitHub Secrets:**
```
GitHub → Settings → Secrets and variables → Actions
→ New repository secret (jeśli nie istnieje)
Name: OPENAI_API_KEY
Secret: <wartość z Supabase lub nowy klucz>
```

**Dodaj GEMINI_API_KEY:**
```
GitHub → Settings → Secrets and variables → Actions
→ New repository secret
Name: GEMINI_API_KEY
Secret: <wklej klucz Gemini>
```

### 3. Zaktualizuj workflow GitHub Actions

**Plik:** `.github/workflows/main-deploy.yml`

**Przed:**
```yaml
- name: Set Edge Function secrets
  run: |
    supabase secrets set APP_PUBLIC_URL=${{ secrets.APP_PUBLIC_URL }}
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

**Po:**
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

### 4. Commit i push

```bash
git add .github/workflows/main-deploy.yml
git commit -m "ci: add Gemini API key to deployment workflow"
git push origin main
```

---

## Każde kolejne wdrożenie (automatyczne)

### 1. Push do gałęzi `main`

```bash
git push origin main
```

### 2. Monitoruj na GitHub

```
GitHub → Actions → Najnowszy workflow
```

**Oczekiwany czas:** ~10-15 minut

**Kroki:**
- ✅ Run Unit Tests (~2-3 min)
- ✅ Deploy Backend (~3-5 min)
- ✅ Deploy Frontend (~5-7 min)

### 3. Weryfikacja (opcjonalnie)

```bash
# Sprawdź sekrety
supabase link --project-ref <PROJECT_ID>
supabase secrets list

# Powinieneś zobaczyć:
# APP_PUBLIC_URL
# OPENAI_API_KEY
# GEMINI_API_KEY ← Nowy
```

---

## Weryfikacja w aplikacji

### Test jako użytkownik premium:

1. ✅ Zaloguj się do aplikacji
2. ✅ Otwórz edycję przepisu z istniejącym zdjęciem
3. ✅ Kliknij przycisk **AI** obok pola zdjęcia
4. ✅ System powinien wybrać tryb **"z referencją zdjęcia"** (Gemini)
5. ✅ Kliknij **"Generuj"** i poczekaj ~30-90 sekund
6. ✅ Powinieneś zobaczyć nowe zdjęcie w modalu

---

## Najczęstsze problemy

### ❌ `Gemini API key not configured`

**Rozwiązanie:**
```bash
# Opcja A: Przez GitHub Secrets (zalecane)
GitHub → Settings → Secrets → Sprawdź GEMINI_API_KEY
→ Re-run workflow na GitHub

# Opcja B: Ręcznie przez CLI
supabase secrets set GEMINI_API_KEY=AIza...
```

### ❌ `Gemini API rate limit exceeded`

**Rozwiązanie:**
- Darmowy limit: **50-1500 zapytań/dzień** (zależnie od modelu)
- Poczekaj do następnego dnia lub rozważ płatny plan Google Cloud

### ❌ Workflow się nie uruchomił

**Rozwiązanie:**
```bash
# Sprawdź gałąź
git branch  # Powinna być * main

# Uruchom ręcznie
GitHub → Actions → "Run workflow"
```

---

## Szybkie linki

- 📘 [Pełny przewodnik wdrożenia](./deployment-guide-gemini.md)
- 🔑 [Google AI Studio](https://aistudio.google.com/)
- 🛠️ [ENV Setup](../ENV_SETUP.md)
- 📊 [GitHub Actions](../../.github/workflows/main-deploy.yml)

---

**Czas wdrożenia:** ~10-15 minut (automatycznie po push)  
**Konfiguracja jednorazowa:** ~5-10 minut
