# PS-92: Dedykowany przycisk wklejania zdjęcia ze schowka — Plan wdrożenia

> **User Story:** PS-92 — Dedykowany przycisk „Wklej ze schowka" w strefie zdjęcia formularza przepisu
> **Data:** październik 2026
> **Środowisko docelowe:** Firebase Hosting (frontend) + Supabase Cloud (backend bez zmian)

---

## 1. Podsumowanie

PS-92 wymaga **wyłącznie wdrożenia frontendu**. Backend, baza danych, Storage, sekrety Supabase i cron **nie są dotknięte**.

Deploy aplikacji Angular wykonuje **GitHub Actions** (push do gałęzi docelowej / merge do `main`). Poniżej: **kroki ręczne** (minimalne) oraz weryfikacja po release.

| Obszar | Wymagane działanie ręczne |
|---|---|
| Supabase Secrets | **Brak** |
| Migracje SQL | **Brak** |
| Edge Functions | **Brak deployu** (brak zmian kodu funkcji) |
| Firebase Hosting | Automatycznie przez CI |
| Konfiguracja zewnętrzna (OAuth, AI keys) | **Brak** |
| Clipboard / uprawnienia przeglądarki | Po stronie użytkownika — bez konfiguracji serwera |

---

## 2. Wymagania środowiska produkcyjnego

Funkcja `navigator.clipboard.read()` działa tylko w **secure context** (HTTPS). Produkcja (`pychaswiatowa.web.app`) spełnia ten warunek — **brak dodatkowej konfiguracji hostingu**.

Lokalnie: `ng serve` na `localhost` również jest secure context.

---

## 3. Weryfikacja po wdrożeniu (checklista manualna)

Wykonać na **produkcji** lub **stagingu** po automatycznym deployu frontendu:

1. **Formularz — happy path**  
   - `/recipes/new`: skopiuj obraz → „Wklej ze schowka" → podgląd → zapis przepisu ze zdjęciem.

2. **Edycja — upload**  
   - `/recipes/:id/edit`: wklej ze schowka → upload → snackbar Undo (jak po paste).

3. **Asysta AI**  
   - `/recipes/new/assist` (konto premium/admin): tryb obrazu → przycisk → draft AI.

4. **Brak obrazu w schowku**  
   - Komunikat inline zgodny z AC.

5. **Odmowa uprawnień**  
   - Odmów dostępu do schowka w promptcie przeglądarki → komunikat z odesłaniem do Ctrl+V.

6. **Przeglądarka bez API** (opcjonalnie / devtools)  
   - Przycisk disabled + tooltip; Ctrl+V i drop nadal działają.

7. **Regresja**  
   - Drag & drop i wybór pliku bez regresji.

---

## 4. Rollback

W razie problemów wystarczy **rollback deployu frontendu** do poprzedniej wersji na Firebase Hosting (standardowa procedura projektu). Backend nie wymaga rollbacku.

---

## 5. Dokumentacja produktowa (opcjonalnie po release)

- Krótka wzmianka w `docs/results/project-summary.md` (sekcja US-027 / formularz przepisu) — bez zmian w tabeli endpointów.
- Zamknięcie checklisty Definition of Done w pliku user story PS-92.
