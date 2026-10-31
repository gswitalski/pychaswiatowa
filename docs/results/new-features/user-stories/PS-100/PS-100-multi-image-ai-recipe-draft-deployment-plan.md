# PS-100: Analiza przepisu AI z wielu zdjęć — Plan wdrożenia

> **User Story:** PS-100 — Analiza przepisu AI z wielu zdjęć (tryb „Obraz” asysty AI)
> **Data:** październik 2026
> **Środowisko docelowe:** Firebase Hosting (frontend) + Supabase Cloud (Edge Function `ai`)

---

## 1. Podsumowanie

PS-100 zmienia **frontend** i **Edge Function `ai`** (endpoint `POST /ai/recipes/draft`). Baza danych, Storage, tabele, polityki RLS i cron **nie są dotknięte**.

Deploy aplikacji Angular i funkcji Supabase wykonuje **GitHub Actions** — tych kroków nie powtarzamy tutaj. Poniżej wyłącznie **działania ręczne**: weryfikacje limitów platform zewnętrznych przed wdrożeniem, kontrola kolejności wdrożenia oraz testy po release.

| Obszar | Wymagane działanie ręczne |
|---|---|
| Supabase Secrets | **Brak nowych** (istniejący `OPENAI_API_KEY` wystarcza) |
| Migracje SQL | **Brak** |
| Storage | **Brak** (obrazy nie są zapisywane) |
| Edge Functions — deploy | Automatycznie przez CI |
| Edge Functions — limity platformy | **Weryfikacja ręczna** (krok 1 i 2) |
| OpenAI — konto, model, limity | **Weryfikacja ręczna** (krok 3) |
| Kolejność wdrożenia backend → frontend | **Weryfikacja ręczna** (krok 4) |
| Firebase Hosting | Automatycznie przez CI |
| Test na urządzeniu mobilnym | **Ręcznie** po wdrożeniu (sekcja 4) |

---

## 2. Działania ręczne przed wdrożeniem

### Krok 1 — Limit rozmiaru żądania Edge Function

Żądanie z 5 zdjęciami to JSON z base64: przy limicie sumy 15 MB po dekodowaniu body ma ok. **20 MB**.

1. Sprawdzić w dokumentacji Supabase (sekcja limitów Edge Functions) i w ustawieniach projektu, czy limit rozmiaru body / pamięci funkcji dopuszcza ok. 20 MB.
2. Na **stagingu / wersji dev** wysłać testowe żądanie `POST /functions/v1/ai/recipes/draft` z 5 obrazami o łącznym rozmiarze tuż poniżej 15 MB (np. przez `supabase/functions/ai/test-requests.http` lub `curl` z JWT konta testowego) i potwierdzić odpowiedź `200`/`422` (a nie błąd platformy, np. `413`/`546`/`500` bez kodu aplikacji).
3. Jeśli platforma odrzuca takie żądanie: obniżyć `MAX_TOTAL_DRAFT_IMAGES_SIZE_BYTES` w `ai-draft-images.ts` (oraz `AI_DRAFT_MAX_TOTAL_IMAGES_BYTES` we frontendzie i komunikat „max 15 MB”) do wartości, która przechodzi — to jedyna zmiana wymagana.

### Krok 2 — Limit czasu Edge Function

Wywołanie modelu dla 5 zdjęć ma timeout **140 s** (`min(100 s + 10 s × (N − 1), 140 s)`), liczony pod limitem czasu wykonania funkcji (150 s).

1. W Supabase Dashboard (plan projektu / dokumentacja limitów Edge Functions) potwierdzić limit czasu wykonania dla używanego planu.
2. Jeśli limit planu jest **niższy niż 150 s**: obniżyć `DRAFT_API_TIMEOUT_MAX_MS` w `ai-draft-images.ts` tak, aby pozostawał poniżej limitu platformy z zapasem (kilka sekund na dekodowanie i odpowiedź). Dostosować komunikat w UI („do minuty”), jeśli limit spada poniżej ok. 60 s.
3. Na stagingu wykonać żądanie z 5 dużymi zdjęciami (zdjęcia stron książki w pełnej rozdzielczości po kompresji) i zmierzyć czas odpowiedzi; potwierdzić, że typowy czas mieści się z zapasem pod timeoutem.

### Krok 3 — OpenAI: model, limity, koszt

1. Potwierdzić, że model używany w `OPENAI_MODEL` (`ai.service.ts`) obsługuje **wiele obrazów w jednej wiadomości** oraz parametr `image_url.detail: "high"` (dotychczas wysyłany był jeden obraz).
2. W panelu OpenAI sprawdzić limity organizacji (TPM/RPM) dla używanego modelu. Pojedyncze wywołanie z 5 zdjęciami w trybie `high` zużywa wielokrotnie więcej tokenów wejściowych niż dotychczasowe jedno zdjęcie — upewnić się, że limit tokenów na minutę nie zablokuje kilku równoległych użytkowników.
3. Oszacować koszt jednego wywołania (5 zdjęć, `detail: "high"`) według aktualnego cennika modelu i ocenić go względem ceny 1 kredytu `draft`. Jeśli koszt jest zbyt wysoki, zmiana `DRAFT_IMAGE_DETAIL` na `"auto"` (stała w `ai-draft-images.ts`) lub obniżenie `MAX_DRAFT_IMAGES` nie wymaga zmian architektury.
4. Opcjonalnie: ustawić w panelu OpenAI alert budżetowy / limit miesięczny na wypadek nadużyć.

### Krok 4 — Kolejność wdrożenia backend → frontend

Nowy frontend zawsze wysyła pole `images`, którego **stary backend nie rozpoznaje** (wymaga pola `image`). Natomiast nowy backend nadal akceptuje stare pole `image`, więc stary frontend działa z nowym backendem.

1. Sprawdzić w konfiguracji workflow GitHub Actions, czy funkcje Supabase są wdrażane **przed** (lub w tej samej fazie co) publikacja frontendu na Firebase Hosting.
2. Jeśli deploye idą równolegle lub frontend wyprzedza backend: rozważyć dwa kolejne merge’e (najpierw backend, po potwierdzeniu wdrożenia funkcji — frontend) albo zaakceptować krótkie okno niezgodności i wykonać smoke test od razu po obu wdrożeniach.
3. Po wdrożeniu backendu (przed frontendem, jeśli możliwe) potwierdzić zgodność wsteczną: żądanie ze starym polem `image` zwraca `200` jak dotychczas.

---

## 3. Wymagania środowiska produkcyjnego

- Brak nowych zmiennych środowiskowych ani sekretów. Limity (5 zdjęć, 10 MB, 15 MB, timeouty, `detail`) są stałymi w kodzie — zmiana wymaga wdrożenia funkcji (i frontendu dla limitów widocznych w UI).
- Produkcja (`pychaswiatowa.web.app`) działa w HTTPS — wymagane dla dostępu do kamery i schowka (PS-92, PS-93); bez zmian.
- Brak zmian w Firebase Hosting (nagłówki, rewrites).

---

## 4. Weryfikacja po wdrożeniu (checklista manualna)

Wykonać na **produkcji** (lub stagingu) po automatycznym deployu funkcji i frontendu, kontem `premium` z dodatnim saldem kredytów `draft`:

1. **Happy path — 3 zdjęcia (desktop)**
   - `/recipes/new/assist`, tryb „Obraz” → „Dodaj zdjęcia” → wybór 3 plików naraz → miniatury w kolejności, licznik „3 / 5” → „Dalej” → formularz z jednym połączonym draftem; w `/settings` (lub wskaźniku) ubył **dokładnie 1** kredyt `draft`.

2. **Mobile — zdjęcia z aparatu (Android Chrome i/lub iOS Safari)**
   - 2–3 zdjęcia kolejnych stron wykonane „Zrób zdjęcie” (duże pliki z aparatu) → kompresja (spinner na miniaturze), miniatury, „Dalej” → draft. Sprawdzić czas odpowiedzi i brak błędów platformy.

3. **Kompresja i formaty (iOS Safari)**
   - Zdjęcie z galerii iPhone’a (HEIC konwertowany do JPEG przez Safari) → dodane; ewentualny plik HEIC bez konwersji → komunikat o nieobsługiwanym formacie.
   - Zdjęcie PNG o dużym rozmiarze → po kompresji miniatura i wysyłka działają (guard na brak wsparcia WebP w canvas).

4. **Dopisywanie metodami**
   - Ctrl+V, „Wklej ze schowka”, „Zrób zdjęcie” dopisują do listy, nie zastępują poprzednich.

5. **Limit 5 zdjęć**
   - Lista z 4 zdjęciami + wybór 3 plików → dodane 1, komunikat inline, przyciski dodawania nieaktywne przy 5 zdjęciach.

6. **Usuwanie i kolejność**
   - Usunięcie środkowego zdjęcia; zamiana miejsc strzałkami; sprawdzić, że wynik (kolejność składników / kroków w drafcie) odpowiada kolejności na liście.

7. **Nieobsługiwany format / za duży plik**
   - GIF/PDF i plik > 10 MB → komunikat inline, poprawne pliki z partii dodane.

8. **Przekroczenie sumy rozmiarów**
   - Wymusić > 15 MB łącznie (np. kilka dużych plików, które po kompresji nadal są duże, lub bezpośrednie żądanie przez narzędzie HTTP) → `413` z `details.limit = "total"`; w UI komunikat z sugestią usunięcia zdjęć; kredyt **nie** został pobrany.

9. **Nieczytelne zdjęcie**
   - 3 zdjęcia, w tym jedno rozmyte/nieprzepisowe → `200`, draft z czytelnych, na formularzu komunikat „Zdjęcie k było nieczytelne i zostało pominięte”.

10. **Brak przepisu na zdjęciach**
    - Zdjęcia bez przepisu → komunikat bez wypełniania formularza, kredyt zwrócony (saldo bez zmiany).

11. **Wyczerpane kredyty**
    - Konto z pustą pulą `draft` → baner i zablokowany przycisk; przy wymuszonym żądaniu `402` → dialog wyczerpania.

12. **Błąd modelu**
    - Symulacja błędu (np. tymczasowo niepoprawny klucz na stagingu) → komunikat, lista zdjęć nienaruszona, zwrócony jeden kredyt.

13. **Zgodność wsteczna API**
    - Żądanie ze starym polem `image` (np. przez `test-requests.http`) → `200`, 1 kredyt, bez regresji. Żądanie z `image` **i** `images` → `400 VALIDATION_ERROR`.

14. **Regresja**
    - Tryby „Tekst” i „Link URL” w asyście, metadane draftu (PS-91), kredyty (PS-64), gating `/recipes/new/assist` dla roli `user`.

15. **Logi i koszty (po kilku dniach)**
    - W logach funkcji `ai` sprawdzić wpisy `usedLegacyImageField`, `imagesCount`, `totalImageBytes`; w panelu OpenAI porównać rzeczywiste zużycie tokenów z oszacowaniem z kroku 3 i ocenić, czy `detail: "high"` jest opłacalne.

---

## 5. Rollback

- **Frontend:** rollback deployu na Firebase Hosting do poprzedniej wersji. Stary frontend (pole `image`) działa z nowym backendem, więc rollback frontendu jest bezpieczny w każdej chwili.
- **Backend:** rollback funkcji `ai` do poprzedniej wersji wykonać **dopiero po** wycofaniu frontendu — stary backend odrzuci żądania z polem `images`.
- Zmiany limitów (kroki 1–3) wdrażane są jako zwykła zmiana stałych i nie wymagają rollbacku danych (brak migracji).

---

## 6. Dokumentacja produktowa (po release)

- Aktualizacja `docs/results/project-summary.md`: endpoint `POST /ai/recipes/draft` (pole `images`, deprecated `image`, limity), widok asysty AI, US-036 i wpis PS-100 w stanie realizacji.
- Aktualizacja `docs/results/main-project-docs/009 API plan.md` (kontrakt draftu).
- Zamknięcie checklisty Definition of Done w `PS-100-multi-image-ai-recipe-draft-user-story.md`.
- Decyzja o usunięciu pola `image` — dopiero po przeglądzie logów `usedLegacyImageField` (poza zakresem PS-100).
