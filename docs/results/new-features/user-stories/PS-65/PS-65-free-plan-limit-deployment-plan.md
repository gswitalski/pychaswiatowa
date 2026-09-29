# PS-65: Egzekwowanie limitu planu dla użytkownika Free — Plan wdrożenia

> **User Story:** PS-65 — Egzekwowanie limitów planu dla użytkownika Free
> **Data:** wrzesień 2026
> **Środowisko docelowe:** Firebase Hosting (frontend) + Supabase Cloud (backend)

---

## 1. Podsumowanie

PS-65 nie wymaga migracji bazy danych. Zmiany obejmują wyłącznie:

- nową zmienną środowiskową Edge Functions,
- modyfikację kodu Edge Function `plan`,
- modyfikację frontendu (Angular).

Deploy kodu wykonuje się automatycznie przez GitHub Actions (push do gałęzi `main`). Poniżej opisane są **wyłącznie kroki ręczne**, które muszą zostać wykonane przed lub po automatycznym deployu.

| Obszar | Wymagane działanie |
|---|---|
| Zmienne środowiskowe (Supabase Secrets) | Nowa zmienna `PLAN_LIMIT_FREE` — **ręcznie przed deployem funkcji** |
| Baza danych | Brak migracji |
| Supabase Cron | Brak nowych jobów |
| Weryfikacja po wdrożeniu | Ręczna lista kontrolna |

---

## 2. Krok 1 — Zmienna środowiskowa Edge Functions

**Typ:** Konfiguracja Supabase (Secrets)  
**Kiedy:** Przed deployem Edge Function `plan` (musi być dostępna w momencie uruchomienia funkcji)

W panelu Supabase (`Project Settings → Edge Functions → Secrets`) lub przez Supabase CLI:

```bash
supabase secrets set PLAN_LIMIT_FREE=3
```

| Zmienna | Wartość domyślna | Opis |
|---|---|---|
| `PLAN_LIMIT_FREE` | `3` | Maksymalna liczba pozycji w „Moim planie" dla użytkownika Free (`app_role = 'user'`). Konfigurowalna bez redeploymentu — zmiana wartości w Secrets wymaga jedynie ponownego uruchomienia funkcji (automatyczne przy następnym wywołaniu). |

> **Uwaga:** Wartość `3` jest spójna z wierszem tabeli porównawczej na stronie `/pricing`. Jeśli wartość zostanie zmieniona w Supabase Secrets, konieczna jest synchroniczna aktualizacja `pricing.config.ts` na frontendzie (nie aktualizuje się automatycznie).

---

## 3. Krok 2 — Weryfikacja po wdrożeniu

Po automatycznym deployu przez GitHub Actions wykonać ręczną weryfikację:

**Backend (Edge Function `plan`):**

- [ ] `POST /plan/recipes` dla roli `user` z `count(plan_recipes) >= 3` zwraca `422 PLAN_LIMIT_EXCEEDED_FREE`
- [ ] Odpowiedź `422` zawiera pola `details.free_limit`, `details.premium_limit`, `details.upgrade_url`
- [ ] `POST /plan/recipes` dla roli `user` z `count < 3` kończy się sukcesem (`200 OK`)
- [ ] `POST /plan/recipes` dla roli `premium` z `count >= 3` nie zwraca `422 PLAN_LIMIT_EXCEEDED_FREE` (obowiązuje limit 50)
- [ ] `POST /plan/recipes` dla roli `admin` z `count >= 3` nie zwraca `422 PLAN_LIMIT_EXCEEDED_FREE`
- [ ] Istniejące pozycje planu użytkownika Free z liczbą > 3 (grandfathering) nie są usuwane — nadal widoczne w `GET /plan`

**Frontend (Angular):**

- [ ] Drawer „Mój plan" dla roli `user` wyświetla licznik „X / 3 pozycji" w nagłówku
- [ ] Licznik zmienia kolor na `warn` gdy `count = 3`
- [ ] Drawer „Mój plan" dla roli `premium` i `admin` nie wyświetla licznika z limitem
- [ ] Próba dodania przepisu do planu przy limicie otwiera dialog `PlanLimitExceededDialogComponent`
- [ ] Dialog zawiera poprawne wartości limitu Free (3) i Premium (50)
- [ ] Przycisk „Przejdź na Premium" w dialogu nawiguje do `/pricing`
- [ ] Strona `/pricing` — wiersz „Mój plan (limit pozycji)" pokazuje „3 pozycje" (Free) i „50 pozycji" (Premium)

---

## 4. Zależności

| Zależność | Status | Uwaga |
|---|---|---|
| Tabela `plan_recipes` (Supabase) | ✅ Istniejąca | Bez zmian struktury |
| Edge Function `plan` (istniejąca) | ✅ Istniejąca | Wymaga modyfikacji handlera `POST /plan/recipes` |
| `pricing.config.ts` (istniejący) | ✅ Istniejący | Wymaga aktualizacji wartości wiersza „Mój plan" |
| `PLAN_LIMIT_FREE` (Supabase Secret) | ❌ Do ustawienia | Krok 1 — przed deployem |
| PS-63 (strona `/pricing`) | ✅ Zrealizowana | Tabela porównawcza już istnieje; zmiana tylko wartości wiersza |

---

## 5. Czego NIE robi PS-65

| Element | Historyjka |
|---|---|
| Checkout i zakup konta Premium | PS-66 (checkout i płatności) |
| Automatyczna degradacja roli przy braku płatności | PS-67 (zarządzanie subskrypcją) |
| Usunięcie nadliczbowych pozycji istniejących użytkowników Free | Poza zakresem (grandfathering) |
| Limit miejsca na zdjęcia (Storage) | Przyszłe historyjki |
| Limit liczby przepisów lub kolekcji | Poza zakresem PS-65 (per analiza v02: brak twardego niskiego limitu przepisów) |
