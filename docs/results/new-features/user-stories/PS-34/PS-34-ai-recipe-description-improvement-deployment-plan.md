# PS-34: Poprawa generowania opisu przepisu przez AI — Plan wdrożenia

> **User Story:** PS-34 — Poprawa generowania opisu przez AI
> **Data:** październik 2026
> **Środowisko docelowe:** Supabase Cloud (Edge Function `ai`)

---

## 1. Podsumowanie

PS-34 **nie wymaga migracji bazy danych**, **nowych zmiennych środowiskowych** ani **konfiguracji usług zewnętrznych**. Jedyna zmiana to aktualizacja sekcji `2. OPIS:` w funkcji `getSystemPrompt()` w pliku `supabase/functions/ai/ai.service.ts`.

Wdrożenie Edge Function `ai` odbywa się automatycznie w workflow `.github/workflows/main-deploy.yml` po pushu do `main`. Wymagane jest wyłącznie:
1. Ręczna weryfikacja manualna opisów wygenerowanych po wdrożeniu (Definition of Done: ≥5 przepisów)
2. Potwierdzenie braku regresji w istniejącym flow (kredyty, błędy, inne pola draftu)

| Obszar | Wymagane działanie ręczne |
|---|---|
| Migracja SQL | **Brak** |
| Nowa usługa zewnętrzna / konto / klucze API | **Brak** |
| Supabase Secrets / zmienne środowiskowe | **Brak** |
| GitHub Secrets | **Brak** |
| Nowa Edge Function / zmiana workflow CI | **Brak** — zmiana wyłącznie w istniejącej funkcji `ai` |
| Supabase Cron / pg_cron / webhooki | **Brak** |
| Firebase Hosting / konfiguracja domeny | **Brak** |
| Weryfikacja manualna wygenerowanych opisów | **Tak** — po wdrożeniu na dev/staging i na produkcji |

---

## 2. Krok 1 — Przed merge'em do `main` (weryfikacja lokalna)

### 2.1 Testy jednostkowe

```bash
npm run test:run
```

Upewnij się, że:
- Test w `supabase/functions/ai/ai.service.spec.ts` weryfikuje obecność nowych instrukcji stylu w prompcie (wymagany przez Definition of Done) — test musi przechodzić.
- Brak regresji w istniejących testach `ai.service.spec.ts` i pozostałych speców.

### 2.2 Lokalny smoke test na Supabase CLI

Uruchom lokalny Supabase:

```bash
supabase start
supabase functions serve ai --env-file ./supabase/.env.local
```

Następnie wykonaj co najmniej **5 żądań** testowych (konto z kredytami `draft`):

| # | Scenariusz | Oczekiwany wynik |
|---|---|---|
| 1 | Popularny przepis z tekstu (np. „Bigos") | Opis 3–5 zdań, element humorystyczny, ciekawostka jako ostatnie zdanie |
| 2 | Popularny przepis z tekstu po angielsku (np. „Beef stew") | Opis po **polsku**, 3–5 zdań, humor, ciekawostka |
| 3 | Przepis niszowy / domowy bez ustalonej nazwy | Ciekawostka o składniku lub technice, 3–5 zdań, brak błędu `200` |
| 4 | Przepis z obrazu (tryb `image`) | Identyczny styl jak tryb tekstowy |
| 5 | Przepis z daniem wegetariańskim / wegańskim | Brak nieodpowiednich treści, spójny ton |

Dla każdego żądania sprawdź:
- [ ] Pole `description` ma 3–5 zdań
- [ ] Ton jest familiarny i potoczny (nie encyklopedyczny)
- [ ] Ostatnie zdanie zawiera ciekawostkę
- [ ] Brak słowa „ciekawostka" wprost w tekście
- [ ] Brak treści wulgarnych lub obraźliwych
- [ ] Pozostałe pola draftu (`name`, `ingredients_raw`, `steps_raw`, metadane) **bez zmian**
- [ ] Status odpowiedzi: `200`
- [ ] `meta.warnings` nie zawiera błędów związanych z opisem

---

## 3. Krok 2 — Po merge'u: obserwacja pipeline'u

1. W GitHub Actions obserwować job **Deploy Backend (Supabase)** — krok **Deploy Edge Functions** dla funkcji `ai` musi zakończyć się sukcesem.
2. Brak kroku `db push` (brak migracji) — pipeline nie wykonuje żadnych operacji na bazie danych.
3. Po zakończeniu deployu odczekać ~1 minutę na propagację i przejść do weryfikacji na dev/staging.

---

## 4. Krok 3 — Weryfikacja po wdrożeniu (checklista manualna)

### 4.1 API (środowisko dev/staging lub produkcja — konto z kredytami `draft`)

Wykonaj co najmniej 5 żądań `POST /ai/recipes/draft` na wdrożonym środowisku:

**Weryfikacja stylu opisów:**
- [ ] Opis popularnego przepisu: 3–5 zdań, element humoru, ciekawostka jako ostatnie zdanie
- [ ] Opis przepisu z tekstu angielskiego: opis po **polsku** (nie w języku źródła)
- [ ] Opis przepisu niszowego: ciekawostka o składniku lub technice (nie o samym daniu)
- [ ] Opis przepisu z obrazu: identyczny styl jak tryb tekstowy
- [ ] Opis piątego przepisu do wyboru: spełnia wszystkie kryteria stylu

**Weryfikacja braku regresji:**
- [ ] Pozostałe pola odpowiedzi (`name`, `ingredients_raw`, `steps_raw`, `tags`, metadane) — bez zmian jakościowych
- [ ] `HTTP 200` dla poprawnych żądań
- [ ] `HTTP 402` przy wyczerpaniu kredytów `draft` — zachowanie bez zmian
- [ ] `HTTP 422` przy niepoprawnej treści wejściowej — zachowanie bez zmian
- [ ] Tryb `image` działa (brak regresji `HTTP 500`)

### 4.2 Frontend (weryfikacja end-to-end)

- [ ] Wejdź na `/recipes/new/assist` (konto `premium` lub `admin`) — brak błędów JS w konsoli
- [ ] Wygeneruj draft z tekstu — pole „Opis" w formularzu wypełnione nowym, dłuższym opisem
- [ ] Edytuj pole „Opis" po wygenerowaniu — pole edytowalne bez problemów
- [ ] Zapisz przepis i otwórz szczegóły — opis wyświetla się poprawnie, brak problemów z layoutem
- [ ] Wskaźnik kredytów `draft` działa poprawnie (odliczanie po każdym wywołaniu)
- [ ] Regresja PS-91 (metadane draftu): porcje, czasy, dieta, kuchnia, trudność, flagi Termorobot/Grill — wypełniane poprawnie

---

## 5. Rollback

| Warstwa | Procedura |
|---|---|
| Edge Function `ai` | Wdrożyć ponownie poprzedni commit (`revert PR + pipeline`) lub ręcznie: `supabase functions deploy ai` z poprzedniego commita. Stary prompt przywraca poprzedni styl opisu. |
| Baza danych | **Nie dotyczy** — brak migracji w PS-34. |
| Frontend | **Nie dotyczy** — brak zmian w UI. |

> **Ważne:** Rollback jest bezpieczny i nie wpływa na żadne inne funkcjonalności — zmiana promptu nie modyfikuje schematu danych, kontraktu API ani stanu bazy.

---

## 6. Dokumentacja produktowa po wdrożeniu

- [ ] `docs/results/project-summary.md`:
    - Sekcja „Stan realizacji" — dodać wpis o PS-34 (modyfikacja promptu opisu w `ai.service.ts`).
    - Tabela User Stories — zaktualizować wiersz PS-34 (przenieść z backlogu do „Gotowe").
- [ ] Zamknięcie checklisty Definition of Done w `PS-34-ai-recipe-description-improvement-user-story.md`.

---

## 7. Zależności

| Zależność | Status | Uwaga |
|---|---|---|
| Edge Function `ai` (istniejąca) | ✅ Wdrożona | Modyfikacja; brak nowego kroku w workflow |
| OpenAI API key (`OPENAI_API_KEY` w Supabase Secrets) | ✅ Istniejący | Bez zmian — ten sam model `gpt-4o-mini` |
| Kredyty `draft` użytkownika testowego | ✅ Wymagane | Konto z wystarczającą pulą do ≥5 testowych wywołań |
| Zmienne środowiskowe | ✅ Nie dotyczy | Brak nowych |

---

## 8. Czego NIE robi PS-34

| Element | Uwaga |
|---|---|
| Migracja bazy danych | Brak zmian w schemacie |
| Nowa Edge Function | Modyfikacja wyłącznie funkcji `ai` |
| Zmiany w kontrakcie API | Pole `description` pozostaje `string \| null` |
| Zmiany w warstwie UI | Brak nowych ani modyfikowanych komponentów |
| Zmiana konfiguracji OpenAI (model, temperatura, max_tokens) | Bez zmian — wyłącznie treść promptu |
| Zmiana mechanizmu kredytów `draft` | Bez zmian |
