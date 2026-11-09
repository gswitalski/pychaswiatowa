# Runbook wdrożenia produkcyjnego – PychaŚwiatowa

Dokument opisuje, jak wdrożyć produkcję ręcznie przez GitHub Actions i co robić, gdy wdrożenie zakończy się częściowo.

**Workflow:** `.github/workflows/main-deploy.yml` (wyzwalacz wyłącznie `workflow_dispatch`)
**Kontrole CI:** `.github/workflows/ci.yml`
**Stan na:** 2026-11-09 (konfiguracja zaimplementowana lokalnie, jeszcze niewdrożona na `main`)

---

## 1. Zasady

1. Merge ani push do `main` **nie wdraża** produkcji. Uruchamia tylko CI.
2. Produkcję wdraża wyłącznie osoba uruchamiająca `Deploy to Production` ręcznie.
3. Wdrożyć można **tylko aktualny HEAD `main`**. Wdrożenie starszego commita, brancha lub taga jest odrzucane.
4. Kolejność jest stała: **migracje bazy → sekrety i Edge Functions → Firebase Hosting**.
5. **Migracje bazy nie są automatycznie cofane.** Żaden krok workflow nie wykonuje rollbacku bazy.
6. Workflow nie używa `db reset`, `--include-all`, `migration repair` ani `--prune`.

---

## 2. Przed wdrożeniem (checklist)

- [ ] PR został zatwierdzony i zmergowany do `main`.
- [ ] Workflow `CI` dla tego commita na `main` zakończył się sukcesem (preflight sprawdza to automatycznie).
- [ ] Przejrzano nowe pliki w `supabase/migrations/` pod kątem operacji destrukcyjnych (`DROP`, `TRUNCATE`, `ALTER ... TYPE`, `DELETE`) i zgodności wstecznej (patrz sekcja 6).
- [ ] Jeśli dodano nową Edge Function: jest dopisana do kroku `Deploy Edge Functions` w workflow (patrz sekcja 8).
- [ ] Jeśli dodano nowy sekret Edge Function: jest w GitHub Secrets i w kroku `Ustaw sekrety Edge Functions`.
- [ ] Znasz ostatnie dobre wdrożenie (SHA) i masz dostęp do Supabase Dashboard oraz Firebase Console.

---

## 3. Uruchomienie wdrożenia

1. Ustal SHA aktualnego HEAD `main`:
   ```bash
   git fetch origin
   git rev-parse origin/main
   ```
2. GitHub → **Actions** → **Deploy to Production** → **Run workflow**.
3. Wybierz branch **`main`** i wklej SHA (min. 7 znaków) w polu `expected_sha`.
4. Alternatywnie z CLI:
   ```bash
   gh workflow run main-deploy.yml --ref main -f expected_sha=<SHA>
   ```
5. Obserwuj zakładkę **Summary** uruchomienia: zawiera dry-run migracji i listę wykonanych etapów.

Równoległe wdrożenia są wykluczone przez `concurrency: production-deploy` (bez anulowania trwającego wdrożenia). Kolejne uruchomienie czeka w kolejce. GitHub trzyma w kolejce tylko jedno oczekujące uruchomienie, więc kolejne zastępuje poprzednie.

---

## 4. Co robi workflow

| Etap | Job | Zmienia produkcję? | Warunek przejścia |
|------|-----|--------------------|-------------------|
| 1 | `preflight` | Nie | Ręczne uruchomienie, branch `main`, `expected_sha` = SHA workflow = HEAD `main`, zielone CI dla tego SHA, niepuste i poprawne sekrety |
| 2 | `ci` | Nie | Walidacja migracji, lint workflow, build produkcyjny Angulara, Vitest (bez sekretów) |
| 3 | `deploy-backend` | **Tak** | Ponowne sprawdzenie HEAD `main`; link; lista migracji; **dry-run**; `db push`; sekrety; Edge Functions |
| 4 | `deploy-frontend` | **Tak** | Tylko po sukcesie backendu; build z produkcyjnym `environment.production.ts`; Firebase Hosting `live` |

Wersje narzędzi są przypięte: akcje do pełnych SHA commitów, Supabase CLI `3.1.0`, `firebase-tools` `15.35.0`, Node `24`, runner `ubuntu-24.04`. Aktualizuj je świadomie w osobnym PR, po sprawdzeniu notatek wydania.

---

## 5. Postępowanie przy częściowym błędzie

Najpierw ustal, **który krok zawiódł**, i przeczytaj blok „Podsumowanie częściowego błędu” w Summary uruchomienia. Linie `[x]` w Summary pokazują etapy już wykonane na produkcji.

**Nie ponawiaj wdrożenia odruchowo.** Każde ponowne uruchomienie przechodzi całą ścieżkę od początku.

| Zawiódł krok | Stan produkcji | Działanie |
|--------------|----------------|-----------|
| `preflight` / `ci` | Bez zmian | Napraw przyczynę (zły SHA, brak sekretu, czerwone CI) i uruchom ponownie. |
| Ponowna weryfikacja HEAD `main` | Bez zmian | `main` zmienił się w trakcie. Uruchom z nowym SHA. |
| `Link`, `Lista migracji`, `Dry-run` | Bez zmian (tylko odczyt) | Najczęściej rozjazd historii migracji (zdalna baza ma migracje, których nie ma w repo) lub zły token/hasło. Napraw i uruchom ponownie. **Nie używaj `--include-all` ani `migration repair` bez analizy.** |
| `Zastosuj migracje` | **Możliwy stan częściowy bazy** | Patrz sekcja 5.1. Edge Functions i frontend **nie** zostały wdrożone (stary kod działa na nowszej lub częściowo zmienionej bazie). |
| `Ustaw sekrety Edge Functions` | Baza zmigrowana, funkcje stare | Sprawdź `supabase secrets list`. Napraw sekret i uruchom ponownie (migracje zostaną pominięte jako już zastosowane). |
| `Deploy Edge Functions` | Baza zmigrowana, **część funkcji nowa, część stara** | Patrz sekcja 5.2. |
| `Deploy Frontend` | Backend nowy, frontend stary | Patrz sekcja 5.3. |

### 5.1. Błąd podczas migracji bazy

- **Nie zakładaj, że zmiany bazy są odwracalne ani że cały `db push` jest atomowy.** Migracje są zapisywane w historii pojedynczo po zastosowaniu, a niektóre operacje SQL nie działają w transakcji.
- Sprawdź, które migracje się zastosowały (lokalnie, z dostępem do projektu produkcyjnego):
  ```bash
  supabase link <PROJECT_REF>
  supabase migration list --remote
  ```
- Przeanalizuj logi kroku oraz stan schematu w Supabase Dashboard (Table Editor / SQL Editor, tylko odczyt).
- Możliwe ścieżki naprawy, w kolejności preferencji:
  1. **Naprawa „do przodu”:** nowa migracja (`supabase/migrations/<nowy_timestamp>_fix_*.sql`) przez zwykły PR, CI, merge i ponowne wdrożenie.
  2. **Przywrócenie z kopii zapasowej / PITR:** tylko jeśli plan Supabase to umożliwia. Upewnij się wcześniej, jakie kopie są dostępne. Ta operacja gubi dane zapisane po punkcie przywracania i wymaga osobnej decyzji właściciela.
  3. **`supabase migration repair`:** wyłącznie ręcznie, po pełnym zrozumieniu stanu bazy i historii. Nigdy w workflow.
- Do czasu naprawy **nie wdrażaj** funkcji ani frontendu.

### 5.2. Błąd podczas wdrażania Edge Functions

- Migracje i sekrety są już zastosowane. Część funkcji działa w nowej wersji, część w starej, więc API może być chwilowo niespójne.
- Sprawdź w Supabase Dashboard → Edge Functions, które funkcje mają nową wersję (czas wdrożenia).
- Jeśli przyczyna jest przejściowa (sieć, limit API): uruchom wdrożenie ponownie z tym samym SHA, o ile jest nadal HEAD `main`. Migracje będą pominięte, a wdrożenie funkcji jest idempotentne.
- Jeśli przyczyna leży w kodzie: napraw przez PR (`revert` lub poprawka), po merge uruchom nowe wdrożenie.

### 5.3. Błąd podczas wdrażania frontendu

- Backend jest już nowy, a użytkownicy nadal widzą poprzedni frontend. Dlatego migracje i zmiany API muszą być wstecznie kompatybilne (sekcja 6).
- Sprawdź Firebase Console → Hosting → Release history.
- Przyczyna przejściowa: ponów wdrożenie z tym samym SHA, jeśli jest nadal HEAD `main`.
- Szybki powrót do poprzedniej wersji frontendu: Firebase Console → Hosting → Release history → **Rollback** (nie wymaga workflow i nie dotyka bazy ani funkcji).

### 5.4. Rollback kodu

Workflow odmówi wdrożenia starego SHA, bo zawsze wdraża HEAD `main`. Rollback kodu robi się więc przez:

1. `git revert` błędnego commita na branchu `chore/...` lub `fix/...`, PR, CI i merge do `main`.
2. Nowe uruchomienie `Deploy to Production` z nowym HEAD.

Dla pilnego przywrócenia samego frontendu użyj Rollback w Firebase Console (sekcja 5.3). Nie ma automatycznego rollbacku bazy.

---

## 6. Zasady bezpiecznych migracji (żeby błąd częściowy był do opanowania)

- Stosuj wzorzec **expand → migrate → contract**: najpierw dodawaj kolumny, tabele i funkcje (stary kod nadal działa), usuwanie dopiero w kolejnym wdrożeniu, gdy nic ich nie używa.
- Unikaj w jednej migracji wielu niezależnych zmian. Mniejsze migracje łatwiej ocenić po błędzie.
- Operacje destrukcyjne (`DROP`, `TRUNCATE`, `ALTER COLUMN TYPE`) wymagają osobnego opisu w PR i potwierdzenia, że istnieje kopia danych.
- Dry-run w Summary pokazuje, które migracje zostały wybrane do zastosowania, ale workflow **nie zatrzymuje się** po nim i od razu przechodzi do `db push` (bez GitHub Environment z wymaganym zatwierdzeniem nie ma punktu wstrzymania). Dlatego listę nowych migracji przejrzyj w PR **przed** uruchomieniem wdrożenia.
- Nazwy plików muszą mieć postać `YYYYMMDDHHMMSS_nazwa_snake_case.sql`. Supabase CLI po cichu pomija inne pliki, więc `ci.yml` odrzuca takie pliki.

---

## 7. Sekrety wymagane przez workflow

Wszystkie jako **GitHub Secrets** (Settings → Secrets and variables → Actions). Wartości nie są nigdzie zapisywane w repo.

**Wymagane (puste lub brak = przerwanie w `preflight`, zanim cokolwiek się zmieni):**

`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `APP_PUBLIC_URL`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_PYCHASWIATOWA_PROD`

**Opcjonalne (puste = pominięte, nie nadpisują istniejących wartości w Supabase; Edge Function użyje wartości domyślnej z kodu):**

`AI_DRAFT_CREDITS_FREE`, `AI_DRAFT_CREDITS_PREMIUM`, `AI_IMAGE_CREDITS_PREMIUM`, `AI_CREDITS_WARN_THRESHOLD_PERCENT`, `AI_CREDITS_CRON_SECRET`

> Zmiana względem poprzedniego workflow: wcześniej puste sekrety opcjonalne były przekazywane do `supabase secrets set` jako puste wartości i mogły skasować konfigurację w Supabase.

Sekrety są przekazywane przez `env:` na poziomie kroku i używane jako zmienne powłoki. Nie są interpolowane w treści skryptów. Szczegóły: [Zarządzanie sekretami](./secrets-management.md).

---

## 8. Znane luki (wymagają osobnej decyzji, nie zmieniono zachowania)

Pipeline wdraża dokładnie ten sam zestaw funkcji co poprzedni workflow. W repo istnieją dodatkowo katalogi `supabase/functions/billing`, `checkout`, `payments-webhook` i `utils`, które **nie są wdrażane** przez workflow. Edge Functions korzystają też z sekretów (np. `STRIPE_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`, `INTERNAL_WORKER_SECRET`), których workflow nie ustawia. Jeśli mają być wdrażane automatycznie, trzeba je świadomie dopisać do workflow w osobnym PR (włącznie z `--no-verify-jwt` dla `payments-webhook`, zgodnie z `supabase/config.toml`).

---

## 9. Dobre praktyki operacyjne

- Wdrażaj w godzinach, w których możesz obserwować logi i reagować na błąd.
- Po wdrożeniu sprawdź: logowanie, listę przepisów, jedną funkcję AI (jeśli zmieniana) i logi Edge Functions w Supabase.
- Ustawienia repozytorium (branch protection, GitHub Environment `production`): [GitHub – ustawienia bezpieczeństwa](./github-security-settings.md).

---

**Powiązane dokumenty:**
- [CI/CD Pipeline](./ci-cd-pipeline.md)
- [Zarządzanie sekretami](./secrets-management.md)
- [GitHub – ustawienia bezpieczeństwa](./github-security-settings.md)
