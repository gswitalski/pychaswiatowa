/**
 * This file contains the Data Transfer Objects (DTOs) and Command Models
 * used for the REST API communication.
 *
 * These types are derived from the database schema types to ensure consistency
 * and type safety between the frontend and the backend.
 */
import { Tables, TablesInsert, TablesUpdate } from '../types/database.types';

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

// #endregion

// #region --- Recipes ---

/**
 * DTO for an item on the recipe list.
 * Contains a minimal set of fields for display.
 */
export type RecipeListItemDto = Pick<
    Recipe,
    'id' | 'name' | 'image_path' | 'created_at'
>;

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
};

/**
 * Command model for updating an existing recipe.
 * All fields are optional.
 */
export type UpdateRecipeCommand = Partial<CreateRecipeCommand>;

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
 * DTO for the detailed view of a single collection, including a paginated list of its recipes.
 */
export type CollectionDetailDto = CollectionListItemDto & {
    recipes: PaginatedResponseDto<RecipeInCollectionDto>;
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
