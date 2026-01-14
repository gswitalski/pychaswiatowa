# Testing Guide: Tips Search Functionality

## Overview
This guide covers testing the new `tips` field integration in the Public Recipes API search functionality.

## Changes Summary
- Added `tips` field to `PublicRecipeDetailDto`
- Extended `SearchMatchSource` type to include `'tips'`
- Added relevance weight for tips: **0.5** (compared to: name=3, ingredients=2, tags=1)
- Updated search logic to match tokens in recipe tips

## Prerequisites

### 1. Start Local Supabase
```bash
supabase start
```

### 2. Ensure Database Has Test Data
You need at least one public recipe with tips to test the functionality:

```sql
-- Check if any recipes have tips
SELECT id, name, tips 
FROM recipes 
WHERE visibility = 'PUBLIC' 
  AND deleted_at IS NULL 
  AND jsonb_array_length(tips) > 0
LIMIT 5;
```

### 3. Create Test Recipe with Tips (if needed)
```sql
-- Create a test recipe with tips using RPC function
SELECT create_recipe_with_tags(
    p_user_id := (SELECT id FROM auth.users WHERE email = 'test@pychaswiatowa.pl'),
    p_name := 'Testowy przepis z poradami',
    p_description := 'Przepis do testowania wyszukiwania po tips',
    p_category_id := 1,
    p_ingredients_raw := 'Składnik 1
Składnik 2',
    p_steps_raw := 'Krok 1
Krok 2',
    p_tag_names := ARRAY['test', 'tips'],
    p_visibility := 'PUBLIC',
    p_tips_raw := '# Ważne porady
Pamiętaj o dobrym nagrzaniu patelni
Możesz użyć mrożonych warzyw zamiast świeżych'
);
```

## Test Scenarios

### Scenario 1: Get Recipe Details - Tips Field Included ✅

**Endpoint:** `GET /public/recipes/{id}`

**Expected Result:**
- Response includes `tips` field as `RecipeContent` array
- Empty tips returns `[]` (not null)
- Tips with content returns properly parsed array

**Test:**
```bash
curl -X GET "http://localhost:54321/functions/v1/public/recipes/1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

**Verification:**
```json
{
  "id": 1,
  "name": "...",
  "tips": [
    { "type": "header", "content": "Ważne porady" },
    { "type": "item", "content": "Pamiętaj o dobrym nagrzaniu patelni" },
    { "type": "item", "content": "Możesz użyć mrożonych warzyw zamiast świeżych" }
  ]
}
```

---

### Scenario 2: Search - Match in Tips Only ✅

**Endpoint:** `GET /public/recipes?q=porada`

**Setup:**
- Recipe must have "porada" in tips
- Recipe should NOT have "porada" in name, ingredients, or tags

**Expected Result:**
- Recipe appears in results
- `search.match` = `"tips"`
- `search.relevance_score` = `0.5` (if only tips match)

**Test:**
```bash
curl -X GET "http://localhost:54321/functions/v1/public/recipes?q=porada&limit=10" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

**Verification:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "...",
      "search": {
        "relevance_score": 0.5,
        "match": "tips"
      }
    }
  ]
}
```

---

### Scenario 3: Search - Multiple Field Match (Tips Included) ✅

**Endpoint:** `GET /public/recipes?q=mrożony`

**Setup:**
- Recipe has "mrożony" in both ingredients AND tips

**Expected Result:**
- Recipe appears in results
- `search.match` = `"ingredients"` (higher weight: 2 > 0.5)
- `search.relevance_score` = `2.5` (ingredients=2 + tips=0.5)

**Test:**
```bash
curl -X GET "http://localhost:54321/functions/v1/public/recipes?q=mrożony&limit=10" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

**Verification:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "...",
      "search": {
        "relevance_score": 2.5,
        "match": "ingredients"
      }
    }
  ]
}
```

---

### Scenario 4: Search - AND Semantics with Tips ✅

**Endpoint:** `GET /public/recipes?q=patelni warzywa`

**Setup:**
- Recipe has "patelni" in tips
- Recipe has "warzywa" in ingredients
- Both tokens must match (AND semantics)

**Expected Result:**
- Recipe appears in results
- All tokens must be found across any searchable fields

**Test:**
```bash
curl -X GET "http://localhost:54321/functions/v1/public/recipes?q=patelni%20warzywa&limit=10" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

---

### Scenario 5: Search - Relevance Sorting with Tips ✅

**Endpoint:** `GET /public/recipes?q=patelni`

**Setup:**
- Recipe A: "patelni" in name (weight=3)
- Recipe B: "patelni" in ingredients (weight=2)
- Recipe C: "patelni" in tips (weight=0.5)

**Expected Result:**
- Recipes sorted by relevance: A → B → C
- Recipe A has highest `relevance_score`

---

### Scenario 6: Cursor Pagination with Tips Search ✅

**Endpoint:** `GET /public/recipes/feed?q=porada&limit=5`

**Expected Result:**
- First page returns matching recipes
- `pageInfo.hasMore` indicates if more results exist
- `pageInfo.nextCursor` provided when `hasMore=true`
- Second page: `GET /public/recipes/feed?q=porada&limit=5&cursor={nextCursor}`

---

## Edge Cases to Test

### Empty Tips
- Recipe with `tips=[]` should still be searchable by other fields
- Recipe detail should return `tips: []` (not null)

### Tips-Only Match with Low Score
- Recipe matching only in tips should rank lower than matches in name/ingredients/tags
- Verify correct sorting when multiple recipes match

### Case Insensitivity
- Search for "PORADA" should match "porada" in tips (case-insensitive)

### Multiple Tokens
- All tokens must match (AND semantics)
- Test: `q=dobry nagrzać` should match recipe with both words in tips

### Special Characters in Tips
- Tips with special characters (ł, ą, ć, etc.) should be searchable
- Test Polish characters: `q=świeży`

---

## Regression Tests

Ensure existing functionality still works:

1. **Search without `q` parameter** - should return all public recipes
2. **Search with `q` in name only** - `match='name'`, score=3
3. **Search with `q` in ingredients only** - `match='ingredients'`, score=2
4. **Search with `q` in tags only** - `match='tags'`, score=1
5. **Invalid `q` (< 3 chars)** - should return 400 error
6. **No tips column in SELECT** - should not break (handled by `?? []`)

---

## Performance Considerations

### Large Tips Content
- Create recipe with very long tips (1000+ characters)
- Search should still complete in reasonable time
- No N+1 query issues

### Many Recipes with Tips
- Create 100+ recipes with tips
- Search performance should be acceptable
- Pagination should work correctly

---

## Checklist

- [ ] GET /public/recipes/{id} returns `tips` field
- [ ] GET /public/recipes/{id} returns `tips: []` when empty
- [ ] Search query matches tokens in tips
- [ ] Search with tips-only match returns `match='tips'`
- [ ] Search with tips-only match returns `relevance_score=0.5`
- [ ] Search with multiple field match adds tips weight correctly
- [ ] Search respects AND semantics (all tokens must match)
- [ ] Search sorts by relevance correctly (tips has lowest weight)
- [ ] Cursor pagination works with tips search
- [ ] Empty tips doesn't break search
- [ ] Case-insensitive matching works for tips
- [ ] Polish characters (ł, ą, ć, etc.) work in tips search
- [ ] No regression in existing search functionality

---

## SQL Queries for Debugging

### Check Recipe Tips Content
```sql
SELECT 
    id, 
    name, 
    tips,
    jsonb_array_length(tips) as tips_count
FROM recipes 
WHERE visibility = 'PUBLIC' 
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 10;
```

### Find Recipes with Specific Word in Tips
```sql
SELECT 
    id, 
    name,
    tips::text
FROM recipes
WHERE visibility = 'PUBLIC'
  AND deleted_at IS NULL
  AND lower(tips::text) LIKE '%porada%'
LIMIT 10;
```

### Check Search Vector (if using DB-level search)
```sql
SELECT 
    id,
    name,
    search_vector
FROM recipes
WHERE visibility = 'PUBLIC'
  AND deleted_at IS NULL
  AND search_vector @@ to_tsquery('polish', 'porada')
LIMIT 10;
```

---

## Expected Console Logs

When running tests, you should see logs like:

```
[INFO] Fetching public recipes { page: 1, hasSearch: true, tokenCount: 1, isAuthenticated: false }
[INFO] Filtered recipes by search relevance { beforeFilter: 50, afterFilter: 3, tokens: ['porada'] }
[INFO] Public recipes list built successfully { count: 3, totalItems: 3, currentPage: 1 }
```

---

## Troubleshooting

### Tips not appearing in response
- Check if `RECIPE_DETAIL_SELECT_COLUMNS` includes `tips`
- Verify migration `20260112120100_update_recipe_details_view_for_tips.sql` was applied

### Search not matching tips
- Check if `extractTipsText()` is called in `calculateRelevance()`
- Verify `RELEVANCE_WEIGHTS.tips = 0.5` is set
- Check if `textContainsAllTokens()` is working correctly

### Wrong `match` value returned
- Check weight comparison in `calculateRelevance()`
- Higher weight should always win: name(3) > ingredients(2) > tags(1) > tips(0.5)

### Relevance score incorrect
- Check if all matching fields add their weights to `totalScore`
- Verify tips matching adds exactly 0.5 to the score
