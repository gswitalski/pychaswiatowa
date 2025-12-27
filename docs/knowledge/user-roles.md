# Przechowywanie Informacji o Roli Użytkownika

Informacja o roli aplikacyjnej (`app_role`) jest przechowywana w **dwóch miejscach**:

## 1. 🗄️ Baza Danych - źródło prawdy

**Tabela:** `auth.users`  
**Kolumna:** `raw_app_meta_data` (JSONB)

```sql
-- Przykład struktury w bazie danych
SELECT id, email, raw_app_meta_data 
FROM auth.users;

-- Wynik:
-- id: "uuid-123"
-- email: "user@example.com"
-- raw_app_meta_data: {"app_role": "user"}
```

**Ważne:** 
- `app_role` **NIE** jest przechowywane w tabeli `profiles`
- Jest to metadata w systemowej tabeli Supabase `auth.users`
- Zmiana roli wymaga UPDATE na `auth.users.raw_app_meta_data`

## 2. 🎫 JWT Token - przekazywane do klienta

Supabase **automatycznie** dołącza zawartość `raw_app_meta_data` do JWT payload jako custom claims.

**Przykład zdekodowanego JWT:**
```json
{
  "sub": "uuid-123",
  "email": "user@example.com",
  "role": "authenticated",
  "app_role": "user",      // ← To pochodzi z raw_app_meta_data
  "iat": 1234567890,
  "exp": 1234571490
}
```

## 📋 Przepływ danych

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Rejestracja / Aktualizacja                               │
│    Trigger: on_auth_user_created_set_role                   │
│    Ustawia: raw_app_meta_data = {"app_role": "user"}        │
│    W tabeli: auth.users                                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Logowanie                                                │
│    Supabase generuje JWT                                    │
│    Dołącza: raw_app_meta_data jako custom claims           │
│    Zwraca: access_token z app_role w payload               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Request do API                                           │
│    Klient wysyła: Authorization: Bearer <JWT>              │
│    Backend odczytuje: app_role z JWT (bez query do DB)     │
│    Endpoint /me zwraca: {id, username, app_role}           │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Jak zarządzać rolami?

### Sprawdzanie aktualnej roli:

```sql
-- W bazie danych
SELECT email, raw_app_meta_data->>'app_role' as app_role 
FROM auth.users;
```

### Zmiana roli (ręcznie w DB):

```sql
-- Nadanie roli premium
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    raw_app_meta_data, 
    '{app_role}', 
    '"premium"'::jsonb
)
WHERE email = 'user@example.com';

-- ⚠️ Użytkownik musi się wylogować i zalogować ponownie
-- aby dostać nowy token z zaktualizowaną rolą!
```

### Zmiana roli dla wielu użytkowników:

```sql
-- Nadanie roli premium wszystkim użytkownikom z domeną @premium.com
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
    raw_app_meta_data, 
    '{app_role}', 
    '"premium"'::jsonb
)
WHERE email LIKE '%@premium.com';
```

## 📍 Lokalizacja w kodzie

1. **Migracja:** `supabase/migrations/20251227120000_add_app_role_to_jwt.sql`
2. **Walidacja w backend:** `supabase/functions/_shared/auth.ts` (funkcja `extractAndValidateAppRole`)
3. **Typy:** `shared/contracts/types.ts` (`AppRole`, `MeDto`)
4. **Endpoint zwracający rolę:** `supabase/functions/me/` (GET /me)

## ⚠️ Ważne informacje

- **Rola jest tylko do odczytu** dla zwykłych użytkowników (przez RLS)
- **Zmiana roli** wymaga uprawnień administratora lub bezpośredniego dostępu do DB
- **Refresh tokena** - po zmianie roli w DB, użytkownik musi się przelogować aby dostać nowy JWT z zaktualizowaną rolą
- **Frontend** odczytuje rolę z JWT (nie musi robić dodatkowego zapytania do `/me` tylko dla roli)
- **Wartości dozwolone:** `'user'`, `'premium'`, `'admin'` (walidowane przez Zod w backend)

## 🔐 Bezpieczeństwo

- Rola w JWT jest **podpisana** przez Supabase - nie można jej sfałszować po stronie klienta
- Backend **zawsze waliduje** rolę z JWT przed użyciem (schema Zod)
- Jeśli JWT nie zawiera `app_role` lub ma nieprawidłową wartość → `401 Unauthorized`
- Trigger `on_auth_user_created_set_role` automatycznie ustawia domyślną rolę `'user'` dla nowych użytkowników

## 📚 Powiązane dokumenty

- [API Plan - GET /me](../results/main-project-docs/009%20API%20plan.md)
- [RBAC Changes](../results/changes/role-based-access-control-changes.md)
- [ME Endpoint Implementation Plan](../results/impl-plans/endpoints/me-api-implementation-plan.md)
- [Testing Guide - ME Endpoint](../testing/me-endpoint-testing-guide.md)

