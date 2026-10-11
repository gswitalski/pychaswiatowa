# Plan wdrożenia — Generowanie przepisu z linku URL przez AI (PS-97)

> **User Story:** PS-97 — Generowanie przepisu z linku URL przez AI
> **Data:** październik 2026
> **Środowisko docelowe:** Firebase Hosting (frontend) + Supabase Cloud (backend)
> **Powiązane:** `PS-97-ai-recipe-from-url-user-story.md`, `PS-97-ai-recipe-from-url-api-plan.md`, `PS-97-ai-recipe-from-url-ui-plan.md`

---

## 1. Podsumowanie

PS-97 wymaga **modyfikacji istniejącej Edge Function `ai`** oraz **zmian w warstwie frontendu**. Nie wprowadza nowych tabel, sekretów, zewnętrznych usług ani migracji bazy danych.

Scraping strony działa przez **natywny `fetch` Deno** wewnątrz Edge Function — brak nowych zewnętrznych dostawców, brak nowych kluczy API.

| Obszar | Wymagane działanie ręczne |
|---|---|
| Supabase Secrets / zmienne środowiskowe | **Brak** |
| Migracje SQL | **Brak** |
| Edge Function `ai` | Deploy przez CI (GitHub Actions) — **brak ręcznego kroku** |
| Firebase Hosting (frontend) | Deploy przez CI (GitHub Actions) — **brak ręcznego kroku** |
| Konfiguracja zewnętrzna (OAuth, klucze AI) | **Brak** — brak nowych kluczy; istniejące klucze OpenAI/Gemini pozostają bez zmian |
| Nowe zewnętrzne serwisy / subskrypcje | **Brak** |

> Wszystkie automatyczne kroki (build Angular, testy Vitest, Playwright, deploy Firebase, deploy Supabase Functions) wykonują istniejące GitHub Actions — **bez modyfikacji workflow CI/CD**.

---

## 2. Wymagania środowiska produkcyjnego

### 2.1 Deno / Supabase Edge Functions — wychodzący ruch sieciowy

Edge Function `ai` po zmianie będzie inicjowała wychodzące żądania HTTP do zewnętrznych domen (scraping URL przepisów). Supabase Cloud **domyślnie zezwala** na wychodzący ruch sieciowy z Edge Functions — **brak dodatkowej konfiguracji**.

> **Weryfikacja (jednorazowa przed wdrożeniem na produkcję):** potwierdzić w Supabase Dashboard (`Project Settings → Edge Functions`) że wychodzący ruch HTTP jest dozwolony dla projektu. Na planach Supabase Free i Pro jest to standardowo włączone.

### 2.2 Limity czasowe Supabase Edge Functions

Domyślny limit czasu wykonania Edge Function w Supabase to **150 s** (plan Free) lub **400 s** (plan Pro). Timeout scrapingu ustawiony w kodzie na **10 s** + czas modelu AI (~5–30 s) mieści się w limicie dla obu planów — **brak potrzeby zmiany konfiguracji**.

---

## 3. Weryfikacja po wdrożeniu (checklista manualna)

Wykonać na **produkcji** lub **stagingu** po automatycznym deployu CI:

### Happy path
1. Zaloguj się kontem `premium` lub `admin`.
2. Przejdź na `/recipes/new/assist`.
3. Kliknij zakładkę „Link URL".
4. Wklej publiczny URL strony z przepisem (np. znana polska strona kulinarna).
5. Kliknij „Generuj przepis".
6. Weryfikuj: spinner widoczny przez cały czas generowania.
7. Weryfikuj: formularz `/recipes/new` otwarty z wypełnionymi polami (nazwa, składniki, kroki).
8. Weryfikuj: wskaźnik kredytów `draft` zmniejszył się o 1.

### Walidacja URL po stronie frontendu
9. Wpisz `nie-to-adres` → komunikat błędu inline pod polem (bez wysyłania żądania do API).
10. Wpisz `ftp://example.com` → komunikat błędu inline.
11. Zostaw pole puste i kliknij „Generuj przepis" → komunikat błędu inline, żądanie nie wysłane.

### Obsługa błędów sieciowych
12. Podaj URL strony wymagającej logowania / paywall → komunikat inline o nieudanym pobraniu + sugestia trybu Tekst.
13. (Opcjonalnie — środowisko dev/staging z mockiem) Symuluj timeout → komunikat inline o przekroczeniu czasu.

### Regresja
14. Przełącz na zakładkę „Tekst" → wklej przepis tekstowy → „Generuj przepis" działa jak dotychczas.
15. Przełącz na zakładkę „Obraz" → workflow zdjęcia bez zmian.
16. Wyczerpanie kredytów → dialog `AI_CREDITS_EXHAUSTED` pojawia się (niezależnie od trybu).
17. Konto `user` (nie premium) → guard blokuje dostęp do `/recipes/new/assist` (bez zmian).

---

## 4. Rollback

W razie problemów:

| Warstwa | Procedura rollbacku |
|---|---|
| Frontend | Rollback deployu Firebase Hosting do poprzedniej wersji (standardowa procedura projektu) |
| Edge Function `ai` | Rollback do poprzedniej wersji funkcji w Supabase Dashboard (`Functions → ai → Versioning`) lub ponowny deploy starszego commita przez CI |
| Baza danych | **Nie dotyczy** — brak migracji |

Obie warstwy można wycofać **niezależnie**. Stara wersja frontendu (bez zakładki „Link URL") działa poprawnie ze starą i nową wersją Edge Function (nie wysyła `mode: "url"` — brak regresji).

---

## 5. Dokumentacja produktowa (po release)

- Zaktualizować `docs/results/project-summary.md`:
    - Sekcja **0. Stan realizacji** — dodać wpis PS-97.
    - Sekcja **2. User Stories** — dodać wiersz PS-97.
    - Sekcja **5. Endpointy API** — rozszerzyć opis `POST /ai/recipes/draft` o tryb `url` i nowe kody błędów.
    - Sekcja **6. Widoki UI** — zaktualizować opis widoku `/recipes/new/assist` o zakładkę „Link URL".
- Zamknąć checklistę Definition of Done w pliku `PS-97-ai-recipe-from-url-user-story.md`.
