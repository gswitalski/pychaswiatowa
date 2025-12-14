/**
 * Collections Types
 * Data Transfer Objects (DTOs) and Command Models for collections endpoints.
 */

// #region --- DTOs ---

/**
 * DTO for an item on the collection list.
 */
export interface CollectionListItemDto {
    id: number;
    name: string;
    description: string | null;
}

/**
 * DTO for a recipe item within a collection detail view.
 * Używa pełnego RecipeListItemDto aby umożliwić wyświetlanie kart z obrazkami.
 */
export interface RecipeListItemDto {
    id: number;
    name: string;
    image_path: string | null;
    created_at: string;
    visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
    is_owner: boolean;
    in_my_collections: boolean;
    author: {
        id: string;
        username: string;
    };
}

/**
 * DTO for a recipe item within a collection detail view (backward compatibility).
 * @deprecated Użyj RecipeListItemDto zamiast tego.
 */
export interface RecipeInCollectionDto {
    id: number;
    name: string;
}

/**
 * Defines the structure for pagination details in API responses.
 */
export interface PaginationDetails {
    currentPage: number;
    totalPages: number;
    totalItems: number;
}

/**
 * Paginated response structure for recipes in a collection.
 */
export interface PaginatedRecipesDto {
    data: RecipeListItemDto[];
    pagination: PaginationDetails;
}

/**
 * DTO for the detailed view of a single collection.
 * Includes collection metadata and a paginated list of its recipes.
 */
export interface CollectionDetailDto extends CollectionListItemDto {
    recipes: PaginatedRecipesDto;
}

// #endregion

// #region --- Command Models ---

/**
 * Command model for creating a new collection.
 */
export interface CreateCollectionCommand {
    name: string;
    description?: string | null;
}

/**
 * Command model for updating an existing collection.
 * All fields are optional.
 */
export interface UpdateCollectionCommand {
    name?: string;
    description?: string | null;
}

/**
 * Command model for adding a recipe to a collection.
 */
export interface AddRecipeToCollectionCommand {
    recipe_id: number;
}

// #endregion
