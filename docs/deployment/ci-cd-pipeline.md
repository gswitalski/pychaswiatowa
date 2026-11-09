# CI/CD Pipeline – PychaŚwiatowa

## Przegląd

CI i CD są rozdzielone na dwa workflow GitHub Actions:

| Workflow | Plik | Wyzwalacze | Co robi |
|----------|------|-----------|---------|
| **CI** | `.github/workflows/ci.yml` | `push` na `main` i `feature/**`, `pull_request` do `main`, `workflow_call` | Tylko weryfikacja kodu. Bez sekretów i bez wdrożeń. |
| **Deploy to Production** | `.github/workflows/main-deploy.yml` | **wyłącznie** `workflow_dispatch` | Ręczne wdrożenie aktualnego HEAD `main`: migracje → Edge Functions → Firebase. |

**Push ani merge do `main` nie wdraża produkcji.** Wdrożenie wymaga ręcznego uruchomienia (patrz [Runbook wdrożenia](./production-deployment-runbook.md)).

---

## CI (`ci.yml`)

Node 24, runner `ubuntu-24.04`, uprawnienia `contents: read`, brak sekretów.

Kolejność kroków:
1. Lint polityki workflow (`.github/scripts/lint-workflows.cjs`): akcje przypięte do SHA, brak `latest`, brak `pull_request_target`, brak sekretów w `ci.yml`, `main-deploy.yml` tylko z `workflow_dispatch`.
2. Walidacja struktury migracji (`.github/scripts/validate-migrations.cjs`): wzorzec nazwy, poprawna data, brak duplikatów wersji, brak pustych plików.
3. `npm ci`
4. Testowy `src/environments/environment.production.ts` z atrapami (`https://ci.invalid`), generowany przez `.github/scripts/write-production-environment.cjs`. Plik jest w `.gitignore`.
5. Angular production build (`npm run build -- --configuration production`)
6. Vitest, wszystkie testy jednostkowe (`npm run test:run`)
7. Smoke testy konfiguracji workflow `tests/*.cjs`, **jeśli istnieją w danym branchu** (na `main` obecnie ich nie ma, więc krok jest pomijany z komunikatem)

Nie uruchamiamy Playwright/E2E ani testów Deno. CI nie łączy się z żadną bazą Supabase.

Anulowanie: nowszy push na branchu `feature/**` lub nowa aktualizacja PR anuluje poprzedni bieg. Biegi na `main` nie są anulowane.

---

## Deploy to Production (`main-deploy.yml`)

```
workflow_dispatch (ręcznie, wymaga expected_sha)
    │
    ▼
┌──────────────────────────────┐
│ preflight                    │  ref = main, SHA = HEAD main, zielone CI,
│ (bez zmian na produkcji)     │  sekrety niepuste i poprawne
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│ ci (workflow_call → ci.yml)  │  migracje (struktura), build, Vitest
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│ deploy-backend               │  ponowna kontrola HEAD → link → lista migracji
│ (Supabase)                   │  → DRY-RUN → db push → sekrety → Edge Functions
└──────────────┬───────────────┘
               ▼
┌──────────────────────────────┐
│ deploy-frontend              │  build z produkcyjnym środowiskiem
│ (Firebase Hosting, live)     │  → Firebase deploy
└──────────────────────────────┘
```

### Zabezpieczenia

- **Tylko HEAD `main`:** `preflight` odrzuca uruchomienie z innego brancha, z innym SHA niż `expected_sha` oraz z commita, który nie jest aktualnym HEAD `main`. `deploy-backend` powtarza kontrolę tuż przed pierwszą zmianą na produkcji.
- **`concurrency: production-deploy`** (`cancel-in-progress: false`): nigdy dwa wdrożenia naraz i żadne nie jest przerywane w połowie.
- **Bramki przed migracją:** poprawny build produkcyjny i Vitest muszą przejść przed jakąkolwiek zmianą bazy.
- **Dry-run:** `supabase db push --remote --dry-run` i `supabase migration list --remote` (tylko odczyt) są zapisywane w Summary.
- **Sekrety:** przekazywane przez `env:` na poziomie kroku. Brak interpolacji `${{ secrets.* }}` w skryptach. Wymagane sekrety są sprawdzane (niepuste, format) **przed** pierwszą zmianą. Puste sekrety opcjonalne są pomijane i nie kasują wartości w Supabase.
- **Przypięte wersje:** akcje po SHA commita (`checkout` v7.0.1, `setup-node` v7.1.0, `supabase/setup-cli` v3.2.0, `action-hosting-deploy` v0.11.0), Supabase CLI `3.1.0`, `firebase-tools` `15.35.0`, Node `24`.
- **Uprawnienia:** `contents: read` na poziomie workflow. `actions: read` tylko w `preflight` (odczyt wyniku CI). Firebase deploy nie dostaje `GITHUB_TOKEN`.
- **Brak `environment:`** w workflow do czasu świadomego skonfigurowania GitHub Environment `production` (patrz [GitHub – ustawienia bezpieczeństwa](./github-security-settings.md)).

### Hosting SPA

Firebase Hosting obsługuje aplikację jednostronicową: wszystkie ścieżki (np. `/recipes/123`) są przekierowywane do `index.html`, a routingiem zajmuje się Angular.

### CORS

Komunikacja między frontendem (domena Firebase) a backendem (domena Supabase) wymaga CORS. Każda Edge Function dołącza nagłówki `Access-Control-Allow-*` i obsługuje `OPTIONS` (preflight).

---

## Monitorowanie

1. GitHub → **Actions** → **CI** (kontrola commitów/PR) lub **Deploy to Production** (wdrożenia).
2. W uruchomieniu wdrożenia otwórz **Summary**: SHA, historia i dry-run migracji, lista wykonanych etapów.

---

## Troubleshooting

### Preflight odrzuca wdrożenie

| Komunikat | Przyczyna | Rozwiązanie |
|-----------|-----------|-------------|
| `Wdrożenie dozwolone wyłącznie z brancha main` | Wybrano inny branch w „Run workflow” | Wybierz `main`. |
| `expected_sha ... nie pasuje` | SHA wpisane z błędem lub z innego commita | Skopiuj `git rev-parse origin/main`. |
| `nie jest aktualnym HEAD main` | `main` zmienił się po uruchomieniu | Uruchom ponownie z nowym SHA. |
| `Brak zakończonego sukcesem workflow CI` | CI jeszcze trwa lub zawiodło | Poczekaj na zielone CI dla tego commita. |
| `Puste lub nieustawione wymagane sekrety` | Brak sekretu w GitHub Secrets | Dodaj sekret (patrz [Zarządzanie sekretami](./secrets-management.md)). |

### Błąd na etapie wdrożenia

Patrz [Runbook wdrożenia, sekcja „Postępowanie przy częściowym błędzie”](./production-deployment-runbook.md#5-postępowanie-przy-częściowym-błędzie). Migracje nie są cofane automatycznie.

### Frontend wdrożony, ale zmiany nie widoczne

1. Wyczyść cache przeglądarki lub otwórz w trybie incognito.
2. Sprawdź Firebase Console → Hosting → Release history.

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

---

**Powiązane dokumenty:**
- [Runbook wdrożenia produkcyjnego](./production-deployment-runbook.md)
- [GitHub – ustawienia bezpieczeństwa](./github-security-settings.md)
- [Zarządzanie sekretami](./secrets-management.md)
- [Gemini API Setup](./gemini-api-setup.md)

---

**Ostatnia aktualizacja:** 2026-11-09
