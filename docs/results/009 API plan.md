# REST API Plan

This document outlines the REST API for the PychaŚwiatowa application, based on the database schema and product requirements. The API is designed to be consumed by an Angular frontend and is built upon the Supabase BaaS platform.

## 1. Resources

The API exposes the following primary resources:

-   **Recipes**: Corresponds to the `recipes` table. Represents a user's culinary recipe.
-   **Categories**: Corresponds to the `categories` table. Represents a predefined recipe category.
-   **Tags**: Corresponds to the `tags` table. Represents user-defined tags for recipes.
-   **Collections**: Corresponds to the `collections` table. Represents user-created collections of recipes.

## 2. Endpoints

All endpoints are protected and require a valid JWT from Supabase Auth.

---

### Recipes

#### `GET /recipes`

-   **Description**: Retrieve a list of recipes for the authenticated user.
-   **Query Parameters**:
    -   `page` (optional, integer, default: 1): The page number for pagination.
    -   `limit` (optional, integer, default: 20): The number of items per page.
    -   `sort` (optional, string): Sort order. e.g., `name.asc`, `created_at.desc`.
    -   `filter[category_id]` (optional, integer): Filter by category ID.
    -   `filter[tags]` (optional, string): Comma-separated list of tag names to filter by.
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
              "image_path": "path/to/image.jpg",
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

#### `POST /recipes`

-   **Description**: Create a new recipe. The raw text for ingredients and steps will be parsed server-side into JSONB format.
-   **Request Payload**:
    ```json
    {
      "name": "New Awesome Recipe",
      "description": "A short description.",
      "category_id": 2,
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
          "category_id": 2,
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
          "category_id": null,
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
    -   **Code**: `403 Forbidden` - If the user does not own the recipe.
    -   **Code**: `404 Not Found` - If the recipe does not exist.

---

#### `PUT /recipes/{id}`

-   **Description**: Update an existing recipe.
-   **Request Payload**: (Same as `POST /recipes`, with all fields being optional)
    ```json
    {
      "name": "Updated Awesome Recipe",
      "description": "An updated description."
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

-   **Description**: Retrieve a single collection and a paginated list of its recipes.
-   **Query Parameters**:
    -   `page` (optional, integer, default: 1): The page number for recipe pagination.
    -   `limit` (optional, integer, default: 20): The number of recipes per page.
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
            "pagination": {
              "currentPage": 1,
              "totalPages": 2,
              "totalItems": 40
            }
          }
        }
        ```
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

## 3. Authentication and Authorization

-   **Authentication**: The API will use JWT (JSON Web Tokens) provided by Supabase Authentication. The client is responsible for obtaining the JWT upon user login/signup and including it in the `Authorization` header for all subsequent requests (e.g., `Authorization: Bearer <YOUR_JWT>`).
-   **Authorization**: Authorization is enforced using PostgreSQL's Row Level Security (RLS) policies, configured in Supabase. These policies ensure that users can only access and modify their own data (`recipes`, `tags`, `collections`, etc.). The API layer will rely on the database to enforce these rules, returning `403 Forbidden` or `404 Not Found` for unauthorized access attempts.

## 4. Validation and Business Logic

-   **Validation**: Input validation will be performed at the API level before data is sent to the database. This includes checking for required fields, data types, and length constraints as defined in the database schema.
    -   `recipes.name`: required, 1-150 characters.
    -   `recipes.ingredients_raw`, `recipes.steps_raw`: required.
    -   `tags.name`: required, 1-50 characters.
    -   `collections.name`: required, 1-100 characters.
-   **Business Logic**:
    -   **Text Parsing**: For `POST /recipes` and `PUT /recipes`, the API will accept `ingredients_raw` and `steps_raw` as plain text. A dedicated PostgreSQL function, called via RPC, will parse this text into the structured `jsonb` format required by the database. Lines starting with `#` will be converted to `{"type": "header", ...}` objects.
    -   **Tag Management**: When creating/updating a recipe, the list of tag names provided will be used to find existing tags or create new ones for the user, and then associate them with the recipe. This logic will be handled within the database transaction for creating/updating the recipe.
    -   **Soft Deletes**: `DELETE /recipes/{id}` performs a soft delete by setting the `deleted_at` field. All `GET` requests for recipes will automatically filter out records where `deleted_at` is not null.
