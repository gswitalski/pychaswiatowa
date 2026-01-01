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

---

## Test Scenarios: DELETE /plan/recipes/{recipeId}

### Setup: Add test recipe to plan

First, add a recipe to plan to test deletion:
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": 1}'
```

### Scenario DELETE-1: ✅ Remove recipe from plan (SUCCESS)

**Setup:** Recipe with ID 1 is in user's plan.

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/1 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `204 No Content`
- Body: empty (no content)

**Verify:**
```sql
-- Recipe should be removed from plan
SELECT * FROM plan_recipes WHERE user_id = auth.uid() AND recipe_id = 1;
-- Should return 0 rows
```

### Scenario DELETE-2: ❌ Remove recipe not in plan (NOT FOUND)

**Setup:** Recipe with ID 123 is NOT in user's plan.

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/123 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `404 Not Found`
- Body:
```json
{
  "code": "NOT_FOUND",
  "message": "Recipe not found in plan"
}
```

**Note:** This is the expected behavior for idempotency - trying to delete the same recipe twice also returns 404.

### Scenario DELETE-3: ❌ Remove recipe with invalid ID - string (VALIDATION ERROR)

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/abc \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `400 Bad Request`
- Body:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "recipeId must be a valid number"
}
```

### Scenario DELETE-4: ❌ Remove recipe with negative ID (VALIDATION ERROR)

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/-1 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `400 Bad Request`
- Body:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "recipeId must be a positive integer"
}
```

### Scenario DELETE-5: ❌ Remove recipe with zero ID (VALIDATION ERROR)

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/0 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `400 Bad Request`
- Body:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "recipeId must be a positive integer"
}
```

### Scenario DELETE-6: ❌ Remove recipe with decimal ID (VALIDATION ERROR)

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/1.5 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `400 Bad Request`
- Body:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "recipeId must be an integer"
}
```

**Note:** `Number.parseInt("1.5", 10)` returns `1`, but `Number.isInteger(1.5)` catches this.

### Scenario DELETE-7: ❌ Missing Authorization header (UNAUTHORIZED)

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/1
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

### Scenario DELETE-8: ❌ Invalid JWT token (UNAUTHORIZED)

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/1 \
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

### Scenario DELETE-9: ✅ Idempotency test (NOT FOUND on second delete)

**Setup:**
1. Add recipe to plan
2. Delete it successfully (204)
3. Try deleting again

**Request 1:** (First delete)
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/1 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response 1:**
- Status: `204 No Content`

**Request 2:** (Second delete - same recipe)
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/1 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response 2:**
- Status: `404 Not Found`
- Body:
```json
{
  "code": "NOT_FOUND",
  "message": "Recipe not found in plan"
}
```

**Verify:** This demonstrates that DELETE is idempotent - the first call removes the recipe, subsequent calls indicate it's not in the plan.

### Scenario DELETE-10: ✅ Cannot delete from another user's plan (NOT FOUND)

**Setup:**
- User A adds recipe 1 to their plan
- User B tries to delete recipe 1 from User A's plan

**Request:** (as User B)
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan/recipes/1 \
  -H "Authorization: Bearer <USER_B_JWT_TOKEN>"
```

**Expected Response:**
- Status: `404 Not Found`
- Body:
```json
{
  "code": "NOT_FOUND",
  "message": "Recipe not found in plan"
}
```

**Note:** RLS prevents User B from deleting from User A's plan. The operation returns 404 (not 403) to avoid information leakage about what's in other users' plans.

---

## Test Scenarios: DELETE /plan

### Scenario CLEAR-1: ✅ Clear plan with recipes (SUCCESS)

**Setup:** Add 3 recipes to plan first:
```bash
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": 1}'

curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": 2}'

curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": 3}'
```

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `204 No Content`
- Body: empty (no content)

**Verify:**
```bash
# GET /plan should return empty plan
curl -X GET http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected verification response:**
```json
{
  "data": [],
  "meta": {
    "total": 0,
    "limit": 50
  }
}
```

**SQL verification:**
```sql
-- All recipes should be removed from plan
SELECT * FROM plan_recipes WHERE user_id = auth.uid();
-- Should return 0 rows
```

### Scenario CLEAR-2: ✅ Clear empty plan (SUCCESS - Idempotent)

**Setup:** Ensure plan is empty (run CLEAR-1 first or start fresh).

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `204 No Content`
- Body: empty (no content)

**Note:** This verifies idempotency - clearing an already-empty plan is considered success.

**Verify:**
```bash
# GET /plan should still return empty plan
curl -X GET http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Scenario CLEAR-3: ✅ Clear plan with 50 items (SUCCESS)

**Setup:** Add 50 recipes to plan (maximum allowed).

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response:**
- Status: `204 No Content`
- Body: empty (no content)

**Verify:**
```sql
-- All 50 recipes should be removed
SELECT COUNT(*) FROM plan_recipes WHERE user_id = auth.uid();
-- Should return 0
```

**Performance:** Should complete in < 20ms even with 50 items.

### Scenario CLEAR-4: ❌ Missing Authorization header (UNAUTHORIZED)

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan
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

### Scenario CLEAR-5: ❌ Invalid JWT token (UNAUTHORIZED)

**Request:**
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan \
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

### Scenario CLEAR-6: ✅ Cannot clear another user's plan (RLS protection)

**Setup:**
- User A adds recipes to their plan
- User B tries to clear User A's plan

**Request:** (as User B)
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <USER_B_JWT_TOKEN>"
```

**Expected Response:**
- Status: `204 No Content` (User B's own plan is cleared, not User A's)

**Verify:**
```sql
-- User A's plan should remain intact
SELECT COUNT(*) FROM plan_recipes WHERE user_id = '<USER_A_ID>';
-- Should still show User A's recipes

-- User B's plan should be empty (if it had any items)
SELECT COUNT(*) FROM plan_recipes WHERE user_id = '<USER_B_ID>';
-- Should return 0
```

**Note:** RLS ensures users can only modify their own plan. Each user's DELETE operation is isolated to their own data.

### Scenario CLEAR-7: ✅ Idempotency test (multiple clears)

**Setup:** Add recipes to plan, then clear multiple times.

**Request 1:** (First clear)
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response 1:**
- Status: `204 No Content`

**Request 2:** (Second clear - plan already empty)
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response 2:**
- Status: `204 No Content`

**Request 3:** (Third clear - still empty)
```bash
curl -X DELETE http://localhost:54331/functions/v1/plan \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Expected Response 3:**
- Status: `204 No Content`

**Verify:** All three operations succeed with 204, demonstrating true idempotency.

---

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

### DELETE /plan/recipes/{recipeId} verification

```sql
-- Verify recipe was removed from plan
SELECT * FROM plan_recipes 
WHERE user_id = auth.uid() 
  AND recipe_id = <RECIPE_ID>;
-- Should return 0 rows after successful deletion

-- Count remaining items in plan
SELECT COUNT(*) FROM plan_recipes 
WHERE user_id = auth.uid();

-- Check deletion was isolated to specific recipe
SELECT recipe_id FROM plan_recipes 
WHERE user_id = auth.uid()
ORDER BY added_at DESC;
-- Should show all recipes except the deleted one
```

### DELETE /plan verification

```sql
-- Verify all recipes were removed from plan
SELECT * FROM plan_recipes 
WHERE user_id = auth.uid();
-- Should return 0 rows after successful clear

-- Verify count is zero
SELECT COUNT(*) FROM plan_recipes 
WHERE user_id = auth.uid();
-- Should return 0

-- Verify other users' plans are not affected (requires service role query)
SELECT user_id, COUNT(*) as plan_count
FROM plan_recipes
GROUP BY user_id
ORDER BY user_id;
-- Should show only other users' plans with their counts intact
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

