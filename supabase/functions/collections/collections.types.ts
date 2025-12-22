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
    category_id: number | null;
    category_name: string | null;
    servings: number | null;
    is_termorobot: boolean;
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
 * @deprecated Use CollectionRecipesPageInfoDto for batch responses instead.
 */
export interface PaginatedRecipesDto {
    data: RecipeListItemDto[];
    pagination: PaginationDetails;
}

/**
 * Page info for collection recipes batch response (no UI pagination).
 */
export interface CollectionRecipesPageInfoDto {
    /** Effective limit applied to the batch. */
    limit: number;
    /** Number of items actually returned in the data array. */
    returned: number;
    /** True if the collection contains more recipes than the limit (response was truncated). */
    truncated: boolean;
}

/**
 * DTO for the detailed view of a single collection.
 * Includes collection metadata and a batch list of its recipes (no UI pagination).
 */
export interface CollectionDetailDto extends CollectionListItemDto {
    recipes: {
        data: RecipeListItemDto[];
        pageInfo: CollectionRecipesPageInfoDto;
    };
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
