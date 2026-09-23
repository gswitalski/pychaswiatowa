# PS-64: Model danych i egzekwowanie limitów kredytów AI — Plan API

> **User Story:** PS-64 — Model danych i egzekwowanie limitów kredytów AI
> **Data:** wrzesień 2026
> **Dotyczy:** Supabase Edge Functions + PostgreSQL (migracja DB)

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| Tabela `user_ai_credits` | Nowa tabela PostgreSQL | Przechowuje kredyty AI per użytkownik |
| Enum `ai_credit_limit_type` | Nowy typ PostgreSQL | `lifetime` (Free) / `monthly` (Premium) |
| Helper `checkAndDeductCredits` | Nowa funkcja wewnętrzna Edge Function | Weryfikuje i odejmuje kredyty |
| `POST /ai/recipes/draft` | Modyfikacja istniejącego endpointu | Dodanie weryfikacji kredytów przed wywołaniem AI |
| `POST /ai/recipes/image` | Modyfikacja istniejącego endpointu | Dodanie weryfikacji kredytów przed wywołaniem AI |
| `GET /ai/credits` | Nowy endpoint | Zwraca bieżący stan kredytów użytkownika |
| `POST /internal/ai-credits/monthly-reset` | Nowy endpoint (worker wewnętrzny) | Cron: resetuje kredyty użytkowników Premium |
| `PATCH /admin/users/{userId}/ai-credits` | Nowy endpoint (admin) | Ręczna korekta kredytów przez admina |

---

## 2. Nowa tabela `user_ai_credits`

### Struktura

| Kolumna | Typ | Domyślna | Opis |
|---|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` | Klucz główny |
| `user_id` | `uuid` UNIQUE FK → `auth.users` | — | Właściciel; jedno konto = jeden wiersz |
| `draft_credits_total` | `smallint` | `3` | Całkowita pula kredytów na draft (AI-assist) |
| `draft_credits_used` | `smallint` | `0` | Wykorzystane kredyty draft |
| `image_credits_total` | `smallint` | `0` | Całkowita pula kredytów na generowanie zdjęcia |
| `image_credits_used` | `smallint` | `0` | Wykorzystane kredyty image |
| `limit_type` | `ai_credit_limit_type` | `'lifetime'` | Typ limitu: `lifetime` (Free) / `monthly` (Premium) |
| `next_reset_at` | `timestamptz` | `null` | Data następnego resetu (tylko Premium) |
| `credits_activated_at` | `timestamptz` | `now()` | Moment pierwszego przydziału kredytów |
| `created_at` | `timestamptz` | `now()` | Czas utworzenia rekordu |
| `updated_at` | `timestamptz` | `now()` | Czas ostatniej modyfikacji |

### Wartości domyślne per rola

| Rola | `draft_credits_total` | `image_credits_total` | `limit_type` | `next_reset_at` |
|---|---|---|---|---|
| `user` (Free) | `3` | `0` | `lifetime` | `null` |
| `premium` | `20` | `5` | `monthly` | `credits_activated_at + 1 miesiąc` |
| `admin` | Pominięty — brak weryfikacji kredytów | — | — | — |

> **Uwaga:** Wartości domyślne (`3`, `20`, `5`) są konfigurowalne przez zmienne środowiskowe Edge Functions:
> `AI_DRAFT_CREDITS_FREE`, `AI_DRAFT_CREDITS_PREMIUM`, `AI_IMAGE_CREDITS_PREMIUM`.

### Enum `ai_credit_limit_type`

```sql
CREATE TYPE ai_credit_limit_type AS ENUM ('lifetime', 'monthly');
```

---

## 3. Logika weryfikacji i odejmowania kredytów

### Helper: `checkAndDeductCredits(userId, creditType)`

Współdzielona funkcja wewnętrzna wywoływana przez endpointy AI. **Nie** jest wystawiona jako publiczny endpoint — działa na poziomie logiki Edge Function.

**Parametry:**

| Parametr | Typ | Opis |
|---|---|---|
| `userId` | `string` (uuid) | ID użytkownika z JWT |
| `creditType` | `'draft' \| 'image'` | Typ kredytu do weryfikacji |

**Algorytm (pseudokod):**

```
1. Pobierz app_role z JWT claims
2. Jeśli app_role === 'admin' → przejdź dalej (brak weryfikacji)
3. Pobierz wiersz user_ai_credits WHERE user_id = userId (SELECT FOR UPDATE)
4. Jeśli wiersz nie istnieje → utwórz go z domyślnymi wartościami dla roli 'user'
5. Jeśli limit_type === 'monthly' I now() >= next_reset_at:
   a. Zresetuj *_credits_used = 0
   b. Zaktualizuj next_reset_at = next_reset_at + INTERVAL '1 month'
6. Oblicz remaining = *_credits_total - *_credits_used
7. Jeśli remaining <= 0 → rzuć błąd AI_CREDITS_EXHAUSTED (402)
8. Wykonaj wywołanie AI (→ wróć token do endpointu)
9. Po sukcesie AI: INCREMENT *_credits_used + 1, UPDATE updated_at
10. Zwróć wynik AI
```

**Kluczowe zasady:**
- Kredyt jest odejmowany **wyłącznie po pomyślnej odpowiedzi modelu AI** (po kroku 8).
- `SELECT FOR UPDATE` zapobiega race condition przy równoczesnych wywołaniach.
- Worker normalizacji składników (`/internal/workers/normalized-ingredients/run`) **nie** przechodzi przez ten helper — używa osobnego klucza API (service role) i nie weryfikuje tabeli `user_ai_credits`.

---

## 4. Zmodyfikowane endpointy

### `POST /ai/recipes/draft` *(modyfikacja)*

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/ai/recipes/draft` |
| Autoryzacja | Bearer JWT (wymagane); role `premium` lub `admin` (`user` blokowany feature gatorem) |
| Zmiany | Dodanie weryfikacji kredytów `draft` przed wywołaniem LLM |

**Zmieniony przepływ:**

```
[Istniejący: feature gating → wywołanie LLM → odpowiedź]
[Nowy:       feature gating → checkAndDeductCredits(userId, 'draft') → wywołanie LLM → odejmij kredyt → odpowiedź]
```

> **Zmiana w feature gatingu:** Aktualnie endpoint jest dostępny tylko dla `premium` i `admin`. Zgodnie z analizą biznesową, użytkownicy `user` (Free) powinni mieć dostęp do 1–3 importów lifetime. W ramach PS-64 feature gating zostaje **rozszerzony na rolę `user`** — weryfikacja puli kredytów zastępuje twarde blokowanie po roli.

**Nowe kody błędów:**

| Kod HTTP | Kod błędu | Sytuacja |
|---|---|---|
| `402 Payment Required` | `AI_CREDITS_EXHAUSTED` | Brak dostępnych kredytów draft |

**Odpowiedź błędu `402`:**

```json
{
    "error": "AI_CREDITS_EXHAUSTED",
    "message": "Wyczerpano pulę kredytów AI. Przejdź na Premium lub dokup pakiet kredytów.",
    "details": {
        "credit_type": "draft",
        "credits_used": 3,
        "credits_total": 3,
        "limit_type": "lifetime",
        "upgrade_url": "/pricing"
    }
}
```

**Istniejące odpowiedzi bez zmian:** `200 OK` (draft), `400`, `401`, `413`, `429`, `500`.

---

### `POST /ai/recipes/image` *(modyfikacja)*

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/ai/recipes/image` |
| Autoryzacja | Bearer JWT (wymagane); role `premium` lub `admin` |
| Zmiany | Dodanie weryfikacji kredytów `image` przed wywołaniem modelu graficznego |

**Zmieniony przepływ:**

```
[Istniejący: feature gating (premium/admin) → wywołanie gpt-image-1.5 lub Gemini → odpowiedź]
[Nowy:       feature gating (premium/admin) → checkAndDeductCredits(userId, 'image') → wywołanie → odejmij kredyt → odpowiedź]
```

> Feature gating pozostaje `premium`/`admin` — użytkownicy `user` (Free) nie mają dostępu do generowania zdjęć AI (brak kredytów image w planie Free).

**Nowe kody błędów:**

| Kod HTTP | Kod błędu | Sytuacja |
|---|---|---|
| `402 Payment Required` | `AI_CREDITS_EXHAUSTED` | Brak dostępnych kredytów image |

**Odpowiedź błędu `402`:**

```json
{
    "error": "AI_CREDITS_EXHAUSTED",
    "message": "Wyczerpano pulę kredytów AI na generowanie zdjęć. Dokup pakiet kredytów lub poczekaj na reset miesięczny.",
    "details": {
        "credit_type": "image",
        "credits_used": 5,
        "credits_total": 5,
        "limit_type": "monthly",
        "next_reset_at": "2026-10-09T22:00:00Z",
        "upgrade_url": "/pricing"
    }
}
```

---

## 5. Nowe endpointy

### `GET /ai/credits`

| Atrybut | Wartość |
|---|---|
| Metoda | `GET` |
| URL | `/functions/v1/ai/credits` |
| Autoryzacja | Bearer JWT (wymagane) |
| Opis | Zwraca bieżący stan kredytów AI zalogowanego użytkownika. Używany przez frontend do wyświetlania wskaźnika puli. |

**Odpowiedź `200 OK`:**

```json
{
    "limit_type": "monthly",
    "draft": {
        "total": 20,
        "used": 7,
        "remaining": 13
    },
    "image": {
        "total": 5,
        "used": 2,
        "remaining": 3
    },
    "next_reset_at": "2026-10-09T22:00:00Z"
}
```

**Odpowiedź dla roli `admin`:**

```json
{
    "limit_type": "unlimited",
    "draft": { "total": null, "used": null, "remaining": null },
    "image": { "total": null, "used": null, "remaining": null },
    "next_reset_at": null
}
```

**Kody odpowiedzi:**

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Pomyślne pobranie stanu kredytów |
| `401 Unauthorized` | Brak lub nieważny JWT |

---

### `POST /internal/ai-credits/monthly-reset` *(worker wewnętrzny)*

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/internal/ai-credits/monthly-reset` |
| Autoryzacja | Supabase Cron (service role secret w nagłówku) — niedostępny publicznie |
| Opis | Resetuje kredyty `draft` i `image` użytkowników Premium, u których minął termin `next_reset_at`. Wykonywany przez Supabase Cron raz dziennie. |

**Algorytm:**

```
1. SELECT user_ai_credits WHERE limit_type = 'monthly' AND next_reset_at <= now()
2. Dla każdego wiersza:
   a. draft_credits_used = 0
   b. image_credits_used = 0
   c. next_reset_at = next_reset_at + INTERVAL '1 month'
   d. updated_at = now()
3. Zwróć liczbę zresetowanych kont
```

**Odpowiedź `200 OK`:**

```json
{
    "reset_count": 12,
    "processed_at": "2026-10-09T02:00:00Z"
}
```

**Kody odpowiedzi:**

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Worker wykonał się pomyślnie (nawet gdy `reset_count = 0`) |
| `401 Unauthorized` | Brak lub nieważny nagłówek service role |
| `500 Internal Server Error` | Błąd bazy danych |

---

### `PATCH /admin/users/{userId}/ai-credits` *(admin)*

| Atrybut | Wartość |
|---|---|
| Metoda | `PATCH` |
| URL | `/functions/v1/admin/users/{userId}/ai-credits` |
| Autoryzacja | Bearer JWT (rola `admin` wymagana) |
| Opis | Umożliwia adminowi ręczne ustawienie lub reset kredytów konkretnego użytkownika (np. rekompensata, debug, onboarding). |

**Body żądania:**

```json
{
    "draft_credits_total": 10,
    "draft_credits_used": 0,
    "image_credits_total": 3,
    "image_credits_used": 0,
    "limit_type": "monthly",
    "next_reset_at": "2026-10-09T22:00:00Z"
}
```

> Wszystkie pola są opcjonalne — aktualizowane są tylko podane pola (`PATCH` semantics).

**Odpowiedź `200 OK`:**

```json
{
    "user_id": "uuid",
    "draft": { "total": 10, "used": 0, "remaining": 10 },
    "image": { "total": 3, "used": 0, "remaining": 3 },
    "limit_type": "monthly",
    "next_reset_at": "2026-10-09T22:00:00Z",
    "updated_at": "2026-09-09T20:00:00Z"
}
```

**Kody odpowiedzi:**

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Kredyty zaktualizowane |
| `400 Bad Request` | Nieprawidłowe wartości (np. `used > total`, ujemne liczby) |
| `401 Unauthorized` | Brak JWT |
| `403 Forbidden` | JWT bez roli `admin` |
| `404 Not Found` | Użytkownik o podanym `userId` nie istnieje |

---

## 6. Zmiany w istniejących endpointach — rozszerzenie `GET /me`

Po wdrożeniu PS-64 endpoint `GET /me` powinien zostać rozszerzony o pole `ai_credits`, aby App Shell mógł bootstrapować stan kredytów bez dodatkowego zapytania do `GET /ai/credits`.

**Rozszerzona odpowiedź (dodawane pole):**

```json
{
    "id": "uuid",
    "username": "string",
    "app_role": "user | premium | admin",
    "ai_credits": {
        "draft_remaining": 1,
        "image_remaining": 0,
        "limit_type": "lifetime",
        "next_reset_at": null
    }
}
```

> Pole `ai_credits` ma wartość `null` dla roli `admin` (nieograniczony dostęp).

---

## 7. RLS — polityki Row Level Security

Tabela `user_ai_credits` jest objęta RLS. Polityki:

| Operacja | Podmiot | Warunek |
|---|---|---|
| `SELECT` | Zalogowany użytkownik | `auth.uid() = user_id` |
| `INSERT` | Edge Functions (service role) | Bez RLS (service role bypass) |
| `UPDATE` | Edge Functions (service role) | Bez RLS (service role bypass) |
| `DELETE` | Brak | Zabronione dla wszystkich |

> Użytkownik może odczytać **tylko swoje** kredyty przez `GET /ai/credits` (RLS + JWT). Wszelkie zapisy i modyfikacje wykonuje wyłącznie warstwa Edge Functions działająca z service role.

---

## 8. Bezpieczeństwo

| Zagrożenie | Mitygacja |
|---|---|
| Race condition przy równoczesnych wywołaniach AI | `SELECT FOR UPDATE` w helperze `checkAndDeductCredits` |
| Manipulacja stanem kredytów przez użytkownika | RLS blokuje UPDATE/DELETE; API aktualizuje tylko service role |
| Nadużycia (boty, scrapowanie) | Istniejący rate limiting na endpointach AI + `402` przy braku kredytów |
| Odczyt kredytów innego użytkownika | RLS `auth.uid() = user_id` |
| Nieuprawniony reset kredytów | `/internal/ai-credits/monthly-reset` chroniony service role secret |

---

## 9. Kody błędów — podsumowanie nowych kodów

| Kod HTTP | Kod błędu | Endpoint | Opis |
|---|---|---|---|
| `402 Payment Required` | `AI_CREDITS_EXHAUSTED` | `POST /ai/recipes/draft`, `POST /ai/recipes/image` | Brak dostępnych kredytów |
