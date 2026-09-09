# PS-63: Strona cennika (/pricing) — Plan API

> **User Story:** PS-63 — Strona cennika z ofertą Premium
> **Data:** wrzesień 2026
> **Dotyczy:** Supabase Edge Functions + konfiguracja Angular

---

## 1. Podsumowanie

Strona `/pricing` jest w wersji MVP **stroną statyczną po stronie frontendu**. Konfiguracja planów (ceny, limity, lista benefitów, długość trialu) jest przechowywana w pliku `pricing.config.ts` w warstwie Angulara i **nie wymaga nowych endpointów backendu** do działania.

Jedynym endpointem backendu używanym przez tę stronę jest istniejące `GET /me`, które dostarcza stan sesji (zalogowany/niezalogowany) niezbędny do poprawnego działania przycisku CTA.

---

## 2. Istniejące endpointy używane przez PS-63

### `GET /me`

| Atrybut | Wartość |
|---|---|
| Metoda | `GET` |
| URL | `/functions/v1/me` |
| Autoryzacja | Opcjonalna (Bearer JWT lub anonimowy) |
| Opis | Zwraca dane sesji aktualnego użytkownika. Bootstrapuje App Shell. |

**Zastosowanie w kontekście PS-63:**
Strona cennika odczytuje stan sesji użytkownika, aby CTA „Wybierz Premium" kierował:
- zalogowanego użytkownika → `/checkout`,
- niezalogowanego użytkownika → `/register?next=/checkout`.

Odpowiedź (istniejąca, bez zmian):

```json
{
    "id": "uuid",
    "username": "string | null",
    "app_role": "user | premium | admin"
}
```

> Uwaga: użytkownicy z rolą `premium` lub `admin` powinni zobaczyć informację o aktywnej subskrypcji zamiast CTA zakupu. Obsługa tego stanu jest możliwa na podstawie pola `app_role` z `/me` — bez zmian w endpointach.

---

## 3. Brak nowych endpointów w MVP

Strona cennika **nie wywołuje żadnych nowych endpointów API** w wersji MVP. Uzasadnienie:

- Ceny są orientacyjnymi ramami B2C, podlegają walidacji rynkowej — trzymanie ich w konfiguracji frontendu pozwala na szybką zmianę bez redeploymentu backendu.
- Checkout i subskrypcja nie są jeszcze zaimplementowane (PS-62 w toku).
- Strona `/checkout` w MVP jest stubem z komunikatem „Wkrótce" — nie wymaga backendu.

---

## 4. Endpointy planowane (po wdrożeniu checkout — poza zakresem PS-63)

Poniższe endpointy są **udokumentowane jako przyszłe** i zostaną zaimplementowane w ramach historyjek checkout/monetyzacja (PS-62 i kolejne).

### `GET /pricing/plans` *(przyszły)*

| Atrybut | Wartość |
|---|---|
| Metoda | `GET` |
| URL | `/functions/v1/pricing/plans` |
| Autoryzacja | Brak (publiczny) |
| Opis | Zwraca aktualną konfigurację planów cenowych. Umożliwia zarządzanie cenami bez redeploymentu frontendu po integracji z operatorem płatności. |

Planowana odpowiedź:

```json
{
    "plans": [
        {
            "id": "free",
            "name": "Free",
            "price_monthly_pln": 0,
            "price_yearly_pln": 0,
            "features": []
        },
        {
            "id": "premium_monthly",
            "name": "Premium (miesięcznie)",
            "price_monthly_pln": 2400,
            "price_yearly_pln": null,
            "trial_days": 7,
            "features": []
        },
        {
            "id": "premium_yearly",
            "name": "Premium (rocznie)",
            "price_monthly_pln": null,
            "price_yearly_pln": 16900,
            "price_monthly_equivalent_pln": 1408,
            "trial_days": 7,
            "features": []
        }
    ],
    "currency": "PLN",
    "updated_at": "2026-09-01T00:00:00Z"
}
```

> Ceny w groszach (`int`) aby uniknąć błędów zaokrąglenia przy manipulacji liczbami zmiennoprzecinkowymi.

### `POST /checkout/sessions` *(przyszły)*

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/checkout/sessions` |
| Autoryzacja | Bearer JWT (wymagane) |
| Opis | Tworzy sesję checkout u operatora płatności (np. Stripe / PayU). Zwraca URL do przekierowania. |

Planowane body:

```json
{
    "plan_id": "premium_yearly",
    "success_url": "https://pychaswiatowa.web.app/checkout/success",
    "cancel_url": "https://pychaswiatowa.web.app/pricing"
}
```

---

## 5. Planowane zmiany w istniejących endpointach (po starcie checkout)

Po wdrożeniu płatności endpoint `GET /me` powinien zostać rozszerzony o pola subskrypcji, aby strona cennika mogła wyświetlić aktualny stan konta bez dodatkowego zapytania:

| Pole | Typ | Opis |
|---|---|---|
| `subscription_status` | `string \| null` | np. `active`, `trialing`, `canceled`, `null` dla Free |
| `trial_ends_at` | `timestamptz \| null` | Data końca trialu |
| `credits_remaining` | `object \| null` | Pula kredytów AI (draft, image) — powiązane z PS-64 |

Zmiany te są **poza zakresem PS-63** i zostaną zdefiniowane w planie API dla historyjek PS-64+ (kredyty AI) i checkout.

---

## 6. Bezpieczeństwo i RLS

- Strona `/pricing` nie przetwarza danych użytkownika.
- Endpoint `GET /me` jest już zabezpieczony — zwraca dane tylko własnej sesji.
- Brak nowych zagrożeń bezpieczeństwa w MVP.
- Po wdrożeniu `POST /checkout/sessions`: walidacja `plan_id`, rate limiting, weryfikacja JWT przed wywołaniem operatora płatności.

---

## 7. Błędy i kody odpowiedzi (przyszłe endpointy)

| Kod | Sytuacja |
|---|---|
| `200 OK` | Pomyślny odczyt planów (`GET /pricing/plans`) |
| `201 Created` | Sesja checkout utworzona (`POST /checkout/sessions`) |
| `401 Unauthorized` | Brak lub nieważny JWT przy `POST /checkout/sessions` |
| `422 Unprocessable Entity` | Nieprawidłowy `plan_id` w checkout |
| `429 Too Many Requests` | Przekroczenie limitu tworzenia sesji checkout |
| `500 Internal Server Error` | Błąd komunikacji z operatorem płatności |
