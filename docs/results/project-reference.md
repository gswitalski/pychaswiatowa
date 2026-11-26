# PychaŚwiatowa — referencja wygenerowana z kodu

Wygenerowano: 2026-11-26 przez `.cursor/hooks/generate-reference.ps1`. Nie edytuj ręcznie.
Źródła: `shared/types/database.types.ts`, `supabase/functions`, `src/app/**/*.routes.ts`,
`src/app/core/guards`, `supabase/migrations`. Wzorce ścieżek Edge Functions są wyciągnięte
z kodu heurystycznie (orientacyjnie): szczegóły sprawdź w `*.handlers.ts`.

## Tabele (public) — kolumny


## Widoki (public)


## Funkcje RPC (public) — argumenty


## Enumy


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
- pliki: index.ts, recipes.handlers.ts, recipes.service.ts, recipes.variants.ts
- metody: DELETE, GET, POST, PUT
- wzorce ścieżek: `/(\.[a-z0-9]+)$/i` · `/\/recipes\/([^/]+)$/` · `/\/recipes\/([^/]+)\/collections\/?$/` · `/\/recipes\/([^/]+)\/default\/?$/` · `/\/recipes\/([^/]+)\/family\/?$/` · `/\/recipes\/([^/]+)\/flags\/?$/` · `/\/recipes\/([^/]+)\/image\/?$/` · `/\/recipes\/([^/]+)\/normalized-ingredients\/?$/` · `/\/recipes\/([^/]+)\/normalized-ingredients\/refresh\/?$/` · `/\/recipes\/([^/]+)\/note\/?$/` · `/\/recipes\/([^/]+)\/order\/?$/` · `/\/recipes\/([^/]+)\/rating\/?$/` · `/\/recipes\/([^/]+)\/usage\/?$/` · `/\/recipes\/([^/]+)\/variant-name\/?$/` · `/\/recipes\/([^/]+)\/variants\/([^/]+)\/?$/` · `/\/recipes\/([^/]+)\/variants\/?$/` · `/\/recipes\/([^/]+)\/variants\/ai\/?$/` · `/\/recipes\/feed\/?$/`

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
- `src/app/pages/recipes/recipes.routes.ts`: (root), new, start, assist, import, :id/edit/assist, :id/edit

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

## Migracje: 106 plików, ostatnie 5

- `20261121180000_ps111_grouped_recipes_list.sql`
- `20261123210000_ps112_recipe_variant_actions_integrations.sql`
- `20261124170000_ps115_full_variant_names.sql`
- `20261125200000_ps116_recipe_rls_variant_group_policies.sql`
- `20261126230000_ps118_ai_recipe_variant.sql`

