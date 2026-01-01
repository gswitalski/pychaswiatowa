# Database Seeds

This directory contains SQL seed files that populate the database with sample data for development and testing.

## Seed Files

Seeds are executed in alphabetical/numerical order during `supabase db reset`:

1. **`00_seed_dictionaries.sql`** - System dictionaries (categories)
2. **`01_seed_users.sql`** - Test users with credentials
3. **`02_seed_recipes.sql`** - Sample recipes for test users
4. **`03_seed_collections.sql`** - Sample collections with recipes
5. **`04_seed_plan_recipes.sql`** - Sample "My Plan" items for test user

## Seed Details

### 04_seed_plan_recipes.sql (NEW)

**Purpose**: Seeds the "My Plan" feature with sample recipes for the test user.

**User**: test@pychaswiatowa.pl (ID: `c553b8d1-3dbb-488f-b610-97eb6f95d357`)

**Recipes Added**: ~7-10 recipes including:
- **Bigos** (PUBLIC, Danie główne)
- **Szarlotka** (SHARED, Deser)
- **Pierogi ruskie** (SHARED, Danie główne)
- **Kotlet schabowy** (SHARED, Danie główne)
- **Sernik na zimno** (PRIVATE, Deser)
- **Jajecznica** (PUBLIC, Śniadanie)
- **Kurczak curry** (SHARED, Danie główne)
- **Gołąbki** (PUBLIC, Danie główne) - if exists
- **Rosół** (PRIVATE, Zupa) - if exists

**Mix**:
- 3 PUBLIC recipes (accessible to all)
- 4 SHARED recipes (accessible to owner and shared users)
- 2 PRIVATE recipes (accessible only to owner)
- Various categories: Danie główne, Deser, Śniadanie, Zupa

**Features**:
- Idempotent: Can be run multiple times safely (uses `ON CONFLICT DO NOTHING`)
- Clears existing plan before inserting
- Only inserts recipes that exist in the database
- Validates user and table existence before running

## How to Use

### Apply All Seeds

```bash
supabase db reset
```

This will:
1. Recreate the database
2. Apply all migrations
3. Run all seed files in order

### Apply Single Seed Manually

```bash
# Method 1: Via Docker
Get-Content "supabase/seeds/04_seed_plan_recipes.sql" | docker exec -i supabase_db_pychaswiatowa psql -U postgres

# Method 2: Via psql (if connected)
psql -U postgres -f supabase/seeds/04_seed_plan_recipes.sql
```

### Verify Seed Results

```sql
-- Check plan items count
SELECT COUNT(*) FROM plan_recipes WHERE user_id = 'c553b8d1-3dbb-488f-b610-97eb6f95d357';

-- View plan with recipe details
SELECT 
    pr.recipe_id,
    r.name,
    r.visibility,
    c.name as category,
    pr.added_at
FROM plan_recipes pr
JOIN recipes r ON r.id = pr.recipe_id
LEFT JOIN categories c ON c.id = r.category_id
WHERE pr.user_id = 'c553b8d1-3dbb-488f-b610-97eb6f95d357'
ORDER BY pr.added_at;
```

## Test User Credentials

### test@pychaswiatowa.pl
- **Email**: test@pychaswiatowa.pl
- **User ID**: c553b8d1-3dbb-488f-b610-97eb6f95d357
- **Username**: Grzegorz
- **Recipes**: ~50+ recipes (various visibility levels)
- **Collections**: ~4 collections
- **Plan**: ~7-10 recipes (after seed)

### test2@pychaswiatowa.pl
- **Email**: test2@pychaswiatowa.pl
- **User ID**: 6e2596af-e62a-4be6-93fc-680f8b83dc06
- **Username**: Test2
- **Recipes**: ~10 recipes
- **Collections**: None
- **Plan**: Empty (not seeded)

## Adding New Seeds

To add a new seed file:

1. Create file with numeric prefix: `05_seed_<name>.sql`
2. Add validation checks (user exists, table exists, etc.)
3. Make it idempotent (use `ON CONFLICT`, `IF NOT EXISTS`, or clear before insert)
4. Add NOTICE/RAISE messages for feedback
5. Update this README with details

## Notes

- Seeds run after migrations
- Seeds should be idempotent for `supabase db reset`
- Use `ON CONFLICT DO NOTHING` for unique constraints
- Always validate prerequisites (users, tables, etc.)
- Log success/failure with NOTICE/RAISE statements

