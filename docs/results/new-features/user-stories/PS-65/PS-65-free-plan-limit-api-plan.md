# PS-65: Egzekwowanie limitu planu dla użytkownika Free — Plan API

> **User Story:** PS-65 — Egzekwowanie limitów planu dla użytkownika Free
> **Data:** wrzesień 2026
> **Dotyczy:** Supabase Edge Functions (funkcja `plan`)

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| `POST /plan/recipes` | Modyfikacja istniejącego endpointu | Dodanie weryfikacji limitu Free przed INSERT |
| Zmienna środowiskowa `PLAN_LIMIT_FREE` | Nowa konfiguracja | Konfigurowalny limit pozycji planu dla roli `user` (domyślnie `3`) |
| Kod błędu `PLAN_LIMIT_EXCEEDED_FREE` | Nowy kod błędu | Zwracany `422` gdy Free user przekroczy swój limit |

Pozostałe endpointy modułu `plan` (`GET /plan`, `DELETE /plan/recipes/{recipeId}`, `DELETE /plan`) nie wymagają zmian.

---

## 2. Zmienna środowiskowa

| Zmienna | Domyślna wartość | Opis |
|---|---|---|
| `PLAN_LIMIT_FREE` | `3` | Maksymalna liczba pozycji w „Moim planie" dla użytkownika Free (`app_role = 'user'`). Konfigurowalna bez redeploymentu kodu. |

> Istniejący limit `50` dla użytkowników Premium i Admin pozostaje zakodowany na stałe (nie wymaga zmiennej środowiskowej, gdyż jest wartością produktową opisaną w UI — patrz PS-63).

---

## 3. Zmodyfikowany endpoint `POST /plan/recipes`

### Metadane

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/plan/recipes` |
| Autoryzacja | Bearer JWT (wymagane) |
| Zmiany | Dodanie weryfikacji limitu Free dla `app_role = 'user'` przed istniejącą weryfikacją limitu 50 |

### Zmieniony przepływ

```
[Istniejący]
autoryzacja → weryfikacja limitu 50 → INSERT plan_recipes + wiersze zakupowe → 200 OK

[Nowy]
autoryzacja
→ pobierz app_role z JWT claims
→ jeśli app_role === 'user':
      COUNT(plan_recipes WHERE user_id = auth.uid())
      jeśli count >= PLAN_LIMIT_FREE (env, domyślnie 3):
          → 422 PLAN_LIMIT_EXCEEDED_FREE
→ istniejąca weryfikacja limitu 50 (dla 'premium' i 'admin')
→ INSERT plan_recipes + wiersze zakupowe
→ 200 OK
```

**Kluczowe zasady:**

- Weryfikacja limitu Free jest wykonywana **przed** istniejącą weryfikacją limitu 50, by zwrócić bardziej precyzyjny komunikat błędu.
- Rola `admin` i `premium` nie są objęte nową weryfikacją — istniejące zachowanie pozostaje bez zmian.
- Grandfathering: endpoint **nie usuwa** istniejących pozycji planu użytkowników, którzy przed wdrożeniem PS-65 zebrali ich więcej niż `PLAN_LIMIT_FREE`. Blokada dotyczy wyłącznie dodawania nowych pozycji (`POST /plan/recipes`).

### Nowy kod błędu `422`

| Kod HTTP | Kod błędu | Sytuacja |
|---|---|---|
| `422 Unprocessable Entity` | `PLAN_LIMIT_EXCEEDED_FREE` | Użytkownik Free próbuje dodać pozycję po osiągnięciu limitu `PLAN_LIMIT_FREE` |

**Odpowiedź błędu `422 PLAN_LIMIT_EXCEEDED_FREE`:**

```json
{
    "error": "PLAN_LIMIT_EXCEEDED_FREE",
    "message": "Osiągnięto limit pozycji w Moim planie dla konta Free.",
    "details": {
        "free_limit": 3,
        "premium_limit": 50,
        "upgrade_url": "/pricing"
    }
}
```

> Pole `free_limit` odzwierciedla aktualną wartość zmiennej środowiskowej `PLAN_LIMIT_FREE` (nie jest zakodowane na stałe w odpowiedzi).

### Istniejące odpowiedzi bez zmian

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Pozycja dodana do planu |
| `401 Unauthorized` | Brak lub nieważny JWT |
| `404 Not Found` | Przepis o podanym `recipeId` nie istnieje |
| `409 Conflict` | Przepis jest już w planie użytkownika |
| `422 Unprocessable Entity` (istniejący) | Przekroczono limit 50 pozycji (dla `premium`/`admin`) |

> Istniejący `422` dla limitu 50 zostaje zachowany bez zmian i nadal obowiązuje dla ról `premium` i `admin`. Kod błędu dla tego przypadku pozostaje dotychczasowy (nie `PLAN_LIMIT_EXCEEDED_FREE`).

---

## 4. Pseudokod implementacji (Edge Function)

```typescript
// supabase/functions/plan/handlers/add-recipe.ts

const PLAN_LIMIT_FREE = parseInt(Deno.env.get('PLAN_LIMIT_FREE') ?? '3', 10);
const PLAN_LIMIT_PREMIUM = 50;

export async function addRecipeToPlan(req: Request, supabase: SupabaseClient, userId: string, appRole: string) {
    const { recipeId } = await req.json();

    // Weryfikacja limitu Free (nowa logika PS-65)
    if (appRole === 'user') {
        const { count } = await supabase
            .from('plan_recipes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if ((count ?? 0) >= PLAN_LIMIT_FREE) {
            return new Response(JSON.stringify({
                error: 'PLAN_LIMIT_EXCEEDED_FREE',
                message: 'Osiągnięto limit pozycji w Moim planie dla konta Free.',
                details: {
                    free_limit: PLAN_LIMIT_FREE,
                    premium_limit: PLAN_LIMIT_PREMIUM,
                    upgrade_url: '/pricing',
                },
            }), { status: 422 });
        }
    }

    // Istniejąca weryfikacja limitu 50 (dla premium/admin)
    // ... dalszy istniejący kod bez zmian
}
```

---

## 5. Bezpieczeństwo

| Zagrożenie | Mitygacja |
|---|---|
| Manipulacja rolą przez klienta | Rola `app_role` pochodzi wyłącznie z JWT claims (Supabase Auth) — nie z body żądania |
| Race condition (równoczesne wywołania) | Istniejąca transakcyjność INSERT w Edge Function; dla limitu 3 ryzyko praktyczne minimalne |
| Obejście grandfatheringu | Nieistotne — grandfathering jest celowym zachowaniem; usunięcie nadliczbowych pozycji leży po stronie użytkownika |

---

## 6. Kody błędów — podsumowanie nowych kodów

| Kod HTTP | Kod błędu | Endpoint | Opis |
|---|---|---|---|
| `422 Unprocessable Entity` | `PLAN_LIMIT_EXCEEDED_FREE` | `POST /plan/recipes` | Użytkownik Free osiągnął limit pozycji w planie |
