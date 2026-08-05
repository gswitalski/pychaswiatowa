# Logowanie przez Google — plan API

## 1. Przegląd zmian

Logowanie przez Google jest realizowane w całości przez **Supabase Auth** (OAuth 2.0 Authorization Code Flow z PKCE). Aplikacja kliencka nie komunikuje się bezpośrednio z API Google — rola klienta ogranicza się do wywołania metod Supabase SDK oraz obsługi callbacku.

Poniższa tabela podsumowuje nowe i zmienione punkty styku z API:

| Operacja | Typ | Zmiana |
|---|---|---|
| Inicjalizacja OAuth | Supabase SDK (klient) | Nowa wywołania metody `signInWithOAuth` |
| Callback OAuth | `GET /auth/callback` | Rozszerzenie istniejącej logiki o sprawdzenie `username` |
| Zapisanie username | `PATCH /profile` | Istniejący endpoint; nowy scenariusz użycia |
| Sprawdzenie unikalności username | `GET /profile/username-available` | Nowy endpoint |

---

## 2. Inicjalizacja OAuth (klient → Supabase)

Nie jest to klasyczny endpoint HTTP wywołany przez klienta — flow inicjowany jest przez Supabase SDK.

### Wywołanie SDK

```typescript
const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
        },
    },
});
```

| Parametr | Wartość | Opis |
|---|---|---|
| `provider` | `'google'` | Dostawca OAuth. |
| `redirectTo` | `{origin}/auth/callback` | URL, na który Google przekieruje po autoryzacji. Musi być zarejestrowany w Google Cloud Console i Supabase Dashboard. |
| `queryParams.prompt` | `'select_account'` | Wymusza wyświetlenie wyboru konta Google przy każdym logowaniu (lepszy UX dla wielu kont). |

### Odpowiedź (błąd inicjalizacji)

Jeśli `signInWithOAuth` zwróci błąd (np. dostawca nie jest skonfigurowany), aplikacja wyświetla komunikat błędu inline i nie przekierowuje użytkownika.

---

## 3. Zmieniony endpoint: callback OAuth

**Metoda:** `GET`  
**URL:** `/auth/callback`  
**Typ:** Frontend route (Angular Router)  
**Istniejący obszar implementacji:** `src/app/pages/auth/auth-callback/`

Istniejący handler finalizuje weryfikację e-mail (wymiana kodu z URL na sesję Supabase). Ten sam endpoint obsługuje teraz również callback po OAuth Google.

### Rozszerzenie logiki

Obecna logika:
```
Odczytaj parametry URL (code, error)
→ exchange code → sesja
→ redirect /email-confirmed lub /email-confirmation-invalid
```

Nowa logika (rozszerzona):

```
Odczytaj parametry URL (code, error)
→ Jeśli error → redirect /login?error={kod}
→ exchange code → sesja Supabase
→ Sprawdź typ eventu sesji:
    - SIGNED_IN (OAuth) → sprawdź profil
        - brak username w profiles → redirect /auth/complete-profile
        - username istnieje → redirect /dashboard
    - EMAIL_CONFIRMED → redirect /email-confirmed (istniejące zachowanie)
    - Inny → redirect /login
```

### Rozróżnienie flow OAuth od weryfikacji e-mail

Supabase umieszcza w URL parametr `type` przy callbackach weryfikacyjnych (np. `type=email`). Dla callbacku OAuth parametr `type` jest nieobecny lub równy `magiclink` / brak. Logika handlera powinna rozróżniać te przypadki:

| Parametr URL | Zachowanie |
|---|---|
| `type=email` | Istniejący flow weryfikacji e-mail |
| brak `type` (OAuth PKCE) | Nowy flow OAuth — po wymianie kodu sprawdzamy profil |
| `error=access_denied` | Redirect na `/login?error=access_denied` |

### Sprawdzenie profilu (client-side po wymianie kodu)

Po uzyskaniu sesji handler sprawdza tabelę `profiles` przez Supabase SDK:

```typescript
const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', session.user.id)
    .single();

if (!profile?.username) {
    router.navigateByUrl('/auth/complete-profile');
} else {
    router.navigateByUrl('/dashboard');
}
```

> **Uwaga:** To zapytanie nie wymaga nowego endpointu — klient wykonuje je bezpośrednio przez Supabase JS SDK, RLS pozwala użytkownikowi odczytać własny profil.

---

## 4. Nowy endpoint: sprawdzenie unikalności username

| Metoda | URL | Dostęp | Cel |
|---|---|---|---|
| `GET` | `/profile/username-available` | Publiczny (bez JWT) lub z JWT | Sprawdzenie czy podana nazwa użytkownika jest wolna. Używany podczas asynchronicznej walidacji pola `username` na ekranie `/auth/complete-profile`. |

### Parametry zapytania

| Parametr | Typ | Wymagany | Walidacja |
|---|---|---|---|
| `username` | `string` | Tak | 3–50 znaków, bez białych znaków; odpowiedź `400` jeśli nie spełnia formatu. |

### Odpowiedź `200 OK`

```json
{
    "available": true
}
```

lub

```json
{
    "available": false
}
```

### Kody odpowiedzi

| Kod | Warunek |
|---|---|
| `200 OK` | Zawsze, gdy parametr jest poprawny (zarówno `available: true` jak i `false`). |
| `400 Bad Request` | Parametr `username` jest pusty lub nie spełnia reguł formatu. |

> **Uwaga bezpieczeństwa:** Endpoint nie ujawnia żadnych danych użytkownika poza informacją o dostępności nazwy. Nie zwraca ID ani innych danych profilu.

---

## 5. Zmieniony endpoint: zapis profilu

| Metoda | URL | Dostęp | Cel |
|---|---|---|---|
| `PATCH` | `/profile` | JWT (zalogowany użytkownik) | Zapisanie `username` po pierwszym logowaniu przez Google. |

Endpoint istnieje już jako `PUT /profile` i obsługuje aktualizację `username`. Scenariusz OAuth korzysta z tego samego endpointu — nie są potrzebne żadne zmiany w samym endpoincie.

### Body żądania (istniejący kontrakt)

```json
{
    "username": "jan_kowalski"
}
```

### Odpowiedź `200 OK`

```json
{
    "id": "7c8966c3-bc93-4bda-bcd1-bdcfd2af7b99",
    "username": "jan_kowalski",
    "created_at": "2026-08-05T16:00:00.000Z",
    "updated_at": "2026-08-05T16:05:00.000Z"
}
```

### Kody odpowiedzi istotne w scenariuszu OAuth

| Kod | Warunek |
|---|---|
| `200 OK` | `username` zapisany poprawnie. |
| `400 Bad Request` | `username` nie spełnia reguł walidacji. |
| `409 Conflict` | `username` jest już zajęty przez innego użytkownika. |
| `401 Unauthorized` | Brak lub wygaśnięcie JWT (sesja OAuth wygasła). |

---

## 6. Guard: ochrona prywatnych tras dla kont bez `username`

Istniejący `AuthGuard` (chroniący trasy wymagające zalogowania) wymaga rozszerzenia o dodatkowe sprawdzenie:

- Jeśli użytkownik jest zalogowany, ale jego profil nie ma `username` → redirect na `/auth/complete-profile`.
- Trasa `/auth/complete-profile` sama w sobie musi być chroniona: dostępna tylko dla sesji Supabase, ale **bez** warunku `username` (bo właśnie go uzupełniamy).

### Zmiana w istniejącym guard

```
AuthGuard (istniejący):
  → brak sesji → redirect /login
  
  Rozszerzenie:
  → sesja istnieje, ale profile.username jest null/pusty
    → redirect /auth/complete-profile
  → sesja istnieje i profile.username nie jest pusty
    → kontynuuj (istniejące zachowanie)
```

Sprawdzenie `username` powinno być realizowane przez serwis profilowy, który buforuje dane profilu po pierwszym załadowaniu (`/me` lub `profiles` przez SDK).

---

## 7. Zmiany w kontraktach i kliencie

| Obszar | Planowana zmiana |
|---|---|
| `src/app/core/services/auth.service.ts` | Dodać metodę `signInWithGoogle()` wywołującą `supabase.auth.signInWithOAuth({ provider: 'google' })`. |
| `src/app/pages/auth/auth-callback/` | Rozszerzyć handler o logikę rozróżnienia OAuth vs. email-confirmation i sprawdzenie `username` po OAuth. |
| `src/app/pages/auth/complete-profile/` | Nowy komponent + serwis formularza uzupełnienia profilu. |
| `src/app/core/guards/auth.guard.ts` | Rozszerzyć o sprawdzenie `username` i redirect na `/auth/complete-profile`. |
| `src/app/core/services/profile.service.ts` | Dodać metodę `checkUsernameAvailable(username)` wywołującą `GET /profile/username-available`. |
| `src/app/app.routes.ts` | Dodać trasę `/auth/complete-profile` z dedykowanym guardem. |

---

## 8. Testy API

1. **Inicjalizacja OAuth:** Weryfikacja, że `AuthService.signInWithGoogle()` wywołuje `signInWithOAuth` z poprawnymi parametrami (`provider: 'google'`, `redirectTo`).
2. **Callback — OAuth z nowym profilem:** Symulacja callbacku z `code`, brak `username` w profilu → redirect na `/auth/complete-profile`.
3. **Callback — OAuth z istniejącym profilem:** Symulacja callbacku z `code`, `username` istnieje → redirect na `/dashboard`.
4. **Callback — scalanie kont:** E-mail OAuth pasuje do istniejącego konta → sesja zalogowanego użytkownika, istniejące dane zachowane.
5. **Callback — błąd OAuth:** URL z `error=access_denied` → redirect na `/login?error=access_denied`.
6. **`GET /profile/username-available`:** `available: true` dla wolnej nazwy, `available: false` dla zajętej, `400` dla nieprawidłowego formatu.
7. **Guard `complete-profile`:** Zalogowany bez `username` → redirect na `/auth/complete-profile`; zalogowany z `username` → dostęp do `/dashboard`.
8. **`PATCH /profile` w scenariuszu OAuth:** Poprawny zapis `username`, `409` dla zajętej nazwy.
