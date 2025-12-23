# REST API Plan

This document outlines the REST API for the PychaŚwiatowa application, based on the database schema and product requirements. The API is designed to be consumed by an Angular frontend and is built upon the Supabase BaaS platform.

## 1. Resources

The API exposes the following primary resources:

-   **Recipes**: Corresponds to the `recipes` table. Represents a user's culinary recipe.
-   **Public Recipes**: Read-only access to recipes for public routes. For anonymous users: only recipes with `visibility = 'PUBLIC'`. For authenticated users: may also include the user's own recipes with non-public `visibility` (e.g., `PRIVATE`, `SHARED`) as long as `is_owner = true`.
-   **Categories**: Corresponds to the `categories` table. Represents a predefined recipe category.
-   **Tags**: Corresponds to the `tags` table. Represents user-defined tags for recipes.
-   **Collections**: Corresponds to the `collections` table. Represents user-created collections of recipes.

## 2. Endpoints

Private endpoints are protected and require a valid JWT from Supabase Auth.
Public endpoints are available without authentication:
- For **anonymous** users, they must return **only** recipes with `visibility = 'PUBLIC'` (and `deleted_at IS NULL`).
- For **authenticated** users, they may additionally include **the user's own** recipes with non-public `visibility` (e.g., `PRIVATE`, `SHARED`) but must never expose non-public recipes of other users.

---

### Public Recipes

#### `GET /public/recipes`

-   **Description**: Retrieve a paginated list of recipes for public routes. For anonymous users, the list contains only public recipes. For authenticated users, the list may also include their own recipes with non-public visibility.
-   **Notes**:
    - Public access is allowed without authentication, but the client MAY include an `Authorization: Bearer <JWT>` header.
    - If the request is authenticated, the API returns the helper field `is_owner` and MAY include the user's own recipes with `visibility != 'PUBLIC'` (only when `is_owner = true`).
-   **Query Parameters**:
    -   `page` (optional, integer, default: 1): The page number for pagination.
    -   `limit` (optional, integer, default: 20): The number of items per page.
    -   `sort` (optional, string, default: `created_at.desc`): Sort order. e.g., `created_at.desc`, `name.asc`.
    -   `q` (optional, string): Text search query (min 2 characters). Searches across name, ingredients, and tags.
    -   `filter[termorobot]` (optional, boolean): Filter by the "Termorobot" flag (`true` / `false`). (API-ready; UI may not expose it in MVP.)
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
              "is_termorobot": false,
              "image_path": "path/to/image.jpg",
              "visibility": "PUBLIC",
              "is_owner": false,
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
              "is_termorobot": false,
              "image_path": null,
              "visibility": "PRIVATE",
              "is_owner": true,
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
-   **Error Response**:
    -   **Code**: `400 Bad Request` (if `q` is provided and too short)
    -   **Payload**: `{ "message": "Query must be at least 2 characters" }`

---

#### `GET /public/recipes/feed`

-   **Description**: Retrieve a "load more" friendly list of recipes for public routes using cursor-based pagination (recommended for the `/explore` UI). For anonymous users, the list contains only public recipes. For authenticated users, the list may also include their own recipes with non-public visibility.
-   **Notes**:
    - Public access is allowed without authentication, but the client MAY include an `Authorization: Bearer <JWT>` header.
    - If the request is authenticated, the API returns the helper field `is_owner` and MAY include the user's own recipes with `visibility != 'PUBLIC'` (only when `is_owner = true`).
-   **Query Parameters**:
    -   `cursor` (optional, string): Opaque cursor returned by the previous response (`pageInfo.nextCursor`).
    -   `limit` (optional, integer, default: 12): The number of items to return per batch. (UI uses 12 as the default batch size.)
    -   `sort` (optional, string, default: `created_at.desc`): Sort order. Must be stable. e.g., `created_at.desc`, `name.asc`.
    -   `q` (optional, string): Text search query (min 2 characters). Searches across name, ingredients, and tags.
    -   `filter[termorobot]` (optional, boolean): Filter by the "Termorobot" flag (`true` / `false`). (API-ready; UI may not expose it in MVP.)
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
              "is_termorobot": false,
              "image_path": "path/to/image.jpg",
              "visibility": "PUBLIC",
              "is_owner": false,
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
              "is_termorobot": false,
              "image_path": null,
              "visibility": "SHARED",
              "is_owner": true,
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
-   **Error Response**:
    -   **Code**: `400 Bad Request` (invalid cursor, `q` too short)
    -   **Payload**: `{ "message": "Query must be at least 2 characters" }`

---

#### `GET /public/recipes/{id}`

-   **Description**: Retrieve a single public recipe by its ID. Intended for public, shareable, SEO-friendly recipe pages (frontend can include a slug in the URL, but the API uses the numeric `id`).
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**:
        ```json
        {
          "id": 1,
          "name": "Apple Pie",
          "description": "A classic dessert.",
          "servings": 6,
          "is_termorobot": false,
          "image_path": "path/to/image.jpg",
          "visibility": "PUBLIC",
          "category": { "id": 2, "name": "Dessert" },
          "ingredients": [
            { "type": "header", "content": "Dough" },
            { "type": "item", "content": "500g flour" }
          ],
          "steps": [
            { "type": "header", "content": "Preparation" },
            { "type": "item", "content": "Mix flour and water." }
          ],
          "tags": ["sweet", "baking"],
          "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
          "created_at": "2023-10-27T10:00:00Z"
        }
        ```
-   **Error Response**:
    -   **Code**: `404 Not Found` - If the recipe does not exist or is not public.

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
              "is_termorobot": false,
              "image_path": "path/to/image.jpg",
              "visibility": "PUBLIC",
              "is_owner": true,
              "in_my_collections": false,
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
    - Response helper fields are identical (`is_owner`, `in_my_collections`).
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
              "is_termorobot": false,
              "image_path": "path/to/image.jpg",
              "visibility": "PUBLIC",
              "is_owner": true,
              "in_my_collections": false,
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

-   **Description**: Create a new recipe. The raw text for ingredients and steps will be parsed server-side into JSONB format.
-   **Request Payload**:
    ```json
    {
      "name": "New Awesome Recipe",
      "description": "A short description.",
      "servings": 4,
      "is_termorobot": false,
      "category_id": 2,
      "visibility": "PRIVATE",
      "ingredients_raw": "# Dough\n- 500g flour\n- 250ml water",
      "steps_raw": "# Preparation\n1. Mix flour and water.\n2. Knead the dough.",
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
          "is_termorobot": false,
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
          "is_termorobot": false,
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
          "tags": [],
          "created_at": "2023-10-28T10:00:00Z"
        }
        ```
-   **Error Response**:
    -   **Code**: `400 Bad Request` - If the text is empty or has an invalid format that prevents parsing.
    -   **Payload**: `{ "message": "Invalid recipe format. A title (#) is required." }`
    -   **Code**: `401 Unauthorized`

---

#### `GET /recipes/{id}`

-   **Description**: Retrieve a single recipe by its ID.
-   **Success Response**:
    -   **Code**: `200 OK`
    -   **Payload**: (Similar to the `POST /recipes` success response)
-   **Error Response**:
    -   **Code**: `401 Unauthorized`
    -   **Code**: `403 Forbidden` - If the recipe is not public and the user does not own the recipe.
    -   **Code**: `404 Not Found` - If the recipe does not exist.

---

#### `PUT /recipes/{id}`

-   **Description**: Update an existing recipe.
-   **Request Payload**: (Same as `POST /recipes`, with all fields being optional)
    ```json
    {
      "name": "Updated Awesome Recipe",
      "description": "An updated description.",
      "servings": 6,
      "is_termorobot": true,
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
          "username": "john.doe"
        }
        ```
-   **Error Response**:
    -   **Code**: `401 Unauthorized`

## 3. Authentication and Authorization

-   **Authentication**: The API will use JWT (JSON Web Tokens) provided by Supabase Authentication. The client is responsible for obtaining the JWT upon user login/signup and including it in the `Authorization` header for all subsequent requests (e.g., `Authorization: Bearer <YOUR_JWT>`).
-   **Authorization**: Authorization is enforced using PostgreSQL's Row Level Security (RLS) policies, configured in Supabase. These policies ensure that users can only access and modify their own data (`recipes`, `tags`, `collections`, etc.). The API layer will rely on the database to enforce these rules, returning `403 Forbidden` or `404 Not Found` for unauthorized access attempts.

## 4. Validation and Business Logic

-   **Validation**: Input validation will be performed at the API level before data is sent to the database. This includes checking for required fields, data types, and length constraints as defined in the database schema.
    -   `recipes.name`: required, 1-150 characters.
    -   `recipes.servings`: optional, integer, 1-99. Can be `null` (no value provided).
    -   `recipes.is_termorobot`: optional, boolean. Default: `false`.
    -   `recipes.visibility`: required, enum: 'PRIVATE', 'SHARED', 'PUBLIC'. Default: 'PRIVATE'.
    -   `recipes.ingredients_raw`, `recipes.steps_raw`: required.
    -   `POST /recipes/{id}/image`:
        - `file`: required
        - allowed mime types: `image/png`, `image/jpeg`, `image/webp`
        - max file size: `10 MB`
    -   `tags.name`: required, 1-50 characters.
    -   `collections.name`: required, 1-100 characters.
-   **Business Logic**:
    -   **Text Parsing**: For `POST /recipes` and `PUT /recipes`, the API will accept `ingredients_raw` and `steps_raw` as plain text. A dedicated PostgreSQL function, called via RPC, will parse this text into the structured `jsonb` format required by the database. Lines starting with `#` will be converted to `{"type": "header", ...}` objects. For lines in `steps_raw`, the parser will strip leading numbering (like "1.", "2.") and bullet points to ensure clean data storage. This allows the frontend to implement automatic, continuous numbering across sections without duplication.
    -   **Tag Management**: When creating/updating a recipe, the list of tag names provided will be used to find existing tags or create new ones for the user, and then associate them with the recipe. This logic will be handled within the database transaction for creating/updating the recipe.
    -   **Soft Deletes**: `DELETE /recipes/{id}` performs a soft delete by setting the `deleted_at` field. All `GET` requests for recipes will automatically filter out records where `deleted_at` is not null.
