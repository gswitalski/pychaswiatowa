# Testing Guide: POST /plan/recipes

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

## Test Scenarios

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

After successful additions, verify the data in the database:

```sql
-- Check plan_recipes table
SELECT * FROM plan_recipes 
WHERE user_id = auth.uid() 
ORDER BY added_at DESC;

-- Count items in plan
SELECT COUNT(*) FROM plan_recipes 
WHERE user_id = auth.uid();

-- View plan with recipe details
SELECT 
    pr.added_at,
    r.id,
    r.name,
    r.image_path,
    r.visibility,
    r.deleted_at
FROM plan_recipes pr
JOIN recipes r ON r.id = pr.recipe_id
WHERE pr.user_id = auth.uid()
ORDER BY pr.added_at DESC;
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

