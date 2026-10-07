# PS-93: Zrobienie zdjęcia aparatem urządzenia mobilnego — Plan wdrożenia

> **User Story:** PS-93 — Zrobienie zdjęcia aparatem w formularzu przepisu i w asyście AI (tryb obrazu)
> **Data:** październik 2026
> **Środowisko docelowe:** Firebase Hosting (frontend) + Supabase Cloud (backend bez zmian)

---

## 1. Podsumowanie

PS-93 wymaga **wyłącznie wdrożenia frontendu**. Backend, baza danych, Storage, sekrety Supabase i cron **nie są dotknięte**.

Deploy aplikacji Angular wykonuje **GitHub Actions** (merge do gałęzi docelowej / `main`). Poniżej: **kroki ręczne** oraz weryfikacja po release.

| Obszar | Wymagane działanie ręczne |
|---|---|
| Supabase Secrets | **Brak** |
| Migracje SQL | **Brak** |
| Edge Functions | **Brak deployu** (brak zmian kodu funkcji) |
| Firebase Hosting | Automatycznie przez CI |
| Konfiguracja zewnętrzna (OAuth, AI keys) | **Brak** |
| Uprawnienia aparatu | Po stronie OS/przeglądarki przy pierwszym użyciu — bez konfiguracji serwera |
| Apple / Google store | **Nie dotyczy** (aplikacja webowa PWA/hosting, nie natywna apka) |

---

## 2. Wymagania środowiska produkcyjnego

- Produkcja (`pychaswiatowa.web.app`) działa w **HTTPS** — wymagane dla dostępu do kamery w wielu przeglądarkach mobilnych.
- **Brak** dodatkowej konfiguracji Firebase Hosting (nagłówki Permissions-Policy dla kamery nie są wymagane przy flow `input[capture]` — aparat obsługuje OS).
- Lokalnie: `ng serve` na `localhost` — wystarczy do smoke testu pickera; pełny test aparatu na fizycznym urządzeniu lub emulatorze z kamerą.

---

## 3. Weryfikacja po wdrożeniu (checklista manualna)

Wykonać na **produkcji** lub **stagingu** po automatycznym deployu frontendu:

1. **Formularz — happy path (mobile)**  
   - `/recipes/new`: „Zrób zdjęcie” → aparat → podgląd → zapis przepisu ze zdjęciem.

2. **Edycja — upload (mobile)**  
   - `/recipes/:id/edit`: zdjęcie z aparatu → upload → snackbar Undo (jak po pliku).

3. **Asysta AI (mobile, premium/admin)**  
   - `/recipes/new/assist`, tryb obrazu → „Zrób zdjęcie” → podgląd → „Dalej” → draft.

4. **Anulowanie aparatu**  
   - Zamknięcie UI aparatu bez zatwierdzenia — brak błędu, stan bez zmian.

5. **Zastąpienie obrazu**  
   - Istniejący podgląd → „Zrób zdjęcie” → nowy podgląd; Undo w edycji jeśli dotyczy.

6. **Desktop — fallback**  
   - „Zrób zdjęcie” otwiera picker lub kamerę (zależnie od przeglądarki) — brak regresji innych metod wgrywania.

7. **Regresja**  
   - Schowek (PS-92), Ctrl+V, drag & drop, „Zmień zdjęcie” / wybór pliku bez `capture`.

8. **Upload w toku**  
   - Podczas `isUploading` / ładowania asysty przycisk aparatu nieaktywny.

---

## 4. Rollback

W razie problemów wystarczy **rollback deployu frontendu** na Firebase Hosting do poprzedniej wersji. Backend nie wymaga rollbacku.

---

## 5. Dokumentacja produktowa (opcjonalnie po release)

- Krótka wzmianka w `docs/results/project-summary.md` (US-027 / formularz, asysta AI).
- Zamknięcie checklisty Definition of Done w `PS-93-mobile-camera-capture-user-story.md`.
