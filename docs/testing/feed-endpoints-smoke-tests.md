# Smoke Tests: Feed Endpoints

Podstawowe testy funkcjonalne dla endpointów `/public/recipes/feed` i `/recipes/feed`.

## Przygotowanie

### Zmienne środowiskowe

```bash
# URL projektu Supabase
SUPABASE_URL="http://localhost:54321"
# lub dla deployed: "https://your-project.supabase.co"

# Anon key dla publicznych endpointów
SUPABASE_ANON_KEY="your-anon-key"

# JWT token dla authenticated endpointów
JWT_TOKEN="your-jwt-token"
```

### Jak uzyskać JWT token

1. Zaloguj się w aplikacji lub użyj Supabase Auth
2. Token znajduje się w localStorage jako `sb-<project-ref>-auth-token`
3. Lub użyj testowego użytkownika:
   - Email: `test@pychaswiatowa.pl`
   - Hasło: `554G5rjnbdAanGR`

## Test 1: Public Feed - Pierwsza strona (bez cursor)

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/public/recipes/feed?limit=12" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

### Expected Response (200 OK)
```json
{
  "data": [
    {
      "id": 1,
      "name": "Recipe Name",
      "description": "...",
      "image_path": "...",
      "category": { "id": 1, "name": "Category" },
      "tags": ["tag1", "tag2"],
      "author": { "id": "...", "username": "john.doe" },
      "created_at": "2023-10-27T10:00:00Z",
      "in_my_collections": false,
      "servings": 4,
      "is_termorobot": false
    }
  ],
  "pageInfo": {
    "hasMore": true,
    "nextCursor": "eyJ2IjoxLCJvZmZzZXQiOjEyLCJsaW1pdCI6MTIsInNvcnQiOiJjcmVhdGVkX2F0LmRlc2MiLCJmaWx0ZXJzSGFzaCI6IjEyMzQ1NiJ9"
  }
}
```

### Walidacja
- ✅ Status code: 200
- ✅ `data` jest tablicą (max 12 elementów)
- ✅ `pageInfo.hasMore` jest boolean
- ✅ `pageInfo.nextCursor` jest string lub null
- ✅ Każdy przepis ma wszystkie wymagane pola
- ✅ `in_my_collections` jest false (anonimowy request)
- ✅ Header `Cache-Control: public, max-age=60`

## Test 2: Public Feed - Druga strona (z cursor)

### Request
```bash
# Użyj nextCursor z poprzedniej odpowiedzi
CURSOR="eyJ2IjoxLCJvZmZzZXQiOjEyLCJsaW1pdCI6MTIsInNvcnQiOiJjcmVhdGVkX2F0LmRlc2MiLCJmaWx0ZXJzSGFzaCI6IjEyMzQ1NiJ9"

curl -X GET "${SUPABASE_URL}/functions/v1/public/recipes/feed?limit=12&cursor=${CURSOR}" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

### Expected Response (200 OK)
```json
{
  "data": [...],
  "pageInfo": {
    "hasMore": false,
    "nextCursor": null
  }
}
```

### Walidacja
- ✅ Status code: 200
- ✅ `data` zawiera inne przepisy niż w Test 1 (brak duplikatów)
- ✅ Jeśli to ostatnia strona: `hasMore: false`, `nextCursor: null`

## Test 3: Public Feed - Z filtrem wyszukiwania

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/public/recipes/feed?limit=12&q=pizza" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

### Walidacja
- ✅ Status code: 200
- ✅ Wszystkie zwrócone przepisy zawierają "pizza" w nazwie
- ✅ `nextCursor` jest różny od testów bez filtru

## Test 4: Public Feed - Z filtrem termorobot

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/public/recipes/feed?limit=12&filter[termorobot]=true" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

### Walidacja
- ✅ Status code: 200
- ✅ Wszystkie zwrócone przepisy mają `is_termorobot: true`

## Test 5: Public Feed - Z sortowaniem

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/public/recipes/feed?limit=12&sort=name.asc" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

### Walidacja
- ✅ Status code: 200
- ✅ Przepisy są posortowane alfabetycznie po nazwie (A→Z)
- ✅ Cursor zawiera informację o sortowaniu

## Test 6: Public Feed - Authenticated (z JWT)

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/public/recipes/feed?limit=12" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Expected Response (200 OK)
```json
{
  "data": [
    {
      "id": 1,
      "name": "Recipe Name",
      "in_my_collections": true,
      ...
    }
  ],
  "pageInfo": {...}
}
```

### Walidacja
- ✅ Status code: 200
- ✅ `in_my_collections` może być true dla przepisów w kolekcjach użytkownika
- ✅ Header `Cache-Control: no-store` (NIE public)

## Test 7: Public Feed - Invalid cursor

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/public/recipes/feed?limit=12&cursor=invalid" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

### Expected Response (400 Bad Request)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid cursor: ..."
}
```

### Walidacja
- ✅ Status code: 400
- ✅ Error message wskazuje na invalid cursor

## Test 8: Public Feed - Cursor z innymi parametrami

### Request
```bash
# 1. Pobierz cursor z limit=12
CURSOR=$(curl -s -X GET "${SUPABASE_URL}/functions/v1/public/recipes/feed?limit=12" \
  -H "apikey: ${SUPABASE_ANON_KEY}" | jq -r '.pageInfo.nextCursor')

# 2. Użyj cursor z innym limit
curl -X GET "${SUPABASE_URL}/functions/v1/public/recipes/feed?limit=24&cursor=${CURSOR}" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

### Expected Response (400 Bad Request)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Cursor is invalid: limit parameter has changed"
}
```

### Walidacja
- ✅ Status code: 400
- ✅ Error message wskazuje na zmianę parametrów

## Test 9: Public Feed - Query string za krótkie

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/public/recipes/feed?q=a" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

### Expected Response (400 Bad Request)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Search query must be at least 2 characters"
}
```

### Walidacja
- ✅ Status code: 400
- ✅ Error message wymaga minimum 2 znaków

## Test 10: Recipes Feed - Bez JWT (401)

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/recipes/feed?limit=12" \
  -H "apikey: ${SUPABASE_ANON_KEY}"
```

### Expected Response (401 Unauthorized)
```json
{
  "code": "UNAUTHORIZED",
  "message": "Authentication required"
}
```

### Walidacja
- ✅ Status code: 401

## Test 11: Recipes Feed - Z JWT (pierwsza strona)

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/recipes/feed?limit=12" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Expected Response (200 OK)
```json
{
  "data": [
    {
      "id": 1,
      "name": "Recipe Name",
      "image_path": "...",
      "created_at": "...",
      "visibility": "PRIVATE",
      "is_owner": true,
      "in_my_collections": false,
      "author": { "id": "...", "username": "..." },
      "category_id": 1,
      "category_name": "Category",
      "servings": 4,
      "is_termorobot": false
    }
  ],
  "pageInfo": {
    "hasMore": true,
    "nextCursor": "..."
  }
}
```

### Walidacja
- ✅ Status code: 200
- ✅ Zwrócone przepisy należą do użytkownika (is_owner: true dla view=owned)
- ✅ Przepisy mogą mieć różne visibility (PRIVATE, SHARED, PUBLIC)
- ✅ `nextCursor` jest obecny jeśli jest więcej danych

## Test 12: Recipes Feed - View my_recipes

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/recipes/feed?limit=12&view=my_recipes" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Walidacja
- ✅ Status code: 200
- ✅ Zwrócone przepisy to własne + z kolekcji
- ✅ Niektóre przepisy mogą mieć `is_owner: false` i `in_my_collections: true`

## Test 13: Recipes Feed - Z wszystkimi filtrami

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/recipes/feed?limit=12&view=owned&sort=name.asc&filter[category_id]=2&filter[tags]=dessert,baking&filter[termorobot]=false&search=cake" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Walidacja
- ✅ Status code: 200
- ✅ Przepisy pasują do wszystkich filtrów
- ✅ Cursor zawiera hash wszystkich filtrów

## Test 14: Recipes Feed - Druga strona z cursor

### Request
```bash
# 1. Pobierz cursor z pierwszej strony
CURSOR=$(curl -s -X GET "${SUPABASE_URL}/functions/v1/recipes/feed?limit=12" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq -r '.pageInfo.nextCursor')

# 2. Pobierz drugą stronę
curl -X GET "${SUPABASE_URL}/functions/v1/recipes/feed?limit=12&cursor=${CURSOR}" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Walidacja
- ✅ Status code: 200
- ✅ Brak duplikatów z pierwszej strony
- ✅ Przepisy są kontynuacją z pierwszej strony

## Test 15: Recipes Feed - Invalid sort field

### Request
```bash
curl -X GET "${SUPABASE_URL}/functions/v1/recipes/feed?sort=invalid.asc" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Expected Response (400 Bad Request)
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Sort field must be one of: name, created_at, updated_at"
}
```

### Walidacja
- ✅ Status code: 400

## Automatyzacja testów

### Skrypt testowy (bash)

```bash
#!/bin/bash
# test-feed-endpoints.sh

# Kolory dla output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local test_name="$1"
    local expected_status="$2"
    local url="$3"
    local headers="$4"
    
    echo -n "Testing: $test_name ... "
    
    response=$(curl -s -w "\n%{http_code}" $headers "$url")
    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $status)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}FAIL${NC} (Expected HTTP $expected_status, got $status)"
        echo "Response: $body"
        ((FAILED++))
        return 1
    fi
}

# Run tests
echo "Starting Feed Endpoints Smoke Tests..."
echo "========================================="

# Test 1: Public feed without cursor
test_endpoint \
    "Public Feed - First Page" \
    "200" \
    "${SUPABASE_URL}/functions/v1/public/recipes/feed?limit=12" \
    "-H 'apikey: ${SUPABASE_ANON_KEY}'"

# Test 2: Public feed with invalid cursor
test_endpoint \
    "Public Feed - Invalid Cursor" \
    "400" \
    "${SUPABASE_URL}/functions/v1/public/recipes/feed?cursor=invalid" \
    "-H 'apikey: ${SUPABASE_ANON_KEY}'"

# Test 3: Recipes feed without auth
test_endpoint \
    "Recipes Feed - No Auth" \
    "401" \
    "${SUPABASE_URL}/functions/v1/recipes/feed?limit=12" \
    "-H 'apikey: ${SUPABASE_ANON_KEY}'"

# Test 4: Recipes feed with auth
test_endpoint \
    "Recipes Feed - With Auth" \
    "200" \
    "${SUPABASE_URL}/functions/v1/recipes/feed?limit=12" \
    "-H 'apikey: ${SUPABASE_ANON_KEY}' -H 'Authorization: Bearer ${JWT_TOKEN}'"

# Summary
echo "========================================="
echo "Test Summary:"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

exit $FAILED
```

### Uruchomienie

```bash
chmod +x test-feed-endpoints.sh
./test-feed-endpoints.sh
```

## Checklist

Przed wypuszczeniem na produkcję:

- [ ] Test 1-6: Publiczny feed działa poprawnie
- [ ] Test 7-9: Walidacja parametrów działa
- [ ] Test 10-15: Prywatny feed wymaga autentykacji
- [ ] Cursor nie jest podatny na manipulację
- [ ] Cache-Control ustawiony prawidłowo
- [ ] Performance: endpoint odpowiada < 500ms dla 12 elementów
- [ ] Brak N+1 queries (sprawdź logi PostgreSQL)
- [ ] RLS policies działają poprawnie
- [ ] Stable sorting zapobiega duplikatom/brakującym elementom

