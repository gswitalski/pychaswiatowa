# Edycja ról użytkowników przez administratora — plan API

## 1. Nowy endpoint

| Metoda | URL | Dostęp | Cel |
|---|---|---|---|
| `PATCH` | `/admin/users/{userId}/role` | Tylko `admin` | Zmienia rolę jednego użytkownika. |

Żądanie jest obsługiwane przez istniejącą Edge Function `admin`. Klient nie komunikuje się bezpośrednio z tabelą `auth.users` ani z Supabase Admin API.

## 2. Kontrakt żądania i odpowiedzi

### Parametr ścieżki

| Parametr | Typ | Wymagany | Walidacja |
|---|---|---|---|
| `userId` | `string` | Tak | UUID istniejącego użytkownika. |

### Body żądania

```json
{
    "app_role": "premium"
}
```

| Pole | Typ | Wymagane | Reguły |
|---|---|---|---|
| `app_role` | `AppRole` | Tak | Jedna z wartości: `user`, `premium`, `admin`. |

### Odpowiedź `200 OK`

```json
{
    "user": {
        "id": "7c8966c3-bc93-4bda-bcd1-bdcfd2af7b99",
        "username": "ania",
        "email": "ania@example.com",
        "app_role": "premium",
        "created_at": "2026-04-10T12:00:00.000Z",
        "updated_at": "2026-08-04T20:00:00.000Z"
    }
}
```

Zwracany obiekt używa tego samego kształtu danych użytkownika co istniejąca lista administracyjna. Nazwy pól muszą zostać uzgodnione z aktualnym `AdminUserListItemDto`; API nie powinno ujawniać `raw_app_meta_data`, tokenów ani innych metadanych konta.

## 3. Przebieg po stronie serwera

1. Edge Function odczytuje token `Authorization: Bearer <token>`.
2. Wspólny moduł autoryzacji waliduje token i potwierdza `app_role = admin`.
3. Backend waliduje `userId` oraz body za pomocą schematu Zod.
4. Backend porównuje `userId` z identyfikatorem administratora z JWT. Zgodność kończy żądanie błędem konfliktu — samomodyfikacja roli jest zakazana.
5. Backend pobiera konto docelowe przez bezpieczny kontekst service role. Brak konta kończy się `404`.
6. Jeśli aktualna rola docelowa to `admin`, a żądana rola jest inna, backend atomowo sprawdza, czy istnieje co najmniej jeszcze jeden administrator. Gdy nie — zwraca `409`.
7. Backend aktualizuje wyłącznie `app_role` w `raw_app_meta_data` za pomocą Supabase Admin API (`auth.admin.updateUserById`), zachowując pozostałe metadane aplikacyjne.
8. Backend zwraca zmapowany, aktualny model użytkownika.

Wymóg atomowości w kroku 6 jest istotny: proste odczytanie liczby administratorów przed aktualizacją może pozwolić równoległym żądaniom usunąć rolę ostatnim administratorom. Implementacja powinna użyć transakcyjnej funkcji/RPC lub równoważnego mechanizmu serializującego tę regułę.

## 4. Kody odpowiedzi i błędy

| Kod | Warunek | Przykładowy kod błędu |
|---|---|---|
| `200 OK` | Rola została zmieniona. | — |
| `400 Bad Request` | Nieprawidłowy UUID lub niedozwolona/missing rola. | `VALIDATION_ERROR` |
| `401 Unauthorized` | Brak, wygaśnięcie lub nieprawidłowość JWT. | `UNAUTHORIZED` |
| `403 Forbidden` | Zalogowany użytkownik nie ma roli `admin`. | `ADMIN_ROLE_REQUIRED` |
| `404 Not Found` | Użytkownik docelowy nie istnieje. | `USER_NOT_FOUND` |
| `409 Conflict` | Próba zmiany własnej roli albo obniżenia roli ostatniego administratora. | `SELF_ROLE_CHANGE_FORBIDDEN`, `LAST_ADMIN_ROLE_CHANGE_FORBIDDEN` |
| `500 Internal Server Error` | Niepowodzenie komunikacji z Supabase Auth lub niespodziewany błąd. | `INTERNAL_ERROR` |

Odpowiedź błędna powinna korzystać z istniejącego formatu błędów Edge Functions i zawierać stabilny kod dla klienta oraz bezpieczny komunikat dla użytkownika.

## 5. Zmiany w kontraktach i kliencie

| Obszar | Planowana zmiana |
|---|---|
| `shared/contracts/types.ts` | Dodać DTO body aktualizacji roli i DTO odpowiedzi, wykorzystując istniejący `AppRole`. |
| `supabase/functions/admin/admin.types.ts` | Dodać schemat Zod parametru i body oraz typy odpowiedzi/błędów. |
| `supabase/functions/admin/admin.handlers.ts` | Zarejestrować trasę `PATCH /users/:userId/role` i przekazać zwalidowane dane do serwisu. |
| `supabase/functions/admin/admin.service.ts` | Dodać operację zmiany roli z kontrolą zabezpieczeń i aktualizacją Supabase Auth. |
| `src/app/core/services/admin-api.service.ts` | Dodać metodę `updateUserRole(userId, appRole)`. |

## 6. Testy API

1. Testy jednostkowe walidacji: każdy dozwolony wariant roli oraz odrzucone wartości i nieprawidłowy UUID.
2. Testy handlera: `401` bez tokenu, `403` dla `user` i `premium`, `200` dla administratora.
3. Testy serwisu: poprawna aktualizacja metadata, zachowanie pozostałych metadanych oraz mapowanie odpowiedzi.
4. Testy zabezpieczeń: odrzucenie zmiany własnej roli i odrzucenie obniżenia roli ostatniego administratora, także przy współbieżnych żądaniach.
5. Test integracyjny klienta: `AdminApiService` wysyła `PATCH` na poprawny URL z body `{ app_role }`.
