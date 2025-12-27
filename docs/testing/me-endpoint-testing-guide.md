# Endpoint GET /me - Instrukcja testowania

## Przygotowanie środowiska lokalnego

### 1. Zastosuj migrację JWT claims

```bash
# Reset i zastosuj wszystkie migracje (w tym nową app_role)
supabase db reset

# Lub tylko nową migrację jeśli baza już działa
supabase migration up
```

### 2. Uruchom Edge Function lokalnie

```bash
# Uruchom funkcję me
supabase functions serve me
```

Funkcja będzie dostępna pod adresem: `http://localhost:54331/functions/v1/me`

### 3. Przygotuj dane testowe

Zaloguj się jako użytkownik testowy aby otrzymać JWT token:

**Dane logowania użytkownika testowego:**
- Email: `test@pychaswiatowa.pl`
- Hasło: `554G5rjnbdAanGR`

Możesz użyć Supabase Studio lub frontendu do logowania i uzyskania access tokena.

## Scenariusze testowe

### Test 1: ✅ Poprawne żądanie z tokenem

```bash
curl -X GET http://localhost:54331/functions/v1/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Oczekiwany rezultat:**
- Status: `200 OK`
- Payload:
```json
{
  "id": "uuid-user-id",
  "username": "test",
  "app_role": "user"
}
```

### Test 2: ❌ Brak nagłówka Authorization

```bash
curl -X GET http://localhost:54331/functions/v1/me \
  -H "Content-Type: application/json"
```

**Oczekiwany rezultat:**
- Status: `401 Unauthorized`
- Payload:
```json
{
  "code": "UNAUTHORIZED",
  "message": "Missing Authorization header"
}
```

### Test 3: ❌ Niepoprawny format Authorization

```bash
curl -X GET http://localhost:54331/functions/v1/me \
  -H "Authorization: InvalidToken123" \
  -H "Content-Type: application/json"
```

**Oczekiwany rezultat:**
- Status: `401 Unauthorized`
- Payload:
```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid Authorization header format. Expected \"Bearer <token>\""
}
```

### Test 4: ❌ Token wygasły/niepoprawny

```bash
curl -X GET http://localhost:54331/functions/v1/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.token" \
  -H "Content-Type: application/json"
```

**Oczekiwany rezultat:**
- Status: `401 Unauthorized`
- Payload:
```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

### Test 5: ❌ Token bez claim app_role (nie powinno się zdarzyć po migracji)

Jeśli jakiś stary token nie ma `app_role`:

**Oczekiwany rezultat:**
- Status: `401 Unauthorized`
- Payload:
```json
{
  "code": "UNAUTHORIZED",
  "message": "Token missing app_role claim. Please sign in again."
}
```

### Test 6: ❌ Metoda HTTP nie dozwolona

```bash
curl -X POST http://localhost:54331/functions/v1/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

**Oczekiwany rezultat:**
- Status: `405 Method Not Allowed`
- Payload:
```json
{
  "code": "METHOD_NOT_ALLOWED",
  "message": "Method POST not allowed"
}
```

### Test 7: ✅ CORS Preflight

```bash
curl -X OPTIONS http://localhost:54331/functions/v1/me
```

**Oczekiwany rezultat:**
- Status: `204 No Content`
- Headers powinny zawierać:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, OPTIONS`
  - `Access-Control-Allow-Headers: Authorization, X-Client-Info, Content-Type, Apikey`

## Weryfikacja JWT payload

Aby sprawdzić czy JWT faktycznie zawiera `app_role`, możesz zdekodować token na https://jwt.io/

Payload powinien zawierać:
```json
{
  "sub": "user-uuid",
  "role": "authenticated",
  "app_role": "user",
  // ... inne standardowe claims
}
```

## Monitorowanie logów

Logi Edge Function możesz obserwować w konsoli gdzie uruchomiłeś `supabase functions serve me`.

Oczekiwane logi dla poprawnego żądania:
```json
{"level":"info","message":"Incoming request to /me","timestamp":"...","context":{"method":"GET","url":"..."}}
{"level":"info","message":"Handling GET /me request","timestamp":"..."}
{"level":"info","message":"Fetching minimal profile for /me","timestamp":"...","context":{"userId":"...","appRole":"user"}}
{"level":"info","message":"Profile fetched successfully for /me","timestamp":"...","context":{"userId":"...","username":"test","appRole":"user"}}
{"level":"info","message":"GET /me completed successfully","timestamp":"...","context":{"userId":"...","appRole":"user"}}
```

## Troubleshooting

### Problem: "Profile not found" dla istniejącego użytkownika
- **Przyczyna**: Trigger `handle_new_user` nie zadziałał lub profil nie został utworzony
- **Rozwiązanie**: Manualnie dodaj profil w Supabase Studio lub poprzez SQL:
```sql
INSERT INTO public.profiles (id, username) 
VALUES ('user-uuid', 'test');
```

### Problem: "Token missing app_role claim"
- **Przyczyna**: Migracja JWT nie została zastosowana lub użytkownik nie zalogował się ponownie po migracji
- **Rozwiązanie**: 
  1. Sprawdź czy migracja została wykonana: `supabase migration list`
  2. Wyloguj i zaloguj się ponownie aby dostać nowy token z `app_role`
  3. Sprawdź w `auth.users` czy `raw_app_metadata` zawiera `app_role`

### Problem: CORS errors w przeglądarce
- **Przyczyna**: CORS headers nie są prawidłowo ustawione
- **Rozwiązanie**: Sprawdź czy funkcja zwraca odpowiednie nagłówki CORS (patrz implementacja w `index.ts`)

