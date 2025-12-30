# Plan Edge Function

Edge Function dla zasobu "Mój plan" - lista przepisów zaplanowanych przez użytkownika.

## Endpoints

### `POST /plan/recipes`
Dodaje przepis do planu użytkownika.

**Request:**
- Method: `POST`
- Path: `/functions/v1/plan/recipes`
- Headers:
  - `Authorization: Bearer <JWT>` (required)
  - `Content-Type: application/json` (required)
- Body:
```json
{
  "recipe_id": 123
}
```

**Response:**
- `201 Created`:
```json
{
  "message": "Recipe added to plan successfully."
}
```

**Error Responses:**
- `400 Bad Request` - walidacja nie powiodła się
- `401 Unauthorized` - brak lub nieprawidłowy JWT
- `403 Forbidden` - użytkownik nie ma dostępu do przepisu
- `404 Not Found` - przepis nie istnieje lub jest usunięty
- `409 Conflict` - przepis już jest w planie
- `422 Unprocessable Entity` - przekroczony limit 50 przepisów
- `500 Internal Server Error` - błąd serwera

## Business Rules

1. **Unikalność**: Użytkownik nie może dodać tego samego przepisu dwa razy
2. **Limit**: Maksymalnie 50 przepisów na użytkownika
3. **Dostęp**:
   - Użytkownik może dodać własne przepisy (dowolna visibility)
   - Użytkownik może dodać publiczne przepisy innych użytkowników
   - Użytkownik NIE może dodać prywatnych przepisów innych użytkowników
4. **Soft delete**: Nie można dodać przepisu oznaczonego jako usunięty (`deleted_at != null`)

## Database Schema

### Table: `plan_recipes`

```sql
CREATE TABLE plan_recipes (
    user_id uuid NOT NULL DEFAULT auth.uid(),
    recipe_id bigint NOT NULL,
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, recipe_id),
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_plan_recipes_user_id_added_at` on `(user_id, added_at DESC)` - for efficient sorted reads
- `idx_plan_recipes_recipe_id` on `(recipe_id)` - for join optimization

**RLS Policies:**
- Users can SELECT/INSERT/DELETE only their own plan items

**Triggers:**
- `enforce_plan_limit` - prevents adding more than 50 items (atomic, prevents race conditions)

## Architecture

Funkcja jest zorganizowana zgodnie z modularną architekturą projektu:

```
plan/
├── index.ts              # Main router, CORS, error handling
├── plan.handlers.ts      # HTTP handlers, validation, response formatting
├── plan.service.ts       # Business logic, database operations
├── plan.types.ts         # Zod schemas, TypeScript types
├── README.md             # This file
├── TESTING.md            # Testing guide with scenarios
└── test-requests.http    # REST Client test requests
```

### Responsibilities

**`index.ts`** (Router):
- CORS handling (OPTIONS)
- Routing to handlers
- Top-level error handling
- Request/response logging

**`plan.handlers.ts`** (Handlers):
- Authentication (`getAuthenticatedContext`)
- Request body parsing and validation (Zod)
- Calling service functions
- Response formatting (`201`, error responses)

**`plan.service.ts`** (Service):
- Recipe access verification (service role client for reads)
- Business logic enforcement (uniqueness, limit, visibility)
- Database operations (user context client for writes)
- Database error mapping to ApplicationError

## Security

1. **Authentication**: Required for all endpoints (JWT token)
2. **Authorization**: 
   - RLS policies enforce user ownership at database level
   - Application-level checks for recipe visibility
3. **Rate limiting**: Enforced by Supabase (default limits)
4. **Input validation**: Zod schema validation for all inputs
5. **SQL injection**: Prevented by using Supabase client (parameterized queries)

## Performance

- **Queries per request**: 2
  - 1× recipe read (access check, uses service role)
  - 1× plan_recipes insert (uses user context, RLS enforced)
- **Indexes**: Optimized for both writes and sorted reads
- **Atomicity**: Limit enforcement via database trigger (prevents race conditions)

## Testing

See [TESTING.md](./TESTING.md) for comprehensive test scenarios and examples.

Quick test:
```bash
# Start function
supabase functions serve plan

# Add recipe to plan
curl -X POST http://localhost:54331/functions/v1/plan/recipes \
  -H "Authorization: Bearer <YOUR_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"recipe_id": 1}'
```

## Future Endpoints (Not implemented yet)

- `GET /plan` - Get user's plan with recipe details
- `DELETE /plan/recipes/{id}` - Remove recipe from plan
- `DELETE /plan` - Clear entire plan
- `GET /plan/export` - Export plan as shopping list

## Related Resources

- Database migration: `supabase/migrations/20251230120000_create_plan_recipes_table.sql`
- Shared contracts: `shared/contracts/types.ts` (AddRecipeToPlanCommand, PlanListItemDto)
- Shared utilities: `supabase/functions/_shared/`

