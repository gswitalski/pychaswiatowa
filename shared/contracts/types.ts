/**
 * This file contains the Data Transfer Objects (DTOs) and Command Models
 * used for the REST API communication.
 *
 * These types are derived from the database schema types to ensure consistency
 * and type safety between the frontend and the backend.
 */
import { Tables, TablesInsert, TablesUpdate } from '../types/database.types';
import { FormControl } from '@angular/forms';

// #region --- Base Entity Type Aliases ---

/** Alias for the 'recipes' table row type. */
export type Recipe = Tables<'recipes'>;

/** Alias for the 'recipe_details' view row type. */
export type RecipeDetail = Tables<'recipe_details'>;

/** Alias for the 'categories' table row type. */
export type Category = Tables<'categories'>;

/** Alias for the 'tags' table row type. */
export type Tag = Tables<'tags'>;

/** Alias for the 'collections' table row type. */
export type Collection = Tables<'collections'>;

/** Alias for the 'profiles' table row type. */
export type Profile = Tables<'profiles'>;

// #endregion

// #region --- Generic API Structures ---

/**
 * Defines the structure for pagination details in API responses.
 */
export interface PaginationDetails {
    currentPage: number;
    totalPages: number;
    totalItems: number;
}

/**
 * A generic wrapper for paginated API responses.
 * @template T The type of the data items in the response.
 */
export interface PaginatedResponseDto<T> {
    data: T[];
    pagination: PaginationDetails;
}

/**
 * Defines the structure for collection recipes page info (batch response without UI pagination).
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
 * Defines the structure for cursor-based pagination metadata.
 */
export interface CursorPageInfoDto {
    /** Indicates if there are more items available after the current page. */
    hasMore: boolean;
    /** Opaque cursor token for fetching the next page. Null if hasMore is false. */
    nextCursor: string | null;
}

/**
 * A generic wrapper for cursor-based paginated API responses.
 * @template T The type of the data items in the response.
 */
export interface CursorPaginatedResponseDto<T> {
    data: T[];
    pageInfo: CursorPageInfoDto;
}

// #endregion

// #region --- Recipes ---

/**
 * Recipe visibility enum.
 * Defines who can see a recipe.
 */
export type RecipeVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';

/**
 * DTO for an item on the recipe list.
 * Contains a minimal set of fields for display.
 */
export type RecipeListItemDto = Pick<
    Recipe,
    'id' | 'name' | 'image_path' | 'created_at'
> & {
    visibility: RecipeVisibility;
    is_owner: boolean;
    in_my_collections: boolean;
    /** True if recipe is in authenticated user's plan */
    in_my_plan: boolean;
    author: {
        id: string;
        username: string;
    };
    category_id: number | null;
    category_name: string | null;
    servings: number | null;
    is_termorobot: boolean;
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
};

/**
 * DTO for a public recipe list item.
 * Used for public recipes (supports optional authentication).
 * When user is authenticated, includes information about collections.
 */
export interface PublicRecipeListItemDto {
    id: number;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: RecipeVisibility;
    is_owner: boolean;
    category: CategoryDto | null;
    tags: string[];
    author: ProfileDto;
    created_at: string;
    /** True if recipe is in authenticated user's collections (always false for anonymous) */
    in_my_collections: boolean;
    /** True if recipe is in authenticated user's plan (always false for anonymous) */
    in_my_plan: boolean;
    servings: number | null;
    is_termorobot: boolean;
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
}

/**
 * DTO for detailed view of a single public recipe.
 * Used for anonymous access to full recipe details (no authentication required).
 */
export interface PublicRecipeDetailDto {
    id: number;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: 'PUBLIC';
    category: CategoryDto | null;
    ingredients: RecipeContent;
    steps: RecipeContent;
    tags: string[];
    author: ProfileDto;
    created_at: string;
    /** True if authenticated user owns the recipe (always false for anonymous) */
    is_owner: boolean;
    /** True if recipe is in authenticated user's plan (always false for anonymous) */
    in_my_plan: boolean;
    servings: number | null;
    is_termorobot: boolean;
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
}

/**
 * Represents a single content item within a recipe's ingredients or steps.
 * Can be either a header or a regular item.
 */
export type RecipeContentItem =
    | { type: 'header'; content: string }
    | { type: 'item'; content: string };

/**
 * Represents the structured content for a recipe's ingredients or steps.
 */
export type RecipeContent = RecipeContentItem[];

/**
 * DTO for the detailed view of a single recipe.
 * Based on the `recipe_details` view, but with strongly-typed JSONB fields.
 */
export type RecipeDetailDto = Omit<
    RecipeDetail,
    'ingredients' | 'steps' | 'tags' | 'collections'
> & {
    /** Structured ingredients list. */
    ingredients: RecipeContent;
    /** Structured steps list. */
    steps: RecipeContent;
    /** Array of tags associated with the recipe. */
    tags: TagDto[];
    /** Recipe visibility setting. */
    visibility: RecipeVisibility;
    /** Number of servings the recipe yields (1-99 or null if not specified). */
    servings: number | null;
    /** True if recipe is in authenticated user's plan */
    in_my_plan: boolean;
    /** Preparation time in minutes (0-999 or null if not specified). */
    prep_time_minutes: number | null;
    /** Total time in minutes (0-999 or null if not specified). */
    total_time_minutes: number | null;
};

/**
 * Command model for creating a new recipe.
 * Raw text for ingredients and steps is provided for server-side parsing.
 */
export type CreateRecipeCommand = Pick<
    Recipe,
    'name' | 'description' | 'category_id'
> & {
    ingredients_raw: string;
    steps_raw: string;
    /** A list of tag names to associate with the recipe. */
    tags: string[];
    /** Recipe visibility setting (required). */
    visibility: RecipeVisibility;
    /** Number of servings the recipe yields (1-99 or null if not specified). */
    servings?: number | null;
    /** Flag indicating recipe is designed for Thermomix/Lidlomix (Termorobot). Defaults to false if not provided. */
    is_termorobot?: boolean;
    /** Preparation time in minutes (0-999 or null if not specified). */
    prep_time_minutes?: number | null;
    /** Total time in minutes (0-999 or null if not specified). */
    total_time_minutes?: number | null;
};

/**
 * Command model for updating an existing recipe.
 * All fields are optional.
 */
export type UpdateRecipeCommand = Partial<CreateRecipeCommand> & {
    /** URL or storage path to recipe image (nullable). */
    image_path?: string | null;
};

/**
 * Command model for importing a new recipe from a raw text block.
 */
export type ImportRecipeCommand = {
    raw_text: string;
};

/**
 * Response DTO for uploading a recipe image.
 * Returns the recipe ID, image path in storage, and optional public URL.
 */
export interface UploadRecipeImageResponseDto {
    /** Recipe ID. */
    id: number;
    /** Storage path of the uploaded image (e.g., "recipe-images/userId/recipeId/cover_timestamp.webp"). */
    image_path: string;
    /** Optional public URL for immediate display (may be null for private buckets). */
    image_url?: string;
}

// #endregion

// #region --- Categories ---

/**
 * DTO for a recipe category.
 */
export type CategoryDto = Pick<Category, 'id' | 'name'>;

// #endregion

// #region --- Tags ---

/**
 * DTO for a recipe tag.
 */
export type TagDto = Pick<Tag, 'id' | 'name'>;

// #endregion

// #region --- Collections ---

/**
 * DTO for an item on the collection list.
 */
export type CollectionListItemDto = Pick<
    Collection,
    'id' | 'name' | 'description'
>;

/**
 * DTO for a recipe item within a collection detail view.
 */
export type RecipeInCollectionDto = Pick<Recipe, 'id' | 'name'>;

/**
 * DTO for the detailed view of a single collection, including a batch list of its recipes.
 * Uses RecipeListItemDto to allow displaying full recipe cards with images.
 * Returns all recipes in one batch (no UI pagination) with truncated flag.
 */
export type CollectionDetailDto = CollectionListItemDto & {
    recipes: {
        data: RecipeListItemDto[];
        pageInfo: CollectionRecipesPageInfoDto;
    };
};

/**
 * Command model for creating a new collection.
 */
export type CreateCollectionCommand = Pick<Collection, 'name' | 'description'>;

/**
 * Command model for updating an existing collection.
 * All fields are optional.
 */
export type UpdateCollectionCommand = Partial<CreateCollectionCommand>;

/**
 * Command model for adding a recipe to a collection.
 */
export type AddRecipeToCollectionCommand = {
    recipe_id: number;
};

// #endregion

// #region --- Profiles ---

/**
 * DTO for the user profile.
 */
export type ProfileDto = Pick<Profile, 'id' | 'username'>;

/**
 * Command model for updating a user's profile.
 */
export type UpdateProfileCommand = Partial<Pick<Profile, 'username'>>;

// #endregion

// #region --- Search ---

/**
 * DTO for a single recipe search result.
 * Contains minimal fields for display in search dropdown.
 */
export interface SearchRecipeDto {
    id: number;
    name: string;
    category: string | null;
}

/**
 * DTO for a single collection search result.
 * Contains minimal fields for display in search dropdown.
 */
export interface SearchCollectionDto {
    id: number;
    name: string;
}

/**
 * Main response DTO for global search endpoint.
 * Aggregates search results from recipes and collections.
 */
export interface GlobalSearchResponseDto {
    recipes: SearchRecipeDto[];
    collections: SearchCollectionDto[];
}

/**
 * Application role enum for RBAC.
 * Defines access levels for users across the application.
 */
export type AppRole = 'user' | 'premium' | 'admin';

/**
 * DTO for /me endpoint response.
 * Contains minimal user identity data for App Shell bootstrap.
 */
export interface MeDto {
    id: string;
    username: string;
    app_role: AppRole;
}

// #endregion

// #region --- Auth ---

/**
 * Represents the form controls for the registration form.
 */
export interface RegisterFormViewModel {
    email: FormControl<string>;
    displayName: FormControl<string>;
    password: FormControl<string>;
    passwordConfirm: FormControl<string>;
}

/**
 * Represents the form controls for the login form.
 */
export interface LoginFormViewModel {
    email: FormControl<string>;
    password: FormControl<string>;
}

/**
 * DTO for sending sign-in request to Supabase.
 */
export interface SignInRequestDto {
    email: string;
    password: string;
}

/**
 * DTO for sending sign-up request to Supabase.
 */
export interface SignUpRequestDto {
    email: string;
    password: string;
    options: {
        data: {
            username: string;
        };
    };
}

/**
 * Simplified type for handling API errors.
 */
export interface ApiError {
    message: string;
    status: number;
}

// #endregion

// #region --- Plan (My Plan) ---

/**
 * Command model for adding a recipe to user's plan.
 */
export type AddRecipeToPlanCommand = {
    recipe_id: number;
};

/**
 * DTO for a single item in user's plan list.
 * Minimal recipe data for display in plan view.
 */
export interface PlanListItemDto {
    recipe_id: number;
    added_at: string;
    recipe: {
        id: number;
        name: string;
        image_path: string | null;
    };
}

/**
 * Response DTO for GET /plan endpoint.
 * Returns user's plan list with metadata.
 */
export interface GetPlanResponseDto {
    data: PlanListItemDto[];
    meta: {
        total: number;
        limit: 50;
    };
}

// #endregion

// #region --- AI Recipe Draft ---

/**
 * Source type for AI recipe draft generation.
 */
export type AiRecipeDraftSource = 'text' | 'image';

/**
 * Allowed MIME types for image source.
 */
export type AiRecipeDraftImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * DTO for image data in AI recipe draft request.
 */
export interface AiRecipeDraftImageDto {
    mime_type: AiRecipeDraftImageMimeType;
    data_base64: string;
}

/**
 * Request DTO for AI recipe draft generation endpoint.
 * Supports two variants: text source or image source.
 */
export type AiRecipeDraftRequestDto =
    | {
          source: 'text';
          text: string;
          output_format: 'pycha_recipe_draft_v1';
          language?: string;
      }
    | {
          source: 'image';
          image: AiRecipeDraftImageDto;
          output_format: 'pycha_recipe_draft_v1';
          language?: string;
      };

/**
 * DTO for generated recipe draft.
 * Contains structured data ready for pre-filling the recipe creation form.
 */
export interface AiRecipeDraftDto {
    /** Recipe name (max 150 characters) */
    name: string;
    /** Optional recipe description */
    description: string | null;
    /** Raw ingredients text (newline-separated, # for headers) */
    ingredients_raw: string;
    /** Raw steps text (newline-separated, # for headers) */
    steps_raw: string;
    /** Suggested category name (if recognized) */
    category_name: string | null;
    /** Suggested tags (deduplicated, max 20) */
    tags: string[];
}

/**
 * Meta information about AI draft generation.
 */
export interface AiRecipeDraftMetaDto {
    /** Confidence score (0-1) of the extraction */
    confidence: number;
    /** Warnings about potential issues with the extraction */
    warnings: string[];
}

/**
 * Response DTO for successful AI recipe draft generation.
 */
export interface AiRecipeDraftResponseDto {
    draft: AiRecipeDraftDto;
    meta: AiRecipeDraftMetaDto;
}

/**
 * Response DTO for 422 Unprocessable Entity errors.
 * Returned when the input does not describe a valid single recipe.
 */
export interface AiRecipeDraftUnprocessableEntityDto {
    message: string;
    reasons: string[];
}

// #endregion

// #region --- AI Recipe Image Generation ---

/**
 * Allowed output MIME types for AI recipe image generation.
 */
export type AiRecipeImageMimeType = 'image/webp' | 'image/png';

/**
 * Recipe content item for image generation request.
 */
export interface AiRecipeImageContentItem {
    type: 'header' | 'item';
    content: string;
}

/**
 * Recipe data for AI image generation request.
 */
export interface AiRecipeImageRecipeDto {
    id: number;
    name: string;
    description?: string | null;
    servings?: number | null;
    is_termorobot?: boolean;
    category_name?: string | null;
    ingredients: AiRecipeImageContentItem[];
    steps: AiRecipeImageContentItem[];
    tags?: string[];
}

/**
 * Output configuration for AI image generation request.
 */
export interface AiRecipeImageOutputDto {
    mime_type: AiRecipeImageMimeType;
    width: 1024;
    height: 1024;
}

/**
 * Request DTO for AI recipe image generation endpoint.
 */
export interface AiRecipeImageRequestDto {
    recipe: AiRecipeImageRecipeDto;
    output: AiRecipeImageOutputDto;
    language?: string;
    output_format: 'pycha_recipe_image_v1';
}

/**
 * Style contract metadata for generated image.
 * Confirms adherence to agreed visual style guidelines.
 */
export interface AiRecipeImageStyleContractDto {
    photorealistic: boolean;
    rustic_table: boolean;
    natural_light: boolean;
    no_people: boolean;
    no_text: boolean;
    no_watermark: boolean;
}

/**
 * Meta information for image generation response.
 */
export interface AiRecipeImageMetaDto {
    style_contract: AiRecipeImageStyleContractDto;
    warnings: string[];
}

/**
 * Response DTO for successful AI recipe image generation.
 */
export interface AiRecipeImageResponseDto {
    image: {
        mime_type: AiRecipeImageMimeType;
        data_base64: string;
    };
    meta: AiRecipeImageMetaDto;
}

/**
 * Response DTO for 422 Unprocessable Entity errors in image generation.
 * Returned when the recipe data is insufficient to generate a sensible dish image.
 */
export interface AiRecipeImageUnprocessableEntityDto {
    message: string;
    reasons: string[];
}

// #endregion
