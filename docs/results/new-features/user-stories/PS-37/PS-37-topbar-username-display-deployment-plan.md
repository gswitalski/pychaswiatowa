# PS-37: Wyświetlanie nazwy użytkownika w topbarze — Plan wdrożenia

> **User Story:** `PS-37-topbar-username-display-user-story.md`
> **Data:** listopad 2026
> **Środowisko docelowe:** Firebase Hosting (frontend); Supabase bez zmian

---

## 1. Podsumowanie

PS-37 jest zmianą **wyłącznie frontendową**. **Nie wymaga**: migracji bazy danych, zmian RLS, nowych/zmienionych
Edge Functions, zmiennych środowiskowych, sekretów GitHub/Supabase, konfiguracji usług zewnętrznych ani zmian
workflow CI.

| Obszar | Działanie |
|---|---|
| Migracja SQL / RLS / seed | **Brak** (`supabase/migrations/**` bez zmian) |
| Zmiany kodu Edge Functions (`supabase/functions/**`) | **Brak** |
| `shared/contracts/types.ts` | **Brak** |
| Supabase Secrets / GitHub Secrets / zmienne środowiskowe | **Brak** |
| Zmiana workflow (`.github/workflows/main-deploy.yml`) | **Brak** |
| Frontend (Angular → Firebase Hosting) | **Tak** — standardowy build i deploy |
| Weryfikacja manualna | **Tak** (lokalnie przed merge i po wdrożeniu) |

> **Ważne (zachowanie pipeline'u):** workflow `main-deploy.yml` **nie ma filtrów ścieżek** — po każdym pushu do `main`
> wykonuje `supabase db push --remote --yes` i ponowny `supabase functions deploy` wszystkich funkcji (w tym `me`
> i `profile`). Przy PS-37 będzie to **no-op/redeploy niezmienionego kodu** (brak nowych migracji, ten sam kod
> funkcji). Jest to oczekiwane i **nie** oznacza zmiany backendu; nie należy próbować omijać tego kroku.

---

## 2. Krok 1 — przed merge'em (lokalnie)

```powershell
npm run lint
npm run test:run
npm run build
```

- `npm run lint` — **jedyne miejsce kontroli lintu**: workflow produkcyjny go nie uruchamia.
- `npm run test:run` — pełny zestaw Vitest (w CI job `test` to bramka przed deployem).
- `npm run build` — w CI buduje job `deploy-frontend` (po `deploy-backend`); błąd kompilacji zablokowałby wdrożenie
  dopiero po stronie backendu — sprawdzić lokalnie wcześniej.
- Wyniki zapisać jawnie jako `PASS`/`FAIL` (nie `NIE_WYKONANO`) — wymóg DoD.

Dodatkowo potwierdzić brak zmian poza frontendem:

```powershell
git diff --stat origin/main -- supabase shared/contracts
```

Oczekiwany wynik: **pusty**. Niepusty wynik = wyjście poza zakres PS-37 (zatrzymać i zweryfikować).

Smoke test lokalny (`ng serve` + lokalny Supabase, użytkownik testowy z `.env.local`) — checklista z planu UI,
sekcja 8 (szerokości, długość nazwy, role, zmiana nazwy, OAuth bez nazwy, wylogowanie/logowanie, dostępność).

---

## 3. Krok 2 — merge i obserwacja pipeline'u

1. Merge do `main` ⇒ uruchamia `Deploy to Production`.
2. Kolejność jobów: `test` → `validate-backend` → `deploy-backend` → `deploy-frontend`.
3. `deploy-backend`: oczekiwane „brak nowych migracji" w `db push`; funkcje redeployowane bez zmian — **bez** działań ręcznych.
4. `deploy-frontend`: build Angulara i deploy na kanał `live` projektu `pychaswiatowa`.
5. Po zakończeniu odczekać krótko na propagację CDN/cache (twarde odświeżenie `Ctrl+F5`).

---

## 4. Krok 3 — weryfikacja po wdrożeniu (produkcja; konto testowe)

Status wszystkich pozycji: `NIE_WYKONANO` do czasu wdrożenia.

- [ ] Topbar pokazuje nazwę obok ikony (≥600 px); <600 px tylko ikona; nagłówek „Zalogowano jako …" w menu
- [ ] Tooltip i `aria-label` poprawne; brak błędów w konsoli przeglądarki
- [ ] Zmiana nazwy w Ustawieniach odświeża topbar bez przeładowania; po F5 nazwa nadal nowa
- [ ] W Network tab **brak** dodatkowego `GET /me` po zapisie profilu
- [ ] Konto `admin`: nazwa widoczna także w `/admin/dashboard`
- [ ] Wylogowanie i logowanie na inne konto: brak nazwy poprzedniego użytkownika
- [ ] Gość (`PublicLayout`) i `WelcomeHeader` bez zmian wizualnych
- [ ] Brak nowych żądań sieciowych względem stanu sprzed zmiany (poza istniejącymi)

---

## 5. Rollback

| Warstwa | Procedura |
|---|---|
| Frontend | Revert PR/commita w `main` ⇒ pipeline wdroży poprzednią wersję; awaryjnie — przywrócenie poprzedniej wersji w Firebase Hosting (Console → Hosting → Release history → Rollback), bez czekania na CI |
| Edge Functions | **Nie dotyczy** — brak zmian kodu |
| Baza danych | **Nie dotyczy** — brak migracji |
| Sekrety / konfiguracja | **Nie dotyczy** |

Rollback jest bezpieczny: zmiana nie modyfikuje danych ani kontraktów API; stan nazwy żyje tylko w pamięci karty
(brak `localStorage`), więc nie ma stanu do migracji wstecz.

---

## 6. Dokumentacja po wdrożeniu

- [ ] `docs/results/project-summary.md` (po akceptacji review widoków — etap summary):
    - sekcja 0 „Stan realizacji" — wpis o PS-37 (nazwa użytkownika w topbarze, `CurrentUserStateService`),
    - sekcja 6 „Widoki UI" — opis topbara (nazwa obok ikony, nagłówek menu),
    - sekcja 5 — **bez zmian** (brak nowych endpointów).
- [ ] Zamknięcie checklisty DoD w `PS-37-topbar-username-display-user-story.md` (z korektami N1, N2, N4 z planu UI).
- [ ] Artefakt review widoków: `PS-37-topbar-username-display-review-views-r{R}.md` lub jawnie `BEZ_REVIEW` z powodem.
- [ ] Review API: **nie dotyczy** (brak zmian API) — zapisać jako `BEZ_REVIEW` z powodem „brak zmian API/DB/kontraktów".

---

## 7. Zależności

| Zależność | Status | Uwaga |
|---|---|---|
| `GET /me` (Edge Function `me`) | Istniejąca, wdrożona | Źródło `username`; bez zmian |
| `PUT /profile` (Edge Function `profile`) | Istniejąca, wdrożona | Źródło nazwy po zapisie; bez zmian |
| Angular Material (`MatTooltipModule`, `MatDividerModule`) | Już w projekcie | Brak nowych paczek npm |
| Nowe zależności npm | **Brak** | `package.json` / `package-lock.json` bez zmian |
| Konto testowe z `.env.local` | Wymagane do testów ręcznych | Nie zapisywać w repo |

---

## 8. Czego NIE robi PS-37

| Element | Uwaga |
|---|---|
| Migracja bazy danych / RLS | Brak |
| Nowa lub zmieniona Edge Function | Brak |
| Zmiana kontraktów DTO | Brak |
| Nowe sekrety / zmienne środowiskowe | Brak |
| Zmiana workflow CI/CD | Brak |
| Zmiana `WelcomeHeader`, `PublicLayout` | Brak |
| Synchronizacja nazwy między kartami | Poza zakresem |
