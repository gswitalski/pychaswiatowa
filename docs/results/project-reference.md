# PychaŚwiatowa — referencja wygenerowana z kodu

Wygenerowano: 2026-11-13 przez `.cursor/hooks/generate-reference.ps1`. Nie edytuj ręcznie.
Źródła: `shared/types/database.types.ts`, `supabase/functions`, `src/app/**/*.routes.ts`,
`src/app/core/guards`, `supabase/migrations`. Wzorce ścieżek Edge Functions są wyciągnięte
z kodu heurystycznie (orientacyjnie): szczegóły sprawdź w `*.handlers.ts`.

## Tabele (public) — kolumny

- `ai_rate_limits`: count, created_at, key, updated_at, user_id, window_start
- `categories`: created_at, id, name
- `collections`: created_at, description, id, name, updated_at, user_id
- `normalized_ingredients_jobs`: attempts, created_at, id, last_error, next_run_at, recipe_id, status, updated_at, user_id
- `plan_recipes`: added_at, recipe_id, user_id
- `profiles`: created_at, id, marketing_consent, marketing_consent_text_version, marketing_consent_updated_at, updated_at, username
- `recipe_collections`: collection_id, recipe_id
- `recipe_normalized_ingredients`: items, recipe_id, updated_at
- `recipe_ratings`: created_at, rating, recipe_id, updated_at, user_id
- `recipe_tags`: recipe_id, tag_id
- `recipes`: category_id, created_at, cuisine, deleted_at, description, diet_type, difficulty, id, image_path, ingredients, is_grill, is_termorobot, name, normalized_ingredients_status, normalized_ingredients_updated_at, prep_time_minutes, search_vector, servings, steps, tips, total_time_minutes, updated_at, user_id, visibility
- `shopping_list_items`: amount, created_at, id, is_owned, kind, name, recipe_id, recipe_name, text, unit, updated_at, user_id
- `shopping_list_recipe_contributions`: amount, created_at, id, name, recipe_id, unit, user_id
- `tags`: created_at, id, name, user_id
- `user_ai_credits`: created_at, credits_activated_at, draft_credits_total, draft_credits_used, id, image_credits_total, image_credits_used, limit_type, next_reset_at, updated_at, user_id
- `user_recipe_flags`: created_at, is_favorite, is_want_to_try, recipe_id, updated_at, user_id
- `user_recipe_notes`: created_at, note, recipe_id, updated_at, user_id

## Widoki (public)

- `recipe_details`: category_id, category_name, average_rating, collection_ids, collections, created_at, cuisine, deleted_at, description, diet_type, difficulty, id, image_path, ingredients, is_grill, is_termorobot, name, normalized_ingredients_status, normalized_ingredients_updated_at, prep_time_minutes, ratings_count, search_vector, servings, steps, tag_ids, tags, tips, total_time_minutes, updated_at, user_id, visibility

## Funkcje RPC (public) — argumenty

- `add_recipe_to_plan_and_update_shopping_list()`
- `admin_get_recipes_page(p_author, p_category_ids, p_created_from, p_created_to, p_include_uncategorized, p_is_grill, p_is_termorobot, p_name, p_page_number, p_page_size, p_rating_max, p_rating_min, p_ratings_count_max, p_ratings_count_min, p_recipe_id, p_sort_by, p_sort_dir)`
- `admin_get_users_page(p_page_number, p_page_size, p_sort_by, p_sort_dir)`
- `admin_update_user_role(p_actor_user_id, p_new_role, p_target_user_id)`
- `ai_rate_limit_hit(p_key, p_limit, p_now, p_window_seconds)`
- `claim_normalized_ingredients_jobs()`
- `enqueue_normalized_ingredients_refresh()`
- `get_recipes_list(p_category_id, p_cuisine, p_diet_type, p_difficulty, p_grill, p_limit, p_page, p_search, p_sort_direction, p_sort_field, p_tag_ids, p_termorobot, p_user_id, p_view)`
- `remove_recipe_from_plan_and_update_shopping_list()`
- `resolve_signup_marketing_consent()`
- `set_recipe_flags(p_is_favorite, p_is_want_to_try, p_recipe_id)`
- `set_recipe_note(p_note, p_recipe_id)`
- `set_recipe_rating(p_rating, p_recipe_id)`
- `supported_marketing_consent_text_versions()`

## Enumy

- `ai_credit_limit_type`: lifetime, monthly
- `recipe_cuisine`: POLISH, ASIAN, MEXICAN, MIDDLE_EASTERN, AFRICAN, AMERICAN, BALKAN, BRAZILIAN, BRITISH, CARIBBEAN, CHINESE, FRENCH, GERMAN, GREEK, INDIAN, ITALIAN, JAPANESE, KOREAN, MEDITERRANEAN, RUSSIAN, SCANDINAVIAN, SPANISH, THAI, TURKISH, VIETNAMESE
- `recipe_diet_type`: MEAT, VEGETARIAN, VEGAN
- `recipe_difficulty`: EASY, MEDIUM, HARD
- `recipe_visibility`: PRIVATE, SHARED, PUBLIC

## Edge Functions

Ścieżka: `/functions/v1/{funkcja}`. Metody i wzorce wyciągnięte z kodu handlerów i `index.ts`.

### admin
- pliki: admin.handlers.ts, admin.service.ts, admin.types.ts, admin-ai-credits.handlers.ts, admin-ai-credits.service.ts, admin-auth.ts, admin-recipes.filters.ts, admin-recipes.handlers.ts, admin-recipes.rpc-guard.ts, admin-recipes.service.ts, admin-recipes.types.ts, index.ts
- metody: GET, PATCH
- wzorce ścieżek: `/\/admin(\/.*)?$/` · `/^\/users\/([^/]+)\/ai-credits$/` · `/^\/users\/([^/]+)\/role$/` · `'/health'` · `'/recipes'` · `'/summary'` · `'/users'`

### ai
- pliki: ai.handlers.ts, ai.service.ts, ai.types.ts, ai-credits.handlers.ts, ai-credits.service.ts, ai-draft-images.ts, ai-draft-metadata.ts, index.ts
- metody: GET, POST
- wzorce ścieżek: `'/credits'` · `'/credits/'` · `'/recipes/draft'` · `'/recipes/draft/'` · `'/recipes/image'` · `'/recipes/image/'` · `'/recipes/normalized-ingredients'` · `'/recipes/normalized-ingredients/'`

### billing
- pliki: billing.handlers.ts, billing.service.ts, billing.types.ts, index.ts
- metody: n/d
- wzorce ścieżek: `/^\/billing(.*)$/`

### categories
- pliki: categories.handlers.ts, categories.service.ts, index.ts
- metody: n/d

### checkout
- pliki: checkout.handlers.ts, checkout.service.ts, checkout.types.ts, index.ts
- metody: n/d
- wzorce ścieżek: `/^\/checkout(.*)$/` · `'/sessions'`

### collections
- pliki: collections.handlers.ts, collections.service.ts, collections.types.ts, index.ts
- metody: DELETE, GET, POST
- wzorce ścieżek: `'/'` · `/^\/(\d+)$/` · `/^\/(\d+)\/recipes$/` · `/^\/(\d+)\/recipes\/(\d+)$/`

### explore
- pliki: explore.handlers.ts, explore.service.ts, explore.types.ts, index.ts
- metody: GET
- wzorce ścieżek: `/\/explore(\/.*)?$/` · `/^\/recipes\/([^/]+)$/` · `'/recipes'`

### internal
- pliki: ai-credits-monthly-reset.handlers.ts, ai-credits-monthly-reset.service.ts, billing-expire-subscriptions.handlers.ts, billing-expire-subscriptions.service.ts, index.ts, internal.handlers.ts, normalized-ingredients-worker.service.ts
- metody: POST
- wzorce ścieżek: `/^\/internal\/ai-credits\/monthly-reset\/?$/` · `/^\/internal\/billing\/expire-subscriptions\/?$/` · `/^\/internal\/workers\/normalized-ingredients\/run\/?$/`

### me
- pliki: index.ts, me.handlers.ts, me.service.ts
- metody: n/d

### payments-webhook
- pliki: index.ts, payments-webhook.handlers.ts, payments-webhook.service.ts, payments-webhook.types.ts, stripe-mappers.ts
- metody: n/d

### plan
- pliki: index.ts, plan.handlers.ts, plan.service.ts, plan.types.ts
- metody: DELETE, GET, POST
- wzorce ścieżek: `'/'` · `/^\/plan(.*)$/` · `/^\/recipes\/([^/]+)$/` · `'/recipes'`

### profile
- pliki: index.ts, profile.handlers.ts, profile.service.ts, profile.types.ts
- metody: GET, POST
- wzorce ścieżek: `'/'` · `/\/profile(\/.*)?$/` · `'/change-password'` · `'/username-available'`

### public
- pliki: index.ts, public.handlers.ts, public.service.ts, public.types.ts
- metody: GET
- wzorce ścieżek: `/\/public(\/.*)?$/` · `/^\/recipes\/([^/]+)$/` · `'/recipes'` · `'/recipes/feed'`

### recipes
- pliki: index.ts, recipes.handlers.ts, recipes.service.ts
- metody: DELETE, GET, POST, PUT
- wzorce ścieżek: `/\/recipes\/([^/]+)$/` · `/\/recipes\/([^/]+)\/collections\/?$/` · `/\/recipes\/([^/]+)\/flags\/?$/` · `/\/recipes\/([^/]+)\/image\/?$/` · `/\/recipes\/([^/]+)\/normalized-ingredients\/?$/` · `/\/recipes\/([^/]+)\/normalized-ingredients\/refresh\/?$/` · `/\/recipes\/([^/]+)\/note\/?$/` · `/\/recipes\/([^/]+)\/rating\/?$/` · `/\/recipes\/feed\/?$/`

### search
- pliki: index.ts, search.handlers.ts, search.service.ts, search.types.ts
- metody: GET
- wzorce ścieżek: `'/global'` · `'/global/'`

### shopping-list
- pliki: index.ts, shopping-list.handlers.ts, shopping-list.service.ts
- metody: DELETE, GET, PATCH, POST
- wzorce ścieżek: `'/'` · `/^\/items\/([^/]+)$/` · `/^\/shopping-list(.*)$/` · `'/items'` · `'/recipe-items/group'`

### tags
- pliki: index.ts, tags.handlers.ts, tags.service.ts
- metody: n/d

### utils
- pliki: index.ts, utils.handlers.ts, utils.service.ts, utils.types.ts
- metody: POST
- wzorce ścieżek: `'/utils/slugify'` · `'/utils/slugify/'`

## Trasy frontendu (`path` z plików `*.routes.ts`, bez zagnieżdżenia)

- `src/app/app.routes.ts`: (root), explore, pricing, checkout/success, checkout/cancel, checkout, legal/subscription, legal/terms, legal/privacy, legal/publisher, dashboard, my-recipies, my-recipes, recipes, collections, shopping, admin, settings, register, register/verify-sent, login, auth/callback, auth/complete-profile, email-confirmed, email-confirmation-invalid, forbidden, admin/dashboard, admin/users, admin/recipes, recipes/:id
- `src/app/pages/admin/admin.routes.ts`: (root), dashboard, users, recipes
- `src/app/pages/collections/collections.routes.ts`: (root), :id
- `src/app/pages/recipes/recipes.routes.ts`: (root), new, start, assist, import, :id/edit

## Guardy (`src/app/core/guards`)

- `admin-role-match.guard`
- `auth.guard`
- `authenticated-match.guard`
- `checkout-access.guard`
- `guest-only-match.guard`
- `oauth-complete-profile.guard`
- `premium-role-match.guard`
- `unsaved-changes.guard`
- `username-complete-match.guard`

## Strony (`src/app/pages`): admin, auth, checkout, collections, dashboard, explore, forbidden, landing, legal, login, pricing, recipes, register, settings, shopping

## Migracje: 92 plików, ostatnie 5

- `20261010120000_create_user_recipe_flags.sql`
- `20261027120000_create_recipe_ratings.sql`
- `20261109120000_create_user_recipe_notes.sql`
- `20261111120000_create_admin_get_recipes_page_rpc.sql`
- `20261113130000_extend_admin_recipes_filters.sql`

