# Checklista wdrożenia: Gemini API Integration

**Data:** _______________  
**Wykonawca:** _______________  
**Środowisko:** Produkcja  

---

## ☑️ Przed wdrożeniem (jednorazowo)

### 1. Pozyskanie klucza API Gemini
- [ ] Zalogowanie do [Google AI Studio](https://aistudio.google.com/)
- [ ] Utworzenie/pobranie klucza API Gemini
- [ ] Zapisanie klucza w bezpiecznym miejscu (format: `AIza...`)
- [ ] (Opcjonalnie) Ustawienie limitów budżetowych w Google Cloud

### 2. Konfiguracja GitHub Secrets
- [ ] Dostęp do Settings → Secrets and variables → Actions w repozytorium
- [ ] Utworzenie sekretu `GEMINI_API_KEY` z wartością klucza
- [ ] Weryfikacja, że sekret jest zapisany (widoczny na liście, ale ukryta wartość)

### 3. Aktualizacja workflow
- [ ] Otwarcie pliku `.github/workflows/main-deploy.yml`
- [ ] Dodanie `GEMINI_API_KEY` do kroku `Set Edge Function secrets` (linia ~56-60)
- [ ] Weryfikacja składni YAML (np. przez VS Code lub yamllint)
- [ ] Commit zmian workflow do repozytorium
- [ ] Push do gałęzi `main` (uruchamia wdrożenie)

### 4. Dokumentacja
- [ ] Przeczytanie [Deployment Quick Start](./deployment-quickstart.md)
- [ ] (Opcjonalnie) Przeczytanie [pełnego przewodnika wdrożenia](./deployment-guide-gemini.md)

---

## ☑️ Podczas wdrożenia (automatyczne)

### 1. Monitorowanie workflow GitHub Actions
- [ ] Wejście w zakładkę **Actions** na GitHub
- [ ] Znalezienie najnowszego workflow **"Deploy to Production"**
- [ ] Weryfikacja statusu:
  - [ ] ✅ Job 1: Run Unit Tests (~2-3 min)
  - [ ] ✅ Job 2: Deploy Backend (~3-5 min)
    - [ ] ✅ Step: Setup Supabase CLI
    - [ ] ✅ Step: Link Supabase project
    - [ ] ✅ Step: Push database migrations
    - [ ] ✅ Step: **Set Edge Function secrets** ← **Kluczowy krok!**
    - [ ] ✅ Step: Deploy Edge Functions
  - [ ] ✅ Job 3: Deploy Frontend (~5-7 min)

### 2. Sprawdzenie logów w przypadku błędów
- [ ] Jeśli Job 2 (Backend) zakończył się błędem, sprawdzenie logów kroku `Set Edge Function secrets`
- [ ] Upewnienie się, że `GEMINI_API_KEY` jest poprawnie przekazany

**Oczekiwany wynik:**
```
✅ Secret GEMINI_API_KEY set successfully
```

---

## ☑️ Po wdrożeniu (weryfikacja)

### 1. Weryfikacja sekretów w Supabase
```bash
# Połącz z projektem
supabase link --project-ref <PROJECT_ID>

# Sprawdź listę sekretów
supabase secrets list
```

**Oczekiwany wynik:**
- [ ] `APP_PUBLIC_URL` - ✅ Widoczny
- [ ] `OPENAI_API_KEY` - ✅ Widoczny
- [ ] `GEMINI_API_KEY` - ✅ Widoczny ← **Nowy sekret**

### 2. Test funkcji AI w aplikacji (jako użytkownik premium)

**Scenariusz 1: Generowanie obrazu bez referencji (OpenAI)**
- [ ] Logowanie do aplikacji produkcyjnej
- [ ] Otworzenie edycji przepisu **bez zdjęcia**
- [ ] Kliknięcie przycisku **AI** obok pola zdjęcia
- [ ] System wybiera tryb: **"Generuj z przepisu"**
- [ ] Kliknięcie **"Generuj"**
- [ ] Poczekanie ~30-60 sekund
- [ ] ✅ Nowe zdjęcie wygenerowane (OpenAI)

**Scenariusz 2: Generowanie obrazu z referencją (Gemini)**
- [ ] Otworzenie edycji przepisu **z istniejącym zdjęciem**
- [ ] Kliknięcie przycisku **AI** obok pola zdjęcia
- [ ] System wybiera tryb: **"Generuj z referencją zdjęcia"**
- [ ] Kliknięcie **"Generuj"**
- [ ] Poczekanie ~60-90 sekund
- [ ] ✅ Nowe zdjęcie wygenerowane (Gemini)
- [ ] ✅ Zdjęcie różni się od referencji (inna kompozycja, kąt)

### 3. Sprawdzenie logów Edge Functions
```bash
# Pobierz ostatnie 50 logów funkcji ai
supabase functions logs ai --limit 50
```

**Szukaj wpisów:**
- [ ] `[INFO] Generating image with Gemini (image-to-image)`
- [ ] `[INFO] Gemini API payload`
- [ ] `[INFO] Recipe image generated successfully (Gemini)`

**Brak błędów:**
- [ ] ❌ NIE ma: `Gemini API key not configured`
- [ ] ❌ NIE ma: `Gemini API rate limit exceeded`
- [ ] ❌ NIE ma: `Gemini API timeout`

### 4. Test regresji (funkcjonalności niezwiązane z Gemini)

- [ ] Generowanie draftu przepisu (funkcja `/ai/recipes/draft`) - ✅ Działa
- [ ] Wyszukiwanie przepisów - ✅ Działa
- [ ] Przeglądanie przepisów publicznych - ✅ Działa
- [ ] Dodawanie nowego przepisu - ✅ Działa
- [ ] Edycja istniejącego przepisu - ✅ Działa

---

## ☑️ Problemy i ich rozwiązania

### Problem 1: `Gemini API key not configured`
- [ ] Sprawdzenie GitHub Secrets → `GEMINI_API_KEY` istnieje
- [ ] Sprawdzenie workflow → krok `Set Edge Function secrets` zawiera `GEMINI_API_KEY`
- [ ] Re-run workflow na GitHub: Actions → Re-run all jobs
- [ ] (Fallback) Ręczne ustawienie: `supabase secrets set GEMINI_API_KEY=AIza...`

### Problem 2: `Gemini API rate limit exceeded`
- [ ] Sprawdzenie limitu dziennego w [Google AI Studio Dashboard](https://aistudio.google.com/app/apikey)
- [ ] Poczekanie do następnego dnia (limit się resetuje)
- [ ] (Opcjonalnie) Rozważenie płatnego planu Google Cloud
- [ ] (Opcjonalnie) Zmiana modelu w `ai.service.ts` na szybszy (np. `gemini-2.0-flash-exp`)

### Problem 3: Workflow nie uruchomił się automatycznie
- [ ] Sprawdzenie gałęzi: `git branch` → powinna być `main`
- [ ] Sprawdzenie Settings → Actions → General → **"Allow all actions"** jest włączone
- [ ] Ręczne uruchomienie: GitHub → Actions → "Run workflow"

### Problem 4: Frontend wdrożył się, ale zmiany nie widoczne
- [ ] Wyczyszczenie cache przeglądarki (Ctrl+Shift+Del)
- [ ] Otwarcie aplikacji w trybie incognito
- [ ] Sprawdzenie Firebase Console → Hosting → Release history
- [ ] (Fallback) Re-deploy frontendu: GitHub → Actions → Re-run job "Deploy Frontend"

---

## ☑️ Finalizacja

### 1. Dokumentacja wdrożenia
- [ ] Wypełnienie tej checklisty
- [ ] Zanotowanie czasu wdrożenia: _______________
- [ ] Zanotowanie napotkanych problemów (jeśli były): _______________
- [ ] Archiwizacja checklisty w dokumentacji projektu

### 2. Komunikacja z zespołem
- [ ] Powiadomienie zespołu o zakończeniu wdrożenia
- [ ] Przekazanie informacji o dostępności nowej funkcji (generowanie obrazów z referencją)
- [ ] (Opcjonalnie) Przeszkolenie zespołu z nowej funkcjonalności

### 3. Monitorowanie po wdrożeniu
- [ ] Monitoring użycia API Gemini przez **7 dni** (Google AI Studio Dashboard)
- [ ] Monitoring kosztów OpenAI przez **7 dni** (OpenAI Usage Dashboard)
- [ ] Monitoring wywołań Edge Functions przez **7 dni** (Supabase Dashboard)
- [ ] Zgłaszanie anomalii lub problemów do zespołu DevOps

---

## 📊 Metryki wdrożenia

| Metryka | Wartość |
|---------|---------|
| Czas rozpoczęcia | _______________ |
| Czas zakończenia | _______________ |
| Całkowity czas wdrożenia | _______________ |
| Liczba błędów | _______________ |
| Liczba re-runów workflow | _______________ |

---

## ✅ Potwierdzenie

**Wdrożenie zakończone pomyślnie:**
- [ ] Wszystkie testy przeszły pomyślnie
- [ ] Funkcja generowania obrazów z Gemini działa poprawnie
- [ ] Brak regresji w istniejących funkcjonalnościach
- [ ] Dokumentacja jest aktualna

**Podpis wykonawcy:** _______________  
**Data:** _______________

---

**Wersja checklisty:** 1.0  
**Ostatnia aktualizacja:** 2026-01-17
