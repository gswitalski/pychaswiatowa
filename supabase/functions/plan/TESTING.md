# Testing Guide: Plan Endpoints

## Prerequisites

1. Start local Supabase:
```bash
supabase start
```

2. Apply migrations (if not already applied):
```bash
supabase db reset
# OR
supabase migration up
```

3. Start the function locally:
```bash
supabase functions serve plan
```

4. Get test user JWT token:
   - Email: `test@pychaswiatowa.pl`
   - Password: `554G5rjnbdAanGR`

---

## Test Scenarios: GET /plan

### Scenario GET-1: ✅ Get empty plan (SUCCESS)

**Context:** User has no recipes in plan yet.

**Request:**
```bash
curl -X GET http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `200 OK`
- Body:
```json
{
  "data": [],
  "meta": {
    "total": 0,
    "limit": 50
  }
}
```

### Scenario GET-2: ✅ Get plan with recipes (SUCCESS)

**Setup:** Add 3 recipes to plan first (using POST /plan/recipes):
- Recipe A (your own, added first)
- Recipe B (public from another user, added second)
- Recipe C (your own, added third)

**Request:**
```bash
curl -X GET http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `200 OK`
- Body structure:
```json
{
  "data": [
    {
      "recipe_id": <RECIPE_C_ID>,
      "added_at": "2023-10-30T12:00:00Z",
      "recipe": {
        "id": <RECIPE_C_ID>,
        "name": "Recipe C Name",
        "image_path": "recipe-images/..."
      }
    },
    {
      "recipe_id": <RECIPE_B_ID>,
      "added_at": "2023-10-30T11:00:00Z",
      "recipe": {
        "id": <RECIPE_B_ID>,
        "name": "Recipe B Name",
        "image_path": "recipe-images/..."
      }
    },
    {
      "recipe_id": <RECIPE_A_ID>,
      "added_at": "2023-10-30T10:00:00Z",
      "recipe": {
        "id": <RECIPE_A_ID>,
        "name": "Recipe A Name",
        "image_path": null
      }
    }
  ],
  "meta": {
    "total": 3,
    "limit": 50
  }
}
```

**Verify:**
- Recipes are sorted by `added_at` DESC (newest first: C, B, A)
- Each item contains `recipe_id`, `added_at`, and nested `recipe` object

### Scenario GET-3: ✅ Soft-deleted recipe is hidden (SUCCESS)

**Setup:**
1. Add Recipe D to plan
2. Soft-delete Recipe D:
```sql
UPDATE recipes SET deleted_at = now() WHERE id = <RECIPE_D_ID>;
```

**Request:**
```bash
curl -X GET http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `200 OK`
- Recipe D is NOT in the returned list
- `meta.total` does not include Recipe D
- Database still has the plan_recipes entry, but API filters it out

**Verify:**
```sql
-- Verify soft-deleted recipe is still in plan_recipes
SELECT * FROM plan_recipes WHERE recipe_id = <RECIPE_D_ID>;

-- But not returned by API (use service to verify filtering logic)
```

### Scenario GET-4: ✅ Non-public recipe from another user is hidden (SUCCESS)

**Setup:**
1. Add public Recipe E from User2 to your plan (success)
2. User2 changes Recipe E visibility to PRIVATE:
```sql
UPDATE recipes 
SET visibility = 'PRIVATE' 
WHERE id = <RECIPE_E_ID>;
```

**Request:**
```bash
curl -X GET http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `200 OK`
- Recipe E is NOT in the returned list (filtered out by access rules)
- `meta.total` does not include Recipe E
- Your own recipes are still visible regardless of visibility

**Verify:**
```sql
-- Verify recipe is still in plan_recipes
SELECT * FROM plan_recipes WHERE recipe_id = <RECIPE_E_ID>;

-- Verify recipe is now PRIVATE
SELECT id, name, visibility, user_id FROM recipes WHERE id = <RECIPE_E_ID>;
```

### Scenario GET-5: ✅ Plan with 50 items (limit) (SUCCESS)

**Setup:** Add 50 recipes to plan.

**Request:**
```bash
curl -X GET http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `200 OK`
- `data` array has 50 items
- `meta.total` is 50
- `meta.limit` is 50
- Items are sorted by `added_at DESC`

### Scenario GET-6: ❌ Missing Authorization header (UNAUTHORIZED)

**Request:**
```bash
curl -X GET http://localhost:54331/functions/v1/plan
```

**Expected Response:**
- Status: `401 Unauthorized`
- Body:
```json
{
  "code": "UNAUTHORIZED",
  "message": "Missing Authorization header"
}
```

### Scenario GET-7: ❌ Invalid JWT token (UNAUTHORIZED)

**Request:**
```bash
curl -X GET http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer invalid_token_here"
```

**Expected Response:**
- Status: `401 Unauthorized`
- Body:
```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid token"
}
```

---

## Test Scenarios: POST /plan/recipes

### Setup: Create test recipes

Create a few test recipes first (using existing `/recipes` endpoint):
- Recipe A: Your own recipe (any visibility)
- Recipe B: Your own PUBLIC recipe
- Recipe C: Another user's PUBLIC recipe
- Recipe D: Another user's PRIVATE recipe

### Scenario 1: ✅ Add own recipe to plan (SUCCESS)

**Request:**
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": <RECIPE_A_ID>}'
```

**Expected Response:**
- Status: `201 Created`
- Body:
```json
{
  "message": "Recipe added to plan successfully."
}
```

### Scenario 2: ✅ Add public recipe from another user (SUCCESS)

**Request:**
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": <RECIPE_C_ID>}'
```

**Expected Response:**
- Status: `201 Created`
- Body:
```json
{
  "message": "Recipe added to plan successfully."
}
```

### Scenario 3: ❌ Add duplicate recipe (CONFLICT)

**Request:**
```bash
# Try adding Recipe A again
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": <RECIPE_A_ID>}'
```

**Expected Response:**
- Status: `409 Conflict`
- Body:
```json
{
  "code": "CONFLICT",
  "message": "Recipe is already in plan"
}
```

### Scenario 4: ❌ Add someone else's private recipe (FORBIDDEN)

**Request:**
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": <RECIPE_D_ID>}'
```

**Expected Response:**
- Status: `403 Forbidden`
- Body:
```json
{
  "code": "FORBIDDEN",
  "message": "You do not have access to this recipe"
}
```

### Scenario 5: ❌ Add non-existent recipe (NOT FOUND)

**Request:**
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": 999999}'
```

**Expected Response:**
- Status: `404 Not Found`
- Body:
```json
{
  "code": "NOT_FOUND",
  "message": "Recipe not found"
}
```

### Scenario 6: ❌ Add soft-deleted recipe (NOT FOUND)

**Setup:** First soft-delete one of your recipes:
```sql
UPDATE recipes SET deleted_at = now() WHERE id = <RECIPE_B_ID>;
```

**Request:**
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": <RECIPE_B_ID>}'
```

**Expected Response:**
- Status: `404 Not Found`
- Body:
```json
{
  "code": "NOT_FOUND",
  "message": "Recipe not found"
}
```

### Scenario 7: ❌ Plan limit reached (UNPROCESSABLE ENTITY)

**Setup:** Add 50 recipes to plan first:
```bash
for i in {1..50}; do
  curl -X POST http://localhost:54331/functions/v1/plan/recipes \
    -H "Authorization: Bearer <JWT_TOKEN>" \
    -H "Content-Type: application/json" \
    -d "{\"recipe_id\": $i}"
done
```

**Request:** Try adding 51st recipe:
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": 51}'
```

**Expected Response:**
- Status: `422 Unprocessable Entity`
- Body:
```json
{
  "code": "UNPROCESSABLE_ENTITY",
  "message": "Plan limit reached (50 recipes)"
}
```

### Scenario 8: ❌ Missing Authorization header (UNAUTHORIZED)

**Request:**
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": 1}'
```

**Expected Response:**
- Status: `401 Unauthorized`
- Body:
```json
{
  "code": "UNAUTHORIZED",
  "message": "Missing Authorization header"
}
```

### Scenario 9: ❌ Invalid JSON body (VALIDATION ERROR)

**Request:**
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": "invalid"}'
```

**Expected Response:**
- Status: `400 Bad Request`
- Body:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "recipe_id: Expected number, received string"
}
```

### Scenario 10: ❌ Negative recipe_id (VALIDATION ERROR)

**Request:**
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": -5}'
```

**Expected Response:**
- Status: `400 Bad Request`
- Body:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "recipe_id: Recipe ID must be a positive integer"
}
```

### Scenario 11: ❌ Missing recipe_id (VALIDATION ERROR)

**Request:**
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
- Status: `400 Bad Request`
- Body:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "recipe_id: Required"
}
```

## Verification Queries

### GET /plan verification

```sql
-- Check raw plan_recipes data
SELECT * FROM plan_recipes 
WHERE user_id = auth.uid() 
ORDER BY added_at DESC;

-- View plan with recipe details (simulates API query)
SELECT 
    pr.recipe_id,
    pr.added_at,
    r.id,
    r.name,
    r.image_path,
    r.user_id,
    r.visibility,
    r.deleted_at
FROM plan_recipes pr
JOIN recipes r ON r.id = pr.recipe_id
WHERE pr.user_id = auth.uid()
ORDER BY pr.added_at DESC
LIMIT 50;

-- Count accessible items (after filtering)
SELECT COUNT(*) 
FROM plan_recipes pr
JOIN recipes r ON r.id = pr.recipe_id
WHERE pr.user_id = auth.uid()
  AND r.deleted_at IS NULL
  AND (r.user_id = auth.uid() OR r.visibility = 'PUBLIC');
```

### POST /plan/recipes verification

```sql
-- Check if recipe was added
SELECT * FROM plan_recipes 
WHERE user_id = auth.uid() 
  AND recipe_id = <RECIPE_ID>;

-- Count total items in plan
SELECT COUNT(*) FROM plan_recipes 
WHERE user_id = auth.uid();
```

## Clean up

Remove all plan items:
```sql
DELETE FROM plan_recipes WHERE user_id = auth.uid();
```

## Notes

- The trigger `enforce_plan_limit` is atomic and prevents race conditions
- RLS policies ensure users can only modify their own plan
- Soft-deleted recipes are excluded from plan (can't be added)
- Duplicate prevention is enforced by `PRIMARY KEY (user_id, recipe_id)`

