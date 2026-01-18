# Deployment Checklist: GET /recipes/{id}/normalized-ingredients

## 🔒 Security Verification

### Authentication & Authorization
- [x] JWT token required in Authorization header (401 if missing/invalid)
- [x] Only recipe owner can access normalized ingredients (enforced by RLS)
- [x] Anti-leak protection: Returns 404 for both "not found" and "access denied" cases
- [x] No distinction between non-existent and unauthorized recipes (prevents enumeration)

### Data Protection
- [x] Soft-delete respected (`deleted_at IS NULL` filter in query)
- [x] RLS policies active on both `recipes` and `recipe_normalized_ingredients` tables
- [x] No sensitive data logged (only IDs, counts, and status)
- [x] No full ingredient content logged (only `itemsCount` metric)

### Input Validation
- [x] Recipe ID validated as positive integer (400 for invalid format)
- [x] No SQL injection risk (parameterized queries via Supabase client)
- [x] JSONB parsing with error handling (catches malformed data)

## 📝 Response Format Verification

### Success Response (200 OK)
- [x] Always returns `recipe_id` as number
- [x] Always returns `status` as one of: 'PENDING', 'READY', 'FAILED'
- [x] Always returns `updated_at` as string (ISO 8601) or null
- [x] Always returns `items` as array (never undefined)
- [x] Items array is empty when status is not 'READY'
- [x] Each item has required fields: `amount`, `unit`, `name`
- [x] `amount` and `unit` can be null (for ambiguous ingredients)

### Error Responses
- [x] 400 Bad Request - Invalid recipe ID format
- [x] 401 Unauthorized - Missing or invalid JWT
- [x] 404 Not Found - Recipe not found/access denied/soft-deleted
- [x] 500 Internal Server Error - Database errors, data inconsistency

### HTTP Headers
- [x] Content-Type: application/json
- [x] CORS headers for OPTIONS requests

## 🎯 Business Logic Verification

### Status Handling
- [x] PENDING status → returns empty items array, updated_at = null
- [x] READY status → returns items from database, updated_at populated
- [x] FAILED status → returns empty items array, updated_at may be null or last success timestamp
- [x] Data consistency check: status=READY but no data in normalized table → throws 500

### Data Consistency
- [x] Two database queries maximum (one to recipes, one to recipe_normalized_ingredients)
- [x] Atomicity: queries use same authenticated client (consistent RLS context)
- [x] Items JSONB validated as array
- [x] Each item validated for required structure

## 📊 Performance

### Query Optimization
- [x] Minimal SELECT: only necessary columns from recipes table
- [x] Conditional query: normalized_ingredients table queried only when status=READY
- [x] Indexes present: PK on recipe_normalized_ingredients(recipe_id)
- [x] No N+1 queries

### Resource Usage
- [x] Single database connection per request
- [x] No expensive JOINs
- [x] JSONB parsing with reasonable limits (array of objects)

## 🧪 Testing Checklist

### Functional Tests (Manual)
- [ ] Test with status=READY and valid items
- [ ] Test with status=PENDING (empty items)
- [ ] Test with status=FAILED (empty items)
- [ ] Test without JWT (401)
- [ ] Test with invalid JWT (401)
- [ ] Test with invalid recipe ID format (400)
- [ ] Test with non-existent recipe ID (404)
- [ ] Test with soft-deleted recipe (404)
- [ ] Test with another user's recipe (404, no leak)

### Edge Cases
- [ ] Test with empty items array (status=READY but items=[])
- [ ] Test with null values in items (amount=null, unit=null)
- [ ] Test with all supported units (g, ml, szt., ząbek, łyżeczka, łyżka, szczypta, pęczek)
- [ ] Test with large items array (50+ ingredients)

### Integration Points
- [ ] Verify RLS policies allow service_role to write
- [ ] Verify trigger/worker can update status and items
- [ ] Verify consistency with AI endpoint (/ai/recipes/normalized-ingredients)

## 🗄️ Database Verification

### Schema
- [x] Column `recipes.normalized_ingredients_status` exists (text, CHECK constraint)
- [x] Column `recipes.normalized_ingredients_updated_at` exists (timestamptz, nullable)
- [x] Table `recipe_normalized_ingredients` exists
- [x] Columns: recipe_id (PK, FK), items (jsonb), updated_at (timestamptz)
- [x] Foreign key with ON DELETE CASCADE
- [x] Index on recipe_normalized_ingredients(recipe_id)

### RLS Policies
- [x] SELECT policy on recipe_normalized_ingredients for users (via recipes ownership)
- [x] ALL policy on recipe_normalized_ingredients for service_role
- [x] Policies reference soft-delete (deleted_at IS NULL)

### Migration
- [ ] Migration file created: 20260118120000_add_normalized_ingredients_to_recipes.sql
- [ ] Migration applied to local database
- [ ] Migration applied to staging (if exists)
- [ ] Migration ready for production

## 📚 Documentation

### Code Documentation
- [x] Service function has JSDoc with business rules
- [x] Handler function has JSDoc with access rules
- [x] Router updated with new endpoint in comments
- [x] Inline comments for complex logic (JSONB parsing)

### API Documentation
- [x] Endpoint documented in implementation plan
- [x] DTO types defined in shared/contracts/types.ts
- [x] Test requests file created with examples

### Type Safety
- [x] TypeScript types defined for all DTOs
- [x] Database types updated (recipes + recipe_normalized_ingredients)
- [x] No `any` types used
- [x] Strict null checks respected

## 🚀 Deployment Steps

### Pre-Deployment
1. [ ] Review all checklist items above
2. [ ] Run linter: `deno lint supabase/functions/recipes/`
3. [ ] Test locally with real database
4. [ ] Verify all test scenarios pass

### Database Migration
1. [ ] Backup production database
2. [ ] Apply migration: `supabase db push` or manual SQL execution
3. [ ] Verify new columns and table created
4. [ ] Verify RLS policies active

### Function Deployment
1. [ ] Deploy function: `supabase functions deploy recipes`
2. [ ] Verify deployment successful
3. [ ] Test with production credentials (non-destructive read-only tests)

### Post-Deployment
1. [ ] Monitor logs for errors
2. [ ] Verify response times acceptable (<500ms for typical case)
3. [ ] Test from frontend integration
4. [ ] Document any production issues

## 🐛 Known Limitations (MVP)

- Status transition from PENDING→READY is handled by external worker (not in this endpoint)
- No retry mechanism for FAILED status (manual refresh required)
- No caching (fetches from database on every request)
- No pagination for items (assumes reasonable number of ingredients per recipe)

## 📞 Rollback Plan

If critical issues occur in production:

1. **Immediate**: Comment out route in recipesRouter (deploy hotfix)
2. **Short-term**: Revert function deployment to previous version
3. **Database**: New columns/table are additive (safe to leave), but can be removed with:
   ```sql
   DROP TABLE IF EXISTS recipe_normalized_ingredients;
   ALTER TABLE recipes DROP COLUMN IF EXISTS normalized_ingredients_status;
   ALTER TABLE recipes DROP COLUMN IF EXISTS normalized_ingredients_updated_at;
   ```

## ✅ Final Sign-Off

- [ ] All security checks passed
- [ ] All functional tests passed
- [ ] Documentation complete
- [ ] Deployment plan reviewed
- [ ] Rollback plan understood
- [ ] **READY FOR DEPLOYMENT**

---

**Implementation completed:** 2026-01-18  
**Implemented by:** AI Assistant (Claude Sonnet 4.5)  
**Reviewed by:** _[To be filled by human reviewer]_
