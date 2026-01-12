# REST API Plan

This document outlines the REST API for the PychaŚwiatowa application, based on the database schema and product requirements. The API is designed to be consumed by an Angular frontend and is built upon the Supabase BaaS platform.

## 1. Resources

The API exposes the following primary resources:

-   **Recipes**: Corresponds to the `recipes` table. Represents a user's culinary recipe.
-   **Public Recipes**: Read-only access to recipes for public routes. For anonymous users: only recipes with `visibility = 'PUBLIC'`. For authenticated users: may also include the user's own recipes with non-public `visibility` (e.g., `PRIVATE`, `SHARED`) as long as `is_owner = true`.
-   **Categories**: Corresponds to the `categories` table. Represents a predefined recipe category.
-   **Tags**: Corresponds to the `tags` table. Represents user-defined tags for recipes.
-   **Collections**: Corresponds to the `collections` table. Represents user-created collections of recipes.
-   **My Plan ("Mój plan")**: A per-user, persistent list of recipes the user wants to keep as a short-term plan. The list is unique (no duplicates) and limited to **50** recipes.
-   **Auth (Supabase Auth)**: Email/password signup & login, email verification, session management. This is provided by Supabase and consumed via the `supabase-js` client in the Angular app (no custom backend endpoints required for MVP).
-   **AI Recipe Draft (Supabase Edge Function)**: Generates a structured "recipe draft" from either pasted text or a pasted image (OCR + LLM), to prefill the recipe form. The draft is returned to the client and is **not persisted** until the user explicitly saves the recipe via the standard `POST /recipes`.

## 2. Endpoints

Private endpoints are protected and require a valid JWT from Supabase Auth.
Public endpoints are available without authentication:
- For **anonymous** users, they must return **only** recipes with `visibility = 'PUBLIC'` (and `deleted_at IS NULL`).
- For **authenticated** users, they may additionally include **the user's own** recipes with non-public `visibility` (e.g., `PRIVATE`, `SHARED`) but must never expose non-public recipes of other users.

---

### Authentication (Supabase Auth)

> Notes:
> - These endpoints are provided by Supabase Auth. In the Angular app we should prefer calling them via `supabase-js` to avoid dealing with low-level token/session details.
> - Email verification is handled by Supabase. The project must be configured so that a newly created user must confirm their email before they can sign in.
> - The frontend must expose a callback route used as `emailRedirectTo`, e.g. `/auth/callback`.
> - **Application roles (RBAC – preparation):** the access token JWT MUST include a custom claim with the user's **application role** (recommended claim name: `app_role`) with allowed values: `user | premium | admin`.
>   - The claim name `app_role` is intentionally chosen to avoid confusion with Supabase/PostgREST's built-in `role` claim (e.g., `authenticated`).
>   - The role is set server-side (default `user` on signup). The client MUST NOT be able to set or change the role.
>   - In the MVP, the role is primarily used by the frontend to prepare for feature gating. Future endpoints may enforce RBAC using this claim.

#### `POST /auth/signup` (Supabase Auth)

-   **Description**: Register a new user. Supabase sends a verification email to the provided address. The response session is typically `null` when email confirmations are enabled.
-   **Request Payload**:
    ```json
    {
      "email": "user@example.com",
      "password": "********",
      "data": {
        "username": "jan.kowalski"
      },
      "emailRedirectTo": "https://app.example.com/auth/callback"
    }
    ```
-   **Role behavior (server-side)**:
    - A newly created user is assigned the default application role: `user`.
    - The client must not send `app_role` as part of the signup payload.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload** (example):
        ```json
        {
          "user": {
            "id": "uuid",
            "email": "user@example.com"
          },
          "session": null,
          "message": "Verification email sent"
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request` (validation failed, weak password, email already exists)

---

#### `POST /auth/login` (Supabase Auth)

-   **Description**: Sign in with email/password.
-   **Request Payload**:
    ```json
    {
      "email": "user@example.com",
      "password": "********"
    }
    ```
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**: `{ "session": { "access_token": "...", "refresh_token": "..." }, "user": { "id": "uuid" } }`
    -   **JWT requirements**:
        - The `access_token` JWT MUST include `app_role` claim (`user | premium | admin`).
-   **Error Response**:
    -   **Code**: `400 Bad Request` - If email is not confirmed yet (the frontend should map this to: "Confirm your email" + "Resend link").
    -   **Code**: `401 Unauthorized` - Wrong credentials.

---

#### `POST /auth/resend` (Supabase Auth)

-   **Description**: Resend a verification email for a signup that has not been confirmed yet.
-   **Request Payload**:
    ```json
    {
      "type": "signup",
      "email": "user@example.com",
      "emailRedirectTo": "https://app.example.com/auth/callback"
    }
    ```
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**: `{ "message": "Verification email resent" }`
-   **Error Response**:
    -   **Code**: `429 Too Many Requests` (rate limit)

---

#### `GET /auth/callback` (Frontend route)

-   **Description**: SPA callback route used after clicking the verification link. The route receives authorization data (e.g., `code`) from Supabase and the client finalizes the flow (e.g., exchange code for a session).
-   **Query Parameters**:
    -   `code` (optional, string): PKCE authorization code returned by Supabase.
-   **Success Response**:
    -   **Outcome**: Redirect to `/email-confirmed`.
-   **Error Response**:
    -   **Outcome**: Redirect to `/email-confirmation-invalid` and allow resending verification email.

---

### Public Recipes

#### `GET /public/recipes`

-   **Description**: Retrieve a paginated list of recipes for public routes. For anonymous users, the list contains only public recipes. For authenticated users, the list may also include their own recipes with non-public visibility.
-   **Notes**:
    - Public access is allowed without authentication, but the client MAY include an `Authorization: Bearer <JWT>` header.
    - If the request is authenticated, the API returns the helper fields `is_owner` and `in_my_plan` and MAY include the user's own recipes with `visibility != 'PUBLIC'` (only when `is_owner = true`).
-   **Query Parameters**:
    -   `page` (optional, integer, default: 1): The page number for pagination.
    -   `limit` (optional, integer, default: 20): The number of items per page.
    -   `sort` (optional, string, default: `created_at.desc`): Sort order. e.g., `created_at.desc`, `name.asc`.
    -   `q` (optional, string): Text search query (min 3 characters, after trim). Searches across name, ingredients, tags, and tips.
        - Token semantics (MVP): multi-word queries are treated as **AND**.
        - Tag matching (MVP): exact match or prefix match.
    -   `filter[termorobot]` (optional, boolean): Filter by the "Termorobot" flag (`true` / `false`). (API-ready; UI may not expose it in MVP.)
    -   `filter[grill]` (optional, boolean): Filter by the "Grill" flag (`true` / `false`). (API-ready; UI may not expose it in MVP.)
    -   `filter[diet_type]` (optional, string): Filter by diet type: `MEAT` | `VEGETARIAN` | `VEGAN`. (API-ready; UI may not expose it in MVP.)
    -   `filter[cuisine]` (optional, string): Filter by cuisine: `AFRICAN` | `AMERICAN` | `ASIAN` | `BALKAN` | `BRAZILIAN` | `BRITISH` | `CARIBBEAN` | `CHINESE` | `FRENCH` | `GERMAN` | `GREEK` | `INDIAN` | `ITALIAN` | `JAPANESE` | `KOREAN` | `MEDITERRANEAN` | `MEXICAN` | `MIDDLE_EASTERN` | `POLISH` | `RUSSIAN` | `SCANDINAVIAN` | `SPANISH` | `THAI` | `TURKISH` | `VIETNAMESE`. (API-ready; UI may not expose it in MVP.)
    -   `filter[difficulty]` (optional, string): Filter by difficulty: `EASY` | `MEDIUM` | `HARD`. (API-ready; UI may not expose it in MVP.)
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "data": [
            {
              "id": 1,
              "name": "Apple Pie",
              "description": "A classic dessert.",
              "servings": 6,
              "prep_time_minutes": 30,
              "total_time_minutes": 90,
              "is_termorobot": false,
              "is_grill": false,
              "diet_type": "VEGETARIAN",
              "cuisine": "POLISH",
              "difficulty": "EASY",
              "image_path": "path/to/image.jpg",
              "visibility": "PUBLIC",
              "is_owner": false,
              "in_my_plan": false,
              "search": {
                "relevance_score": 7,
                "match": "name"
              },
              "category": { "id": 2, "name": "Dessert" },
              "tags": ["sweet", "baking"],
              "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
              "created_at": "2023-10-27T10:00:00Z"
            },
            {
              "id": 2,
              "name": "My Private Soup",
              "description": null,
              "servings": 2,
              "prep_time_minutes": 0,
              "total_time_minutes": 0,
              "is_termorobot": false,
              "is_grill": false,
              "diet_type": null,
              "cuisine": null,
              "difficulty": null,
              "image_path": null,
              "visibility": "PRIVATE",
              "is_owner": true,
              "in_my_plan": true,
              "search": null,
              "category": { "id": 1, "name": "Dinner" },
              "tags": [],
              "author": { "id": "me-uuid-...", "username": "me" },
              "created_at": "2023-10-28T10:00:00Z"
            }
          ],
          "pagination": {
            "currentPage": 1,
            "totalPages": 5,
            "totalItems": 100
          }
        }
        ```
-   **Sorting / relevance behavior (MVP)**:
    - If `q` is provided and valid (min 3 chars), the default sort becomes **best match (relevance)**:
        - priority / weights: `name` (3) > `ingredients` (2) > `tags` (1) > `tips` (0.5)
        - ties are resolved with a stable secondary sort (recommended: `created_at.desc`)
    - If `q` is empty/omitted (or shorter than 3 after trim), treat the request as a feed and use the default `sort` (by default `created_at.desc`).
-   **Error Response**:
    -   **Code**: `400 Bad Request` (if `q` is provided and too short)
    -   **Payload**: `{ "message": "Query must be at least 3 characters" }`

---

#### `GET /public/recipes/feed`

-   **Description**: Retrieve a "load more" friendly list of recipes for public routes using cursor-based pagination (recommended for the `/explore` UI). For anonymous users, the list contains only public recipes. For authenticated users, the list may also include their own recipes with non-public visibility.
-   **Notes**:
    - Public access is allowed without authentication, but the client MAY include an `Authorization: Bearer <JWT>` header.
    - If the request is authenticated, the API returns the helper fields `is_owner` and `in_my_plan` and MAY include the user's own recipes with `visibility != 'PUBLIC'` (only when `is_owner = true`).
-   **Query Parameters**:
    -   `cursor` (optional, string): Opaque cursor returned by the previous response (`pageInfo.nextCursor`).
    -   `limit` (optional, integer, default: 12): The number of items to return per batch. (UI uses 12 as the default batch size.)
    -   `sort` (optional, string, default: `created_at.desc`): Sort order. Must be stable. e.g., `created_at.desc`, `name.asc`.
    -   `q` (optional, string): Text search query (min 3 characters, after trim). Searches across name, ingredients, tags, and tips.
        - Token semantics (MVP): multi-word queries are treated as **AND**.
        - Tag matching (MVP): exact match or prefix match.
    -   `filter[termorobot]` (optional, boolean): Filter by the "Termorobot" flag (`true` / `false`). (API-ready; UI may not expose it in MVP.)
    -   `filter[grill]` (optional, boolean): Filter by the "Grill" flag (`true` / `false`). (API-ready; UI may not expose it in MVP.)
    -   `filter[diet_type]` (optional, string): Filter by diet type: `MEAT` | `VEGETARIAN` | `VEGAN`. (API-ready; UI may not expose it in MVP.)
    -   `filter[cuisine]` (optional, string): Filter by cuisine: `AFRICAN` | `AMERICAN` | `ASIAN` | `BALKAN` | `BRAZILIAN` | `BRITISH` | `CARIBBEAN` | `CHINESE` | `FRENCH` | `GERMAN` | `GREEK` | `INDIAN` | `ITALIAN` | `JAPANESE` | `KOREAN` | `MEDITERRANEAN` | `MEXICAN` | `MIDDLE_EASTERN` | `POLISH` | `RUSSIAN` | `SCANDINAVIAN` | `SPANISH` | `THAI` | `TURKISH` | `VIETNAMESE`. (API-ready; UI may not expose it in MVP.)
    -   `filter[difficulty]` (optional, string): Filter by difficulty: `EASY` | `MEDIUM` | `HARD`. (API-ready; UI may not expose it in MVP.)
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "data": [
            {
              "id": 1,
              "name": "Apple Pie",
              "description": "A classic dessert.",
              "servings": 6,
              "prep_time_minutes": 30,
              "total_time_minutes": 90,
              "is_termorobot": false,
              "is_grill": false,
              "diet_type": "VEGETARIAN",
              "cuisine": "POLISH",
              "difficulty": "EASY",
              "image_path": "path/to/image.jpg",
              "visibility": "PUBLIC",
              "is_owner": false,
              "in_my_plan": false,
              "search": {
                "relevance_score": 7,
                "match": "name"
              },
              "category": { "id": 2, "name": "Dessert" },
              "tags": ["sweet", "baking"],
              "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
              "created_at": "2023-10-27T10:00:00Z"
            },
            {
              "id": 2,
              "name": "My Shared Cake",
              "description": null,
              "servings": 8,
              "prep_time_minutes": 0,
              "total_time_minutes": 0,
              "is_termorobot": false,
              "is_grill": false,
              "diet_type": null,
              "cuisine": null,
              "difficulty": null,
              "image_path": null,
              "visibility": "SHARED",
              "is_owner": true,
              "in_my_plan": true,
              "search": null,
              "category": { "id": 2, "name": "Dessert" },
              "tags": [],
              "author": { "id": "me-uuid-...", "username": "me" },
              "created_at": "2023-10-28T10:00:00Z"
            }
          ],
          "pageInfo": {
            "hasMore": true,
            "nextCursor": "opaque_cursor_value"
          }
        }
        ```
-   **Sorting / relevance behavior (MVP)**:
    - If `q` is provided and valid (min 3 chars), the default sort becomes **best match (relevance)**:
        - priority / weights: `name` (3) > `ingredients` (2) > `tags` (1) > `tips` (0.5)
        - ties are resolved with a stable secondary sort (recommended: `created_at.desc`)
    - If `q` is empty/omitted (or shorter than 3 after trim), treat the request as a feed and use the default `sort` (by default `created_at.desc`).
-   **Error Response**:
    -   **Code**: `400 Bad Request` (invalid cursor, `q` too short)
    -   **Payload**: `{ "message": "Query must be at least 3 characters" }`

---

#### `GET /public/recipes/{id}`

-   **Description**: Retrieve a single public recipe by its ID. Intended for public, shareable, SEO-friendly recipe pages (the frontend uses canonical routes like `/explore/recipes/{id}-{slug}`, but the API uses the numeric `id`).
-   **Notes**:
    - Public access is allowed without authentication, but the client MAY include an `Authorization: Bearer <JWT>` header.
    - If the request is authenticated, the API returns the helper fields `is_owner`, `in_my_plan`, and `collection_ids`.
    - **Canonical URL (frontend concern)**:
        - Canonical public route: `/explore/recipes/{id}-{slug}`
        - Backward-compatible route: `/explore/recipes/{id}` (should be normalized/redirected to the canonical URL)
        - If the URL contains an incorrect slug (e.g., after a recipe rename), the frontend SHOULD normalize it to the current canonical slug.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "id": 1,
          "name": "Apple Pie",
          "description": "A classic dessert.",
          "servings": 6,
          "prep_time_minutes": 30,
          "total_time_minutes": 90,
          "is_termorobot": false,
          "is_grill": false,
          "diet_type": "VEGETARIAN",
          "cuisine": "POLISH",
          "difficulty": "EASY",
          "image_path": "path/to/image.jpg",
          "visibility": "PUBLIC",
          "is_owner": false,
          "in_my_plan": false,
          "collection_ids": [],
          "category": { "id": 2, "name": "Dessert" },
          "ingredients": [
            { "type": "header", "content": "Dough" },
            { "type": "item", "content": "500g flour" }
          ],
          "steps": [
            { "type": "header", "content": "Preparation" },
            { "type": "item", "content": "Mix flour and water." }
          ],
          "tips": [
            { "type": "header", "content": "Tips" },
            { "type": "item", "content": "Use cold butter for a flakier crust." }
          ],
          "tags": ["sweet", "baking"],
          "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
          "created_at": "2023-10-27T10:00:00Z"
        }
        ```
-   **Error Response**:
    -   **Code**: `404 Not Found` - If the recipe does not exist or is not public.

---

### Utilities / SEO

#### `POST /utils/slugify` (Supabase Edge Function)

-   **Description**: Generate a URL-safe slug from a human-readable recipe name. Intended to keep slug generation consistent (diacritics removal, separators, length limits) across clients.
-   **Auth**: Not required.
-   **Request Payload**:
    ```json
    {
      "text": "Biała kiełbasa z jabłkami",
      "max_length": 80,
      "fallback": "przepis"
    }
    ```
-   **Slug rules (MVP)**:
    - Lowercase
    - Polish diacritics are transliterated: `ą->a`, `ć->c`, `ę->e`, `ł->l`, `ń->n`, `ó->o`, `ś->s`, `ż->z`, `ź->z`
    - Non-alphanumeric characters are removed/treated as separators
    - Multiple separators collapse into a single `-`
    - Trim `-` from start/end
    - Enforce `max_length` (default `80`)
    - If the result is empty, use `fallback` (default `przepis`)
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "slug": "biala-kielbasa-z-jablkami"
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request` (missing/invalid `text`)
        -   **Payload** (example):
            ```json
            {
              "message": "Field 'text' is required."
            }
            ```

---

### Recipes

#### `GET /recipes`

-   **Description**: Retrieve a list of recipes for the authenticated user.
-   **Notes**:
    - The endpoint supports multiple "views" of the user's recipe library.
    - The `my_recipes` view is designed for the `my-recipies` page in the private (logged-in) UI: it returns both recipes authored by the user and public recipes authored by others that are present in at least one collection owned by the user.
    - Response helper fields:
        - `is_owner`: `true` if the authenticated user is the recipe author, otherwise `false`.
        - `in_my_collections`: `true` if the recipe is present in at least one collection owned by the authenticated user (may be `true` for both owned and non-owned recipes).
        - `in_my_plan`: `true` if the recipe is present in the authenticated user's "My Plan" list.
    - When `view = my_recipes`, the result set MUST be de-duplicated (a recipe that belongs to multiple collections must appear only once).
-   **Query Parameters**:
    -   `page` (optional, integer, default: 1): The page number for pagination.
    -   `limit` (optional, integer, default: 20): The number of items per page.
    -   `sort` (optional, string): Sort order. e.g., `name.asc`, `created_at.desc`.
    -   `view` (optional, string, default: `owned`): Determines which set of recipes is returned.
        -   `owned`: Only recipes authored by the authenticated user.
        -   `my_recipes`: Recipes authored by the authenticated user **plus** public recipes authored by others that are included in at least one collection owned by the authenticated user.
    -   `filter[category_id]` (optional, integer): Filter by category ID.
    -   `filter[tags]` (optional, string): Comma-separated list of tag names to filter by.
    -   `filter[termorobot]` (optional, boolean): Filter by the "Termorobot" flag (`true` / `false`).
    -   `filter[grill]` (optional, boolean): Filter by the "Grill" flag (`true` / `false`).
    -   `filter[diet_type]` (optional, string): Filter by diet type: `MEAT` | `VEGETARIAN` | `VEGAN`.
    -   `filter[cuisine]` (optional, string): Filter by cuisine: `POLISH` | `ASIAN` | `MEXICAN` | `MIDDLE_EASTERN`.
    -   `filter[difficulty]` (optional, string): Filter by difficulty: `EASY` | `MEDIUM` | `HARD`.
    -   `search` (optional, string): Full-text search across name, ingredients, and tags.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "data": [
            {
              "id": 1,
              "name": "Apple Pie",
              "servings": 6,
              "prep_time_minutes": 30,
              "total_time_minutes": 90,
              "is_termorobot": false,
              "is_grill": false,
              "diet_type": "VEGETARIAN",
              "cuisine": "POLISH",
              "difficulty": "EASY",
              "image_path": "path/to/image.jpg",
              "visibility": "PUBLIC",
              "is_owner": true,
              "in_my_collections": false,
              "in_my_plan": false,
              "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
              "created_at": "2023-10-27T10:00:00Z"
            }
          ],
          "pagination": {
            "currentPage": 1,
            "totalPages": 5,
            "totalItems": 100
          }
        }
        ```
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Payload**: `{ "message": "Authentication required" }`

---

#### `GET /recipes/feed`

-   **Description**: Retrieve a "load more" friendly list of recipes for the authenticated user using cursor-based pagination (recommended for the `/my-recipies` UI).
-   **Notes**:
    - Reuses the same filtering and "view" semantics as `GET /recipes`.
    - Response helper fields are identical (`is_owner`, `in_my_collections`, `in_my_plan`).
    - Intended to support appending results in the UI ("Load more") without classic page navigation.
-   **Query Parameters**:
    -   `cursor` (optional, string): Opaque cursor returned by the previous response (`pageInfo.nextCursor`).
    -   `limit` (optional, integer, default: 12): The number of items to return per batch. (UI uses 12 as the default batch size.)
    -   `sort` (optional, string): Sort order. Must be stable. e.g., `name.asc`, `created_at.desc`.
    -   `view` (optional, string, default: `owned`): Determines which set of recipes is returned.
        -   `owned`: Only recipes authored by the authenticated user.
        -   `my_recipes`: Recipes authored by the authenticated user **plus** public recipes authored by others that are included in at least one collection owned by the authenticated user.
    -   `filter[category_id]` (optional, integer): Filter by category ID.
    -   `filter[tags]` (optional, string): Comma-separated list of tag names to filter by.
    -   `filter[termorobot]` (optional, boolean): Filter by the "Termorobot" flag (`true` / `false`).
    -   `filter[grill]` (optional, boolean): Filter by the "Grill" flag (`true` / `false`).
    -   `filter[diet_type]` (optional, string): Filter by diet type: `MEAT` | `VEGETARIAN` | `VEGAN`.
    -   `filter[cuisine]` (optional, string): Filter by cuisine: `POLISH` | `ASIAN` | `MEXICAN` | `MIDDLE_EASTERN`.
    -   `filter[difficulty]` (optional, string): Filter by difficulty: `EASY` | `MEDIUM` | `HARD`.
    -   `search` (optional, string): Full-text search across name, ingredients, and tags.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "data": [
            {
              "id": 1,
              "name": "Apple Pie",
              "servings": 6,
              "prep_time_minutes": 30,
              "total_time_minutes": 90,
              "is_termorobot": false,
              "is_grill": false,
              "diet_type": "VEGETARIAN",
              "cuisine": "POLISH",
              "difficulty": "EASY",
              "image_path": "path/to/image.jpg",
              "visibility": "PUBLIC",
              "is_owner": true,
              "in_my_collections": false,
              "in_my_plan": false,
              "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
              "created_at": "2023-10-27T10:00:00Z"
            }
          ],
          "pageInfo": {
            "hasMore": true,
            "nextCursor": "opaque_cursor_value"
          }
        }
        ```
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Payload**: `{ "message": "Authentication required" }`

---

#### `POST /recipes`

-   **Description**: Create a new recipe. The raw text for ingredients, steps, and tips will be parsed server-side into JSONB format. The `tips_raw` field is optional.
-   **Request Payload**:
    ```json
    {
      "name": "New Awesome Recipe",
      "description": "A short description.",
      "servings": 4,
      "prep_time_minutes": 30,
      "total_time_minutes": 90,
      "is_termorobot": false,
      "is_grill": false,
      "diet_type": "VEGETARIAN",
      "cuisine": "POLISH",
      "difficulty": "EASY",
      "category_id": 2,
      "visibility": "PRIVATE",
      "ingredients_raw": "# Dough\n- 500g flour\n- 250ml water",
      "steps_raw": "# Preparation\n1. Mix flour and water.\n2. Knead the dough.",
      "tips_raw": "# Tips\n- Use cold butter for a flakier crust.",
      "tags": ["vegan", "quick"]
    }
    ```
-   **Success Response**:
    -   **Code**: `201 Created`
    -   **Payload**:
        ```json
        {
          "id": 101,
          "name": "New Awesome Recipe",
          "description": "A short description.",
          "servings": 4,
          "prep_time_minutes": 30,
          "total_time_minutes": 90,
          "is_termorobot": false,
          "is_grill": false,
          "diet_type": "VEGETARIAN",
          "cuisine": "POLISH",
          "difficulty": "EASY",
          "category_id": 2,
          "visibility": "PRIVATE",
          "ingredients": [
            {"type": "header", "content": "Dough"},
            {"type": "item", "content": "500g flour"},
            {"type": "item", "content": "250ml water"}
          ],
          "steps": [
            {"type": "header", "content": "Preparation"},
            {"type": "item", "content": "1. Mix flour and water."},
            {"type": "item", "content": "2. Knead the dough."}
          ],
          "tips": [
            {"type": "header", "content": "Tips"},
            {"type": "item", "content": "Use cold butter for a flakier crust."}
          ],
          "tags": [
            {"id": 5, "name": "vegan"},
            {"id": 12, "name": "quick"}
          ],
          "created_at": "2023-10-27T12:00:00Z"
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request`
    -   **Payload**: `{ "message": "Validation failed", "errors": { "name": "Name is required." } }`
    -   **Code**: `401 Unauthorized`

---

#### `POST /recipes/import`

-   **Description**: Create a new recipe from a raw text block. The server is responsible for parsing the text and structuring it into the required JSONB format.
-   **Notes (MVP)**:
    - Tips / "wskazówki" are **not** imported in MVP. The created recipe will have an empty `tips` list and the user can add tips later in the edit form.
-   **Request Payload**:
    ```json
    {
      "raw_text": "# Pizza\n## Składniki\n### Ciasto\n - mąka\n - drożdże\n## Kroki\n - krok 1"
    }
    ```
-   **Success Response**:
    -   **Code**: `201 Created`
    -   **Payload**: Returns the full object of the newly created recipe (similar to `POST /recipes`) so the client can get its ID and proceed to edit.
        ```json
        {
          "id": 102,
          "name": "Pizza",
          "description": null,
          "servings": null,
          "prep_time_minutes": null,
          "total_time_minutes": null,
          "is_termorobot": false,
          "is_grill": false,
          "diet_type": null,
          "cuisine": null,
          "difficulty": null,
          "category_id": null,
          "visibility": "PRIVATE",
          "ingredients": [
            {"type": "header", "content": "Ciasto"},
            {"type": "item", "content": "mąka"},
            {"type": "item", "content": "drożdże"}
          ],
          "steps": [
            {"type": "item", "content": "krok 1"}
          ],
          "tips": [],
          "tags": [],
          "created_at": "2023-10-28T10:00:00Z"
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request` - If the text is empty or has an invalid format that prevents parsing.
    -   **Payload**: `{ "message": "Invalid recipe format. A title (#) is required." }`
    -   **Code**: `401 Unauthorized`

---

### AI

#### `POST /ai/recipes/draft` (Supabase Edge Function)

-   **Description**: Generate a structured recipe draft from either a raw text paste or a pasted image (OCR + LLM). This endpoint does **not** create a recipe record. The client uses the returned draft to prefill the `/recipes/new` form, where the user can review and edit before saving.
-   **Auth**: Required (`Authorization: Bearer <JWT>`).
-   **Notes**:
    - The frontend MUST NOT call this endpoint when both text and image are empty. In that case it should open an empty recipe form (`/recipes/new`) directly.
    - The endpoint enforces "single recipe" validation. If the input looks like multiple recipes or unrelated content, it returns a validation error and the UI stays on the input step.
    - The draft MAY include `tips_raw` (wskazówki) if the model can infer them from the input. If not available, the field may be omitted or returned as an empty string.
    - Category handling: the draft may include `category_name` which the client maps to the predefined categories list. If no match exists, the client should leave `category_id` empty and prompt the user to choose.
    - Rate limiting SHOULD be enforced per user to control costs (implementation detail of the Edge Function).
-   **Request Payload**:
    ```json
    {
      "source": "text",
      "text": "…pasted recipe text…",
      "language": "pl",
      "output_format": "pycha_recipe_draft_v1"
    }
    ```
    or
    ```json
    {
      "source": "image",
      "image": {
        "mime_type": "image/png",
        "data_base64": "iVBORw0KGgoAAA..."
      },
      "language": "pl",
      "output_format": "pycha_recipe_draft_v1"
    }
    ```
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "draft": {
            "name": "Sernik klasyczny",
            "description": "Kremowy sernik na spodzie z herbatników.",
            "ingredients_raw": "# Składniki\n- twaróg\n- jajka\n- cukier",
            "steps_raw": "# Kroki\n1. Wymieszaj składniki.\n2. Upiecz.",
            "tips_raw": "# Wskazówki\n- Wszystkie składniki powinny mieć temperaturę pokojową.",
            "category_name": "Deser",
            "tags": ["wypieki", "sernik"]
          },
          "meta": {
            "confidence": 0.82,
            "warnings": []
          }
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request` (invalid payload, missing required fields for the chosen `source`)
    -   **Code**: `401 Unauthorized`
    -   **Code**: `413 Payload Too Large` (image too large)
    -   **Code**: `422 Unprocessable Entity` (input is not a single recipe)
        -   **Payload** (example):
            ```json
            {
              "message": "Input does not describe a single recipe.",
              "reasons": ["Missing steps", "Looks like multiple recipes"]
            }
            ```
    -   **Code**: `429 Too Many Requests` (rate limit exceeded)

---

#### `POST /ai/recipes/image` (Supabase Edge Function)

-   **Description**: Generate a **photorealistic** recipe image based on the **current recipe form state** (including unsaved edits). This endpoint returns an image preview (base64). The client applies it only after explicit confirmation, by uploading it via the existing `POST /recipes/{id}/image` endpoint.
-   **Auth**: Required (`Authorization: Bearer <JWT>`).
-   **Authorization (premium gating)**:
    - The caller MUST have `app_role` claim set to `premium` or `admin`.
    - If `app_role = user`, the endpoint MUST return `403 Forbidden`.
-   **Notes**:
    - Intended for the recipe edit form (AI icon button next to the image field).
    - **Style contract (MVP)**: photorealistic, rustic wooden table, natural light, no people/hands, no text, no watermark.
    - Output format is fixed for MVP: `image/webp`, recommended `1024x1024`.
    - **Image model (MVP)**: OpenAI Images API (`POST /v1/images/generations`) using model `gpt-image-1.5`.
    - **OpenAI parameters (MVP)**:
        - `model`: `gpt-image-1.5`
        - `n`: `1`
        - `size`: `1024x1024`
        - `output_format`: `webp`
        - `background`: `auto`
        - `quality`: `auto`
        - `stream`: `false`
      The OpenAI response is base64 (`b64_json`) and is returned by this endpoint as `image.data_base64`.
-   **Request Payload**:
    ```json
    {
      "recipe": {
        "id": 123,
        "name": "Sernik klasyczny",
        "description": "Kremowy sernik na spodzie z herbatników.",
        "servings": 8,
        "prep_time_minutes": 20,
        "total_time_minutes": 90,
        "is_termorobot": false,
        "is_grill": false,
        "category_name": "Deser",
        "ingredients": [
          { "type": "header", "content": "Masa" },
          { "type": "item", "content": "twaróg" }
        ],
        "steps": [
          { "type": "item", "content": "Wymieszaj składniki." }
        ],
        "tags": ["wypieki", "sernik"]
      },
      "output": {
        "mime_type": "image/webp",
        "width": 1024,
        "height": 1024
      },
      "language": "pl",
      "output_format": "pycha_recipe_image_v1"
    }
    ```
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "image": {
            "mime_type": "image/webp",
            "data_base64": "UklGRiQAAABXRUJQVlA4..."
          },
          "meta": {
            "style_contract": {
              "photorealistic": true,
              "rustic_table": true,
              "natural_light": true,
              "no_people": true,
              "no_text": true,
              "no_watermark": true
            },
            "warnings": []
          }
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request` (invalid payload)
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden` (not premium/admin)
        -   **Payload** (example):
            ```json
            {
              "message": "Premium feature. Upgrade required."
            }
            ```
    -   **Code**: `422 Unprocessable Entity` (insufficient information to generate a single dish image)

---

#### `GET /recipes/{id}`

-   **Description**: Retrieve a single recipe by its ID.
-   **Notes**:
    - The response SHOULD include the same helper fields used across recipe list endpoints to support UI decisions:
        - `is_owner`
        - `in_my_collections`
        - `in_my_plan`
    - For collection assignment UI (AddToCollectionDialogComponent), the response SHOULD include the list of collection IDs (owned by the authenticated user) that currently contain this recipe:
        - `collection_ids`: `integer[]` (may be empty)
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**: (Similar to the `POST /recipes` success response, plus helper fields)
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden` - If the recipe is not public and the user does not own the recipe.
    -   **Code**: `404 Not Found` - If the recipe does not exist.

---

#### `PUT /recipes/{id}/collections`

-   **Description**: Atomically set the target list of collections (owned by the authenticated user) that should contain the recipe. This endpoint is designed for the "Add to collection" modal with multi-select checkboxes.
-   **Notes**:
    - The operation is **idempotent**: sending the same `collection_ids` multiple times yields the same result.
    - The operation supports **empty** `collection_ids` (the recipe will not belong to any collection).
    - The operation is **atomic**: if any `collection_id` is invalid or not owned by the user, the whole update fails and no partial changes are applied.
    - The client is expected to load the full list of collections via `GET /collections` and filter/search locally in the UI.
-   **Request Payload**:
    ```json
    {
      "collection_ids": [1, 2, 3]
    }
    ```
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "recipe_id": 123,
          "collection_ids": [1, 2, 3],
          "added_ids": [2],
          "removed_ids": [5]
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request` (missing/invalid payload, non-integer IDs, duplicates)
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden` (recipe not accessible or one of the collections is not owned by the user)
    -   **Code**: `404 Not Found` (recipe does not exist)

---

#### `PUT /recipes/{id}`

-   **Description**: Update an existing recipe.
-   **Request Payload**: (Same as `POST /recipes`, with all fields being optional)
    ```json
    {
      "name": "Updated Awesome Recipe",
      "description": "An updated description.",
      "servings": 6,
      "prep_time_minutes": 45,
      "total_time_minutes": 120,
      "is_termorobot": true,
      "is_grill": false,
      "diet_type": "MEAT",
      "cuisine": "MEXICAN",
      "difficulty": "MEDIUM",
      "visibility": "PUBLIC"
    }
    ```
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**: (The full updated recipe object)
-   **Error Response**:
    -   **Code**: `400 Bad Request`
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden`
    -   **Code**: `404 Not Found`

---

#### `DELETE /recipes/{id}`

-   **Description**: Soft-delete a recipe by setting its `deleted_at` timestamp.
-   **Success Response**:
    -   **Code**: `204 No Content`
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden`
    -   **Code**: `404 Not Found`

---

#### `POST /recipes/{id}/image`

-   **Description**: Upload or replace a recipe image for the authenticated user. Intended for "paste from clipboard" (Ctrl+V) and drag&drop flows in the recipe edit form. The server stores the file (e.g., Supabase Storage) and updates `recipes.image_path`.
-   **Content-Type**: `multipart/form-data`
-   **Request Payload (form fields)**:
    -   `file` (required, file): The image file to upload.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "id": 1,
          "image_path": "recipes/1/cover_1700000000.webp",
          "image_url": "https://.../storage/v1/object/public/..."
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request` (invalid file type/size, missing file)
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden` (user doesn't own the recipe)
    -   **Code**: `404 Not Found`
    -   **Code**: `413 Payload Too Large` (file exceeds max size)

---

#### `DELETE /recipes/{id}/image`

-   **Description**: Remove the recipe image (set `image_path = NULL`). Optionally deletes the underlying storage object.
-   **Success Response**:
    -   **Code**: `204 No Content`
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden`
    -   **Code**: `404 Not Found`

---

### Categories

#### `GET /categories`

-   **Description**: Retrieve the list of all predefined categories.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        [
          { "id": 1, "name": "Dinner" },
          { "id": 2, "name": "Dessert" }
        ]
        ```
-   **Error Response**:
    -   **Code**: `401 Unauthorized`

---

### Tags

#### `GET /tags`

-   **Description**: Retrieve all tags created by the authenticated user.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        [
          { "id": 1, "name": "vegetarian" },
          { "id": 2, "name": "spicy" }
        ]
        ```
-   **Error Response**:
    -   **Code**: `401 Unauthorized`

---

### Collections

#### `GET /collections`

-   **Description**: Retrieve a list of collections for the authenticated user.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        [
          {
            "id": 1,
            "name": "Christmas Dishes",
            "description": "Recipes for the holidays."
          }
        ]
        ```
-   **Error Response**:
    -   **Code**: `401 Unauthorized`

---

#### `POST /collections`

-   **Description**: Create a new collection.
-   **Request Payload**:
    ```json
    {
      "name": "Summer BBQ Ideas",
      "description": "Great for a sunny day."
    }
    ```
-   **Success Response**:
    -   **Code**: `201 Created`
    -   **Payload**: (The newly created collection object)
-   **Error Response**:
    -   **Code**: `400 Bad Request`
    -   **Code**: `401 Unauthorized`
    -   **Code**: `409 Conflict` (if a collection with the same name already exists for the user)

---

#### `GET /collections/{id}`

-   **Description**: Retrieve a single collection and a single-batch (non-UI-paginated) list of its recipes. Intended for the `/collections/:id` view, which loads all recipes at once.
-   **Query Parameters**:
    -   `limit` (optional, integer, default: 500): Safety limit for the number of recipes returned in one response.
    -   `sort` (optional, string, default: `created_at.desc`): Sort order for recipes. Must be stable. e.g., `created_at.desc`, `name.asc`.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "id": 1,
          "name": "Christmas Dishes",
          "description": "Recipes for the holidays.",
          "recipes": {
            "data": [
              { "id": 1, "name": "Apple Pie" }
            ],
            "pageInfo": {
              "limit": 500,
              "returned": 40,
              "truncated": false
            }
          }
        }
        ```
-   **Notes**:
    - The UI for `/collections/:id` does not paginate; it renders the returned list in full.
    - If `pageInfo.truncated = true`, the client should show a clear message that not all recipes could be loaded due to a technical limit.
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden`
    -   **Code**: `404 Not Found`

---

#### `PUT /collections/{id}`

-   **Description**: Update a collection's details (name, description).
-   **Request Payload**:
    ```json
    {
      "name": "New Collection Name",
      "description": "Updated description."
    }
    ```
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**: (The full updated collection object)
-   **Error Response**:
    -   **Code**: `400 Bad Request`
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden`
    -   **Code**: `404 Not Found`
    -   **Code**: `409 Conflict`

---

#### `DELETE /collections/{id}`

-   **Description**: Delete a collection. This does not delete the recipes within it.
-   **Success Response**:
    -   **Code**: `204 No Content`
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden`
    -   **Code**: `404 Not Found`

---

#### `POST /collections/{id}/recipes`

-   **Description**: Add a recipe to a collection.
-   **Notes**:
    - For the checkbox-based "Add to collection" modal, prefer using `PUT /recipes/{id}/collections` to set the target state in one atomic operation.
-   **Request Payload**:
    ```json
    {
      "recipe_id": 123
    }
    ```
-   **Success Response**:
    -   **Code**: `201 Created`
    -   **Payload**: `{ "message": "Recipe added to collection successfully." }`
-   **Error Response**:
    -   **Code**: `400 Bad Request`
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden` (if user doesn't own the collection or the recipe)
    -   **Code**: `404 Not Found` (if collection or recipe doesn't exist)
    -   **Code**: `409 Conflict` (if recipe is already in the collection)

---

#### `DELETE /collections/{collectionId}/recipes/{recipeId}`

-   **Description**: Remove a recipe from a collection.
-   **Success Response**:
    -   **Code**: `204 No Content`
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden`
    -   **Code**: `404 Not Found`

---

### My Plan ("Mój plan")

#### `GET /plan`

-   **Description**: Retrieve the authenticated user's "My Plan" list (a persistent list of recipes). The list is ordered by `added_at.desc` (newest first).
-   **Notes**:
    - The list MUST be unique (no duplicate `recipe_id` per user).
    - The list has a hard technical limit of **50** recipes per user.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "data": [
            {
              "recipe_id": 123,
              "added_at": "2023-10-30T10:00:00Z",
              "recipe": {
                "id": 123,
                "name": "Apple Pie",
                "image_path": "path/to/image.jpg"
              }
            }
          ],
          "meta": {
            "total": 1,
            "limit": 50
          }
        }
        ```
-   **Error Response**:
    -   **Code**: `401 Unauthorized`

---

#### `POST /plan/recipes`

-   **Description**: Add a recipe to the authenticated user's "My Plan" list.
-   **Request Payload**:
    ```json
    {
      "recipe_id": 123
    }
    ```
-   **Success Response**:
    -   **Code**: `201 Created`
    -   **Payload**: `{ "message": "Recipe added to plan successfully." }`
-   **Error Response**:
    -   **Code**: `400 Bad Request`
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden` (if the user does not have access to the recipe)
    -   **Code**: `404 Not Found` (if the recipe does not exist)
    -   **Code**: `409 Conflict` (if the recipe is already in the plan)
    -   **Code**: `422 Unprocessable Entity` (if the plan reached the limit of 50 recipes)

---

#### `DELETE /plan/recipes/{recipeId}`

-   **Description**: Remove a recipe from the authenticated user's "My Plan" list.
-   **Success Response**:
    -   **Code**: `204 No Content`
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden`
    -   **Code**: `404 Not Found`

---

#### `DELETE /plan`

-   **Description**: Clear the authenticated user's entire "My Plan" list.
-   **Success Response**:
    -   **Code**: `204 No Content`
-   **Error Response**:
    -   **Code**: `401 Unauthorized`

---

### Search

#### `GET /search/global`

-   **Description**: Global search endpoint ("Omnibox"). Searches across user's recipes and collections simultaneously. Used for quick navigation from the Topbar.
-   **Query Parameters**:
    -   `q` (required, string): Search query (min 2 characters).
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "recipes": [
            { "id": 1, "name": "Apple Pie", "category": "Dessert" },
            { "id": 15, "name": "Spaghetti", "category": "Dinner" }
          ],
          "collections": [
            { "id": 3, "name": "Quick Dinners" }
          ]
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request` (if `q` is missing or too short)
    -   **Code**: `401 Unauthorized`

---

### Dashboard / "Moja Pycha"

#### `GET /dashboard/summary`

-   **Description**: Retrieve a minimal dashboard summary for the authenticated user. Used by the "Moja Pycha" (`/dashboard`) view to render quick links and recent activity without multiple round-trips.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "stats": {
            "recipes_total": 42,
            "collections_total": 7
          },
          "recent_recipes": [
            {
              "id": 15,
              "name": "Spaghetti",
              "image_path": "path/to/image.jpg",
              "created_at": "2023-10-27T10:00:00Z"
            }
          ]
        }
        ```
-   **Error Response**:
    -   **Code**: `401 Unauthorized`

---

### Profiles

#### `GET /profile`

-   **Description**: Retrieve the profile for the authenticated user.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "id": "a1b2c3d4-...",
          "username": "john.doe"
        }
        ```
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Code**: `404 Not Found`

---

#### `PUT /profile`

-   **Description**: Update the profile for the authenticated user.
-   **Request Payload**:
    ```json
    {
      "username": "new.john.doe"
    }
    ```
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**: (The full updated profile object)
-   **Error Response**:
    -   **Code**: `400 Bad Request`
    -   **Code**: `401 Unauthorized`
    -   **Code**: `404 Not Found`

---

### Session / Current User

#### `GET /me`

-   **Description**: Retrieve the minimal identity/profile data for the authenticated user. Intended to bootstrap the logged-in UI (App Shell) on any route, including public routes (`/`, `/explore`, `/explore/recipes/:id-:slug`).
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "id": "a1b2c3d4-...",
          "username": "john.doe",
          "app_role": "user"
        }
        ```
-   **Error Response**:
    -   **Code**: `401 Unauthorized`

## 3. Authentication and Authorization

-   **Authentication**: The API will use JWT (JSON Web Tokens) provided by Supabase Authentication. The client is responsible for obtaining the JWT upon user login/signup and including it in the `Authorization` header for all subsequent requests (e.g., `Authorization: Bearer <YOUR_JWT>`).
-   **Authorization**: Authorization is enforced using PostgreSQL's Row Level Security (RLS) policies, configured in Supabase. These policies ensure that users can only access and modify their own data (`recipes`, `tags`, `collections`, etc.). The API layer will rely on the database to enforce these rules, returning `403 Forbidden` or `404 Not Found` for unauthorized access attempts.
-   **Application Roles (RBAC – preparation)**:
    - JWT MUST include `app_role` claim: `user | premium | admin`.
    - Future premium/admin features SHOULD enforce access using RLS / policies that can read JWT claims (e.g., via `auth.jwt()` in PostgreSQL).
    - In MVP, no endpoints are additionally restricted by `app_role` yet (foundation only).

## 4. Validation and Business Logic

-   **Validation**: Input validation will be performed at the API level before data is sent to the database. This includes checking for required fields, data types, and length constraints as defined in the database schema.
    -   `recipes.name`: required, 1-150 characters.
    -   `recipes.servings`: optional, integer, 1-99. Can be `null` (no value provided).
    -   `recipes.prep_time_minutes`: optional, integer, 0-999. Can be `null` (no value provided).
    -   `recipes.total_time_minutes`: optional, integer, 0-999. Can be `null` (no value provided).
    -   `recipes.is_termorobot`: optional, boolean. Default: `false`.
    -   `recipes.is_grill`: optional, boolean. Default: `false`.
    -   `recipes.diet_type`: optional, enum: 'MEAT', 'VEGETARIAN', 'VEGAN'. Can be `null` (no value provided).
    -   `recipes.cuisine`: optional, enum: 'POLISH', 'ASIAN', 'MEXICAN', 'MIDDLE_EASTERN'. Can be `null` (no value provided).
    -   `recipes.difficulty`: optional, enum: 'EASY', 'MEDIUM', 'HARD'. Can be `null` (no value provided).
    -   `recipes.visibility`: required, enum: 'PRIVATE', 'SHARED', 'PUBLIC'. Default: 'PRIVATE'.
    -   `recipes.ingredients_raw`, `recipes.steps_raw`: required.
    -   `recipes.tips_raw`: optional. Can be omitted or empty (the stored `tips` list becomes empty).
    -   `POST /recipes/{id}/image`:
        - `file`: required
        - allowed mime types: `image/png`, `image/jpeg`, `image/webp`
        - max file size: `10 MB`
    -   `tags.name`: required, 1-50 characters.
    -   `collections.name`: required, 1-100 characters.
-   **Business Logic**:
    -   **Recipe time consistency**: If both `prep_time_minutes` and `total_time_minutes` are provided (non-null), then `total_time_minutes` MUST be greater than or equal to `prep_time_minutes`. Otherwise the API MUST return `400 Bad Request` with a clear validation error payload.
    -   **Text Parsing**: For `POST /recipes` and `PUT /recipes`, the API will accept `ingredients_raw` and `steps_raw` as plain text, and MAY accept `tips_raw` (optional) as plain text. A dedicated PostgreSQL function, called via RPC, will parse this text into the structured `jsonb` format required by the database (`ingredients`, `steps`, `tips`). Lines starting with `#` will be converted to `{"type": "header", ...}` objects. For lines in `steps_raw`, the parser will strip leading numbering (like "1.", "2.") and bullet points to ensure clean data storage. This allows the frontend to implement automatic, continuous numbering across sections without duplication.
    -   **Tag Management**: When creating/updating a recipe, the list of tag names provided will be used to find existing tags or create new ones for the user, and then associate them with the recipe. This logic will be handled within the database transaction for creating/updating the recipe.
    -   **Soft Deletes**: `DELETE /recipes/{id}` performs a soft delete by setting the `deleted_at` field. All `GET` requests for recipes will automatically filter out records where `deleted_at` is not null.
