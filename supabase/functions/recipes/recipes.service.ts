/**
 * Recipes Service
 * Contains business logic for recipe-related operations.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { Json } from '../_shared/database.types.ts';

/**
 * Recipe visibility enum type.
 */
export type RecipeVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';

/**
 * DTO for an item on the recipe list.
 * Contains a minimal set of fields for display.
 */
export interface RecipeListItemDto {
    id: number;
    name: string;
    image_path: string | null;
    created_at: string;
    visibility: RecipeVisibility;
    is_owner: boolean;
    in_my_collections: boolean;
    author: {
        id: string;
        username: string;
    };
}

/**
 * Pagination details for API responses.
 */
export interface PaginationDetails {
    currentPage: number;
    totalPages: number;
    totalItems: number;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponseDto<T> {
    data: T[];
    pagination: PaginationDetails;
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
 * DTO for a recipe tag.
 */
export interface TagDto {
    id: number;
    name: string;
}

/**
 * DTO for the detailed view of a single recipe.
 * Based on the `recipe_details` view, with strongly-typed JSONB fields.
 */
export interface RecipeDetailDto {
    id: number;
    user_id: string;
    category_id: number | null;
    name: string;
    description: string | null;
    image_path: string | null;
    created_at: string;
    updated_at: string;
    category_name: string | null;
    visibility: RecipeVisibility;
    ingredients: RecipeContent;
    steps: RecipeContent;
    tags: TagDto[];
}

/**
 * Recipe view type for filtering recipes.
 */
export type RecipesView = 'owned' | 'my_recipes';

/**
 * Options for querying recipes.
 */
export interface GetRecipesOptions {
    page: number;
    limit: number;
    sortField: string;
    sortDirection: 'asc' | 'desc';
    view: RecipesView;
    requesterUserId: string;
    categoryId?: number;
    tags?: string[];
    search?: string;
}

/** Columns to select for recipe list queries. */
const RECIPE_LIST_SELECT_COLUMNS = 'id, name, image_path, created_at, visibility';

/** Columns to select for recipe detail queries. */
const RECIPE_DETAIL_SELECT_COLUMNS =
    'id, user_id, category_id, name, description, image_path, created_at, updated_at, category_name, visibility, ingredients, steps, tags';

/** Allowed sort fields to prevent SQL injection. */
const ALLOWED_SORT_FIELDS = ['name', 'created_at', 'updated_at'];

/** Default sort field. */
const DEFAULT_SORT_FIELD = 'created_at';

/**
 * Resolves tag names to their IDs for the current user.
 * Only returns IDs for tags that exist.
 *
 * @param client - The authenticated Supabase client
 * @param tagNames - Array of tag names to resolve
 * @returns Array of tag IDs
 */
async function resolveTagNamesToIds(
    client: TypedSupabaseClient,
    tagNames: string[]
): Promise<number[]> {
    if (tagNames.length === 0) {
        return [];
    }

    // Normalize tag names to lowercase for case-insensitive matching
    const normalizedNames = tagNames.map((name) => name.toLowerCase());

    const { data, error } = await client
        .from('tags')
        .select('id, name')
        .in('name', normalizedNames);

    if (error) {
        logger.warn('Failed to resolve tag names', {
            errorCode: error.code,
            errorMessage: error.message,
        });
        return [];
    }

    return (data ?? []).map((tag) => tag.id);
}

/**
 * Retrieves a paginated list of recipes for the authenticated user.
 * Uses the get_recipes_list RPC function for efficient querying with proper deduplication.
 *
 * @param client - The authenticated Supabase client
 * @param options - Query options including pagination, sorting, filters, view, and requester ID
 * @returns Paginated response with recipe list items
 * @throws ApplicationError for database errors
 */
export async function getRecipes(
    client: TypedSupabaseClient,
    options: GetRecipesOptions
): Promise<PaginatedResponseDto<RecipeListItemDto>> {
    const {
        page,
        limit,
        sortField,
        sortDirection,
        view,
        requesterUserId,
        categoryId,
        tags,
        search,
    } = options;

    logger.info('Fetching recipes', {
        page,
        limit,
        sortField,
        sortDirection,
        view,
        requesterUserId,
        categoryId,
        tagsCount: tags?.length ?? 0,
        hasSearch: !!search,
    });

    // Validate sort field to prevent injection
    const validSortField = ALLOWED_SORT_FIELDS.includes(sortField)
        ? sortField
        : DEFAULT_SORT_FIELD;

    // Resolve tag names to IDs if tags filter is provided
    let tagIds: number[] | null = null;
    if (tags && tags.length > 0) {
        tagIds = await resolveTagNamesToIds(client, tags);
        logger.debug('Resolved tag names to IDs', {
            tagNames: tags,
            tagIds,
        });

        // If user requested specific tags but none were found,
        // return empty result immediately (no recipes can match)
        if (tagIds.length === 0) {
            logger.info('No matching tags found, returning empty result');
            return {
                data: [],
                pagination: {
                    currentPage: page,
                    totalPages: 0,
                    totalItems: 0,
                },
            };
        }
    }

    // Call the RPC function to get recipes
    const { data, error } = await client.rpc('get_recipes_list', {
        p_user_id: requesterUserId,
        p_view: view,
        p_page: page,
        p_limit: limit,
        p_sort_field: validSortField,
        p_sort_direction: sortDirection,
        p_category_id: categoryId ?? null,
        p_tag_ids: tagIds,
        p_search: search ?? null,
    });

    if (error) {
        logger.error('RPC error while fetching recipes', {
            errorCode: error.code,
            errorMessage: error.message,
            errorDetails: error.details,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipes');
    }

    // Extract total count from first row (all rows have the same total_count)
    const totalItems = data && data.length > 0 ? Number(data[0].total_count) : 0;
    const totalPages = Math.ceil(totalItems / limit);

    logger.info('Recipes fetched successfully', {
        totalItems,
        returnedItems: data?.length ?? 0,
        page,
        totalPages,
        view,
    });

    // Map the data to DTOs
    const recipes: RecipeListItemDto[] = (data ?? []).map((recipe) => ({
        id: Number(recipe.id),
        name: recipe.name,
        image_path: recipe.image_path,
        created_at: recipe.created_at,
        visibility: recipe.visibility as RecipeVisibility,
        is_owner: Boolean(recipe.is_owner),
        in_my_collections: Boolean(recipe.in_my_collections),
        author: {
            id: recipe.author_id,
            username: recipe.author_username,
        },
    }));

    return {
        data: recipes,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems,
        },
    };
}

/**
 * Parses JSONB content (ingredients or steps) to strongly-typed RecipeContent array.
 *
 * @param jsonContent - Raw JSONB content from the database
 * @returns Parsed RecipeContent array
 */
function parseRecipeContent(jsonContent: Json | null): RecipeContent {
    if (!jsonContent || !Array.isArray(jsonContent)) {
        return [];
    }

    return jsonContent
        .filter(
            (item): item is { type: string; content: string } =>
                typeof item === 'object' &&
                item !== null &&
                'type' in item &&
                'content' in item
        )
        .map((item) => ({
            type: item.type === 'header' ? 'header' : 'item',
            content: String(item.content),
        })) as RecipeContent;
}

/**
 * Parses JSONB tags to strongly-typed TagDto array.
 *
 * @param jsonTags - Raw JSONB tags from the database
 * @returns Parsed TagDto array
 */
function parseTagsContent(jsonTags: Json | null): TagDto[] {
    if (!jsonTags || !Array.isArray(jsonTags)) {
        return [];
    }

    return jsonTags
        .filter(
            (item): item is { id: number; name: string } =>
                typeof item === 'object' &&
                item !== null &&
                'id' in item &&
                'name' in item
        )
        .map((item) => ({
            id: Number(item.id),
            name: String(item.name),
        }));
}

/**
 * Retrieves a single recipe by its ID for the authenticated user.
 * Uses the `recipe_details` view which includes joined data from categories and tags.
 * RLS policies automatically filter by user_id and deleted_at IS NULL.
 *
 * @param client - The authenticated Supabase client
 * @param id - The recipe ID to retrieve
 * @returns RecipeDetailDto with full recipe details
 * @throws ApplicationError with NOT_FOUND if recipe doesn't exist or user has no access
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
/**
 * Retrieves a single recipe by ID with proper access control.
 *
 * Access rules:
 * - Returns 200 if user is the owner (regardless of visibility)
 * - Returns 200 if recipe is PUBLIC (regardless of ownership)
 * - Returns 403 if recipe exists, is not PUBLIC, and user is not the owner
 * - Returns 404 if recipe does not exist or is soft-deleted
 *
 * @param client - Authenticated Supabase client
 * @param id - Recipe ID
 * @param requesterUserId - ID of the user making the request
 * @returns RecipeDetailDto with full recipe details
 * @throws ApplicationError with NOT_FOUND if recipe doesn't exist or is deleted
 * @throws ApplicationError with FORBIDDEN if user doesn't have access to private/shared recipe
 * @throws ApplicationError with INTERNAL_ERROR on database errors
 */
export async function getRecipeById(
    client: TypedSupabaseClient,
    id: number,
    requesterUserId: string
): Promise<RecipeDetailDto> {
    logger.info('Fetching recipe by ID', { recipeId: id, requesterUserId });

    // Step A: Try to fetch with authenticated client (respects RLS)
    const { data, error } = await client
        .from('recipe_details')
        .select(RECIPE_DETAIL_SELECT_COLUMNS)
        .eq('id', id)
        .single();

    // Happy path: RLS allowed access
    if (data && !error) {
        logger.info('Recipe fetched successfully via authenticated client', {
            recipeId: id,
            recipeName: data.name,
        });

        return mapToRecipeDetailDto(data);
    }

    // Step B: If PGRST116 (not found by RLS), distinguish between 403 and 404
    if (error && error.code === 'PGRST116') {
        logger.info('Recipe not found via RLS, checking visibility with service role', {
            recipeId: id,
        });

        // Import service role client at the top of the function call
        const { createServiceRoleClient } = await import('../_shared/supabase-client.ts');
        const serviceClient = createServiceRoleClient();

        // Check if recipe exists and get its visibility/ownership status
        const { data: recipeCheck, error: checkError } = await serviceClient
            .from('recipes')
            .select('id, user_id, visibility, deleted_at')
            .eq('id', id)
            .maybeSingle();

        if (checkError) {
            logger.error('Database error while checking recipe existence', {
                recipeId: id,
                errorCode: checkError.code,
                errorMessage: checkError.message,
            });
            throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe');
        }

        // Recipe doesn't exist or is soft-deleted → 404
        if (!recipeCheck || recipeCheck.deleted_at !== null) {
            logger.warn('Recipe not found or deleted', {
                recipeId: id,
                exists: !!recipeCheck,
                deleted: recipeCheck?.deleted_at !== null,
            });
            throw new ApplicationError(
                'NOT_FOUND',
                `Recipe with ID ${id} not found`
            );
        }

        // Recipe exists but is not PUBLIC and user is not owner → 403
        if (recipeCheck.visibility !== 'PUBLIC' && recipeCheck.user_id !== requesterUserId) {
            logger.warn('Access denied to private/shared recipe', {
                recipeId: id,
                visibility: recipeCheck.visibility,
                ownerId: recipeCheck.user_id,
                requesterId: requesterUserId,
            });
            throw new ApplicationError(
                'FORBIDDEN',
                'You do not have permission to access this recipe'
            );
        }

        // Recipe is PUBLIC → fetch full details with service role
        logger.info('Fetching PUBLIC recipe with service role', {
            recipeId: id,
        });

        const { data: publicRecipe, error: publicError } = await serviceClient
            .from('recipe_details')
            .select(RECIPE_DETAIL_SELECT_COLUMNS)
            .eq('id', id)
            .single();

        if (publicError || !publicRecipe) {
            logger.error('Failed to fetch PUBLIC recipe details', {
                recipeId: id,
                errorCode: publicError?.code,
                errorMessage: publicError?.message,
            });
            throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe');
        }

        logger.info('PUBLIC recipe fetched successfully', {
            recipeId: id,
            recipeName: publicRecipe.name,
        });

        return mapToRecipeDetailDto(publicRecipe);
    }

    // Other database errors
    logger.error('Database error while fetching recipe', {
        recipeId: id,
        errorCode: error?.code,
        errorMessage: error?.message,
    });
    throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe');
}

/**
 * Maps raw recipe_details view data to RecipeDetailDto.
 * Helper function to avoid code duplication.
 */
function mapToRecipeDetailDto(data: any): RecipeDetailDto {
    return {
        id: data.id!,
        user_id: data.user_id!,
        category_id: data.category_id,
        name: data.name!,
        description: data.description,
        image_path: data.image_path,
        created_at: data.created_at!,
        updated_at: data.updated_at!,
        category_name: data.category_name,
        visibility: data.visibility as RecipeVisibility,
        ingredients: parseRecipeContent(data.ingredients),
        steps: parseRecipeContent(data.steps),
        tags: parseTagsContent(data.tags),
    };
}

/**
 * Input data for creating a new recipe.
 */
export interface CreateRecipeInput {
    name: string;
    description: string | null;
    category_id: number | null;
    ingredients_raw: string;
    steps_raw: string;
    tags: string[];
    visibility: RecipeVisibility;
}

/**
 * Input data for updating an existing recipe.
 * All fields are optional - only provided fields will be updated.
 */
export interface UpdateRecipeInput {
    name?: string;
    description?: string | null;
    category_id?: number | null;
    ingredients_raw?: string;
    steps_raw?: string;
    tags?: string[];
    visibility?: RecipeVisibility;
    image_path?: string | null;
}

/**
 * Creates a new recipe with associated tags for the authenticated user.
 * Uses the `create_recipe_with_tags` RPC function to ensure atomicity.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param input - The recipe data to create
 * @returns RecipeDetailDto with full details of the newly created recipe
 * @throws ApplicationError with NOT_FOUND if category doesn't exist
 * @throws ApplicationError with VALIDATION_ERROR if ingredients or steps are empty after parsing
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function createRecipe(
    client: TypedSupabaseClient,
    userId: string,
    input: CreateRecipeInput
): Promise<RecipeDetailDto> {
    logger.info('Creating new recipe', {
        userId,
        name: input.name,
        hasDescription: !!input.description,
        categoryId: input.category_id,
        tagsCount: input.tags.length,
    });

    // Call the RPC function to create the recipe with tags atomically
    const { data: recipeId, error: rpcError } = await client.rpc(
        'create_recipe_with_tags',
        {
            p_user_id: userId,
            p_name: input.name,
            p_description: input.description,
            p_category_id: input.category_id,
            p_ingredients_raw: input.ingredients_raw,
            p_steps_raw: input.steps_raw,
            p_tag_names: input.tags,
            p_visibility: input.visibility,
        }
    );

    if (rpcError) {
        logger.error('RPC error while creating recipe', {
            errorCode: rpcError.code,
            errorMessage: rpcError.message,
            errorDetails: rpcError.details,
        });

        // Handle specific error cases based on PostgreSQL error codes/messages
        // P0002 = no_data_found (category not found)
        if (rpcError.code === 'P0002' || rpcError.message?.includes('does not exist')) {
            throw new ApplicationError(
                'NOT_FOUND',
                'The specified category does not exist'
            );
        }

        // P0001 = raise_exception (validation error from RPC)
        if (rpcError.code === 'P0001') {
            throw new ApplicationError(
                'VALIDATION_ERROR',
                rpcError.message || 'Validation error occurred'
            );
        }

        throw new ApplicationError('INTERNAL_ERROR', 'Failed to create recipe');
    }

    if (!recipeId) {
        logger.error('RPC returned null recipe ID');
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to create recipe');
    }

    logger.info('Recipe created successfully, fetching details', {
        recipeId,
    });

    // Fetch the complete recipe details using the existing function
    const recipeDetail = await getRecipeById(client, recipeId);

    logger.info('Recipe creation completed', {
        recipeId: recipeDetail.id,
        recipeName: recipeDetail.name,
        tagsCount: recipeDetail.tags.length,
    });

    return recipeDetail;
}

/**
 * Updates an existing recipe with associated tags for the authenticated user.
 * Uses the `update_recipe_with_tags` RPC function to ensure atomicity.
 *
 * @param client - The authenticated Supabase client
 * @param recipeId - The ID of the recipe to update
 * @param userId - The ID of the authenticated user (must be the owner)
 * @param input - The recipe data to update (only provided fields will be updated)
 * @returns RecipeDetailDto with full details of the updated recipe
 * @throws ApplicationError with NOT_FOUND if recipe doesn't exist or user has no access
 * @throws ApplicationError with NOT_FOUND if category doesn't exist
 * @throws ApplicationError with VALIDATION_ERROR if ingredients or steps are empty after parsing
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function updateRecipe(
    client: TypedSupabaseClient,
    recipeId: number,
    userId: string,
    input: UpdateRecipeInput
): Promise<RecipeDetailDto> {
    logger.info('Updating recipe', {
        recipeId,
        userId,
        updatingName: input.name !== undefined,
        updatingDescription: input.description !== undefined,
        updatingCategory: input.category_id !== undefined,
        updatingIngredients: input.ingredients_raw !== undefined,
        updatingSteps: input.steps_raw !== undefined,
        updatingTags: input.tags !== undefined,
        updatingImagePath: input.image_path !== undefined,
    });

    // Determine if tags should be updated
    const updateTags = input.tags !== undefined;

    // Determine if category should be updated
    const updateCategory = input.category_id !== undefined;

    // Call the RPC function to update the recipe with tags atomically
    const { data: updatedRecipeId, error: rpcError } = await client.rpc(
        'update_recipe_with_tags',
        {
            p_recipe_id: recipeId,
            p_user_id: userId,
            p_name: input.name ?? null,
            p_description: input.description ?? null,
            p_category_id: input.category_id ?? null,
            p_ingredients_raw: input.ingredients_raw ?? null,
            p_steps_raw: input.steps_raw ?? null,
            p_tag_names: input.tags ?? null,
            p_update_tags: updateTags,
            p_visibility: input.visibility ?? null,
            p_image_path: input.image_path ?? null,
            p_update_category: updateCategory,
        }
    );

    if (rpcError) {
        logger.error('RPC error while updating recipe', {
            recipeId,
            errorCode: rpcError.code,
            errorMessage: rpcError.message,
            errorDetails: rpcError.details,
        });

        // Handle specific error cases based on PostgreSQL error codes/messages
        // P0002 = no_data_found (recipe not found, access denied, or category not found)
        if (rpcError.code === 'P0002') {
            // Distinguish between recipe not found and category not found
            if (rpcError.message?.includes('Category')) {
                throw new ApplicationError(
                    'NOT_FOUND',
                    'The specified category does not exist'
                );
            }
            throw new ApplicationError(
                'NOT_FOUND',
                `Recipe with ID ${recipeId} not found`
            );
        }

        // P0001 = raise_exception (validation error from RPC)
        if (rpcError.code === 'P0001') {
            throw new ApplicationError(
                'VALIDATION_ERROR',
                rpcError.message || 'Validation error occurred'
            );
        }

        throw new ApplicationError('INTERNAL_ERROR', 'Failed to update recipe');
    }

    if (!updatedRecipeId) {
        logger.error('RPC returned null recipe ID', { recipeId });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to update recipe');
    }

    logger.info('Recipe updated successfully, fetching details', {
        recipeId: updatedRecipeId,
    });

    // Fetch the complete recipe details using the existing function
    const recipeDetail = await getRecipeById(client, updatedRecipeId);

    logger.info('Recipe update completed', {
        recipeId: recipeDetail.id,
        recipeName: recipeDetail.name,
        tagsCount: recipeDetail.tags.length,
    });

    return recipeDetail;
}

/**
 * Parses raw text to extract recipe name, ingredients, and steps.
 * Expected format:
 * - Title: Line starting with `#` (required)
 * - Main sections: Lines starting with `##` (e.g., "## Składniki", "## Kroki")
 * - Subsections: Lines starting with `###` (headers within sections)
 * - Items: Lines starting with `-` (ingredients or steps)
 *
 * @param rawText - The raw text block containing the recipe
 * @returns Parsed recipe components
 * @throws ApplicationError with VALIDATION_ERROR if title is missing
 */
function parseRecipeText(rawText: string): {
    name: string;
    ingredientsRaw: string;
    stepsRaw: string;
} {
    logger.info('Parsing recipe text', { textLength: rawText.length });

    const lines = rawText.split('\n').map((line) => line.trim());

    let name = '';
    let ingredientsRaw = '';
    let stepsRaw = '';
    let currentSection: 'none' | 'ingredients' | 'steps' = 'none';

    for (const line of lines) {
        // Skip empty lines
        if (line.length === 0) {
            continue;
        }

        // Extract title (# Title)
        if (line.startsWith('# ')) {
            name = line.substring(2).trim();
            logger.debug('Found recipe title', { name });
            continue;
        }

        // Detect main sections (## Section Name)
        if (line.startsWith('## ')) {
            const sectionName = line.substring(3).trim().toLowerCase();

            // Detect "Składniki" section (ingredients)
            if (sectionName.includes('składnik') || sectionName.includes('ingredient')) {
                currentSection = 'ingredients';
                logger.debug('Entering ingredients section');
            }
            // Detect "Kroki" or "Przygotowanie" section (steps)
            else if (
                sectionName.includes('krok') ||
                sectionName.includes('przygotowanie') ||
                sectionName.includes('step') ||
                sectionName.includes('instruction')
            ) {
                currentSection = 'steps';
                logger.debug('Entering steps section');
            } else {
                // Unknown section, skip
                currentSection = 'none';
            }
            continue;
        }

        // Add content to the appropriate section
        // Transform ### to # for subsection headers (as per ingredients_raw/steps_raw format)
        if (currentSection === 'ingredients' || currentSection === 'steps') {
            let transformedLine = line;

            // Convert ### subsection headers to # format expected by parse_text_to_jsonb
            if (line.startsWith('###')) {
                transformedLine = line.replace(/^###\s*/, '# ');
            }

            if (currentSection === 'ingredients') {
                ingredientsRaw += transformedLine + '\n';
            } else {
                stepsRaw += transformedLine + '\n';
            }
        }
    }

    // Validate that we have a title
    if (!name || name.length === 0) {
        logger.warn('Recipe import failed: missing title');
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Invalid recipe format. A title (#) is required.'
        );
    }

    // Trim the collected raw text
    ingredientsRaw = ingredientsRaw.trim();
    stepsRaw = stepsRaw.trim();

    logger.info('Recipe text parsed successfully', {
        name,
        ingredientsLength: ingredientsRaw.length,
        stepsLength: stepsRaw.length,
    });

    return {
        name,
        ingredientsRaw,
        stepsRaw,
    };
}

/**
 * Creates a new recipe from a raw text block for the authenticated user.
 * Parses the text to extract the recipe name, ingredients, and steps,
 * then delegates to the createRecipe function.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param rawText - The raw text block containing the recipe
 * @returns RecipeDetailDto with full details of the newly created recipe
 * @throws ApplicationError with VALIDATION_ERROR if text is empty or missing required fields
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function importRecipeFromText(
    client: TypedSupabaseClient,
    userId: string,
    rawText: string
): Promise<RecipeDetailDto> {
    logger.info('Importing recipe from text', {
        userId,
        textLength: rawText.length,
    });

    // Validate that raw text is not empty
    if (!rawText || rawText.trim().length === 0) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Raw text cannot be empty'
        );
    }

    // Parse the raw text to extract recipe components
    const { name, ingredientsRaw, stepsRaw } = parseRecipeText(rawText);

    // Prepare input for createRecipe
    const createRecipeInput: CreateRecipeInput = {
        name,
        description: null,
        category_id: null,
        ingredients_raw: ingredientsRaw || '- (empty)', // Provide fallback if empty
        steps_raw: stepsRaw || '- (empty)', // Provide fallback if empty
        tags: [],
        visibility: 'PRIVATE', // Import always creates private recipes
    };

    logger.info('Creating recipe from parsed text', { name });

    // Delegate to the existing createRecipe function
    const recipeDetail = await createRecipe(client, userId, createRecipeInput);

    logger.info('Recipe imported successfully', {
        recipeId: recipeDetail.id,
        recipeName: recipeDetail.name,
    });

    return recipeDetail;
}

/**
 * Soft-deletes a recipe by setting its deleted_at timestamp.
 * Uses the recipes table directly with RLS ensuring user ownership.
 *
 * @param client - The authenticated Supabase client
 * @param recipeId - The ID of the recipe to delete
 * @param userId - The ID of the authenticated user (must be the owner)
 * @throws ApplicationError with NOT_FOUND if recipe doesn't exist, is already deleted, or user has no access
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function deleteRecipe(
    client: TypedSupabaseClient,
    recipeId: number,
    userId: string
): Promise<void> {
    logger.info('Soft-deleting recipe', {
        recipeId,
        userId,
    });

    // Perform soft delete by setting deleted_at timestamp
    // RLS policies ensure user can only delete their own recipes
    // WHERE clause ensures recipe exists, belongs to user, and isn't already deleted
    const { error, count } = await client
        .from('recipes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', recipeId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .select('id', { count: 'exact', head: true });

    if (error) {
        logger.error('Database error while deleting recipe', {
            recipeId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to delete recipe');
    }

    // If no rows were updated, recipe doesn't exist or user has no access
    if (count === 0) {
        logger.warn('Recipe not found for deletion', {
            recipeId,
            userId,
        });
        throw new ApplicationError(
            'NOT_FOUND',
            `Recipe with ID ${recipeId} not found`
        );
    }

    logger.info('Recipe soft-deleted successfully', {
        recipeId,
    });
}

