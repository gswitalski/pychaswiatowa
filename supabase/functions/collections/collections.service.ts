/**
 * Collections Service
 * Contains business logic for collection-related operations.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    CollectionListItemDto,
    CollectionDetailDto,
    RecipeInCollectionDto,
    PaginationDetails,
    CreateCollectionCommand,
    UpdateCollectionCommand,
} from './collections.types.ts';

/** Columns to select for collection list queries. */
const COLLECTION_SELECT_COLUMNS = 'id, name, description';

/** Columns to select for recipe list in collection. */
const RECIPE_SELECT_COLUMNS = 'id, name';

// #region --- Collection CRUD Operations ---

/**
 * Retrieves all collections belonging to a specific user.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @returns Array of CollectionListItemDto objects sorted by name
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getCollections(
    client: TypedSupabaseClient,
    userId: string
): Promise<CollectionListItemDto[]> {
    logger.info('Fetching collections for user', { userId });

    const { data, error } = await client
        .from('collections')
        .select(COLLECTION_SELECT_COLUMNS)
        .eq('user_id', userId)
        .order('name', { ascending: true });

    if (error) {
        logger.error('Database error while fetching collections', {
            userId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch collections');
    }

    logger.info('Collections fetched successfully', { userId, count: data?.length ?? 0 });

    return (data ?? []).map((collection) => ({
        id: collection.id,
        name: collection.name,
        description: collection.description,
    }));
}

/**
 * Retrieves a single collection by ID with paginated recipes.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param collectionId - The ID of the collection to retrieve
 * @param page - Page number (1-based)
 * @param limit - Number of recipes per page
 * @returns CollectionDetailDto with paginated recipes
 * @throws ApplicationError with NOT_FOUND if collection doesn't exist or doesn't belong to user
 */
export async function getCollectionById(
    client: TypedSupabaseClient,
    userId: string,
    collectionId: number,
    page: number = 1,
    limit: number = 20
): Promise<CollectionDetailDto> {
    logger.info('Fetching collection by ID', { userId, collectionId, page, limit });

    // Fetch collection
    const { data: collection, error: collectionError } = await client
        .from('collections')
        .select(COLLECTION_SELECT_COLUMNS)
        .eq('id', collectionId)
        .eq('user_id', userId)
        .single();

    if (collectionError) {
        if (collectionError.code === 'PGRST116') {
            logger.warn('Collection not found', { userId, collectionId });
            throw new ApplicationError('NOT_FOUND', 'Collection not found');
        }
        logger.error('Database error while fetching collection', {
            userId,
            collectionId,
            errorCode: collectionError.code,
            errorMessage: collectionError.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch collection');
    }

    // Get total count of recipes in collection
    const { count: totalItems, error: countError } = await client
        .from('recipe_collections')
        .select('recipe_id', { count: 'exact', head: true })
        .eq('collection_id', collectionId);

    if (countError) {
        logger.error('Database error while counting recipes', {
            collectionId,
            errorCode: countError.code,
            errorMessage: countError.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to count recipes in collection');
    }

    const total = totalItems ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    // Fetch paginated recipes
    const { data: recipeCollections, error: recipesError } = await client
        .from('recipe_collections')
        .select('recipe_id')
        .eq('collection_id', collectionId)
        .range(offset, offset + limit - 1);

    if (recipesError) {
        logger.error('Database error while fetching recipes from collection', {
            collectionId,
            errorCode: recipesError.code,
            errorMessage: recipesError.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipes from collection');
    }

    // Fetch recipe details
    let recipes: RecipeInCollectionDto[] = [];
    if (recipeCollections && recipeCollections.length > 0) {
        const recipeIds = recipeCollections.map((rc) => rc.recipe_id);

        const { data: recipeData, error: recipeDetailsError } = await client
            .from('recipes')
            .select(RECIPE_SELECT_COLUMNS)
            .in('id', recipeIds)
            .is('deleted_at', null);

        if (recipeDetailsError) {
            logger.error('Database error while fetching recipe details', {
                collectionId,
                recipeIds,
                errorCode: recipeDetailsError.code,
                errorMessage: recipeDetailsError.message,
            });
            throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe details');
        }

        recipes = (recipeData ?? []).map((recipe) => ({
            id: recipe.id,
            name: recipe.name,
        }));
    }

    const pagination: PaginationDetails = {
        currentPage: page,
        totalPages,
        totalItems: total,
    };

    logger.info('Collection fetched successfully', {
        userId,
        collectionId,
        recipesCount: recipes.length,
        totalItems: total,
    });

    return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        recipes: {
            data: recipes,
            pagination,
        },
    };
}

/**
 * Creates a new collection for the authenticated user.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param command - The creation command with name and optional description
 * @returns The newly created CollectionListItemDto
 * @throws ApplicationError with CONFLICT if collection name already exists for user
 */
export async function createCollection(
    client: TypedSupabaseClient,
    userId: string,
    command: CreateCollectionCommand
): Promise<CollectionListItemDto> {
    logger.info('Creating new collection', { userId, name: command.name });

    // Check if collection with the same name already exists
    const { data: existing } = await client
        .from('collections')
        .select('id')
        .eq('user_id', userId)
        .eq('name', command.name)
        .single();

    if (existing) {
        logger.warn('Collection name already exists', { userId, name: command.name });
        throw new ApplicationError('CONFLICT', 'A collection with this name already exists');
    }

    const { data, error } = await client
        .from('collections')
        .insert({
            user_id: userId,
            name: command.name,
            description: command.description ?? null,
        })
        .select(COLLECTION_SELECT_COLUMNS)
        .single();

    if (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
            logger.warn('Collection name conflict during insert', { userId, name: command.name });
            throw new ApplicationError('CONFLICT', 'A collection with this name already exists');
        }
        logger.error('Database error while creating collection', {
            userId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to create collection');
    }

    logger.info('Collection created successfully', { userId, collectionId: data.id });

    return {
        id: data.id,
        name: data.name,
        description: data.description,
    };
}

/**
 * Updates an existing collection.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param collectionId - The ID of the collection to update
 * @param command - The update command with optional name and description
 * @returns The updated CollectionListItemDto
 * @throws ApplicationError with NOT_FOUND if collection doesn't exist
 * @throws ApplicationError with CONFLICT if new name already exists
 */
export async function updateCollection(
    client: TypedSupabaseClient,
    userId: string,
    collectionId: number,
    command: UpdateCollectionCommand
): Promise<CollectionListItemDto> {
    logger.info('Updating collection', { userId, collectionId, command });

    // First verify the collection exists and belongs to user
    const { data: existing, error: fetchError } = await client
        .from('collections')
        .select('id, name')
        .eq('id', collectionId)
        .eq('user_id', userId)
        .single();

    if (fetchError || !existing) {
        logger.warn('Collection not found for update', { userId, collectionId });
        throw new ApplicationError('NOT_FOUND', 'Collection not found');
    }

    // If name is being changed, check for conflicts
    if (command.name && command.name !== existing.name) {
        const { data: nameConflict } = await client
            .from('collections')
            .select('id')
            .eq('user_id', userId)
            .eq('name', command.name)
            .neq('id', collectionId)
            .single();

        if (nameConflict) {
            logger.warn('Collection name conflict during update', {
                userId,
                collectionId,
                newName: command.name,
            });
            throw new ApplicationError('CONFLICT', 'A collection with this name already exists');
        }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (command.name !== undefined) {
        updateData.name = command.name;
    }
    if (command.description !== undefined) {
        updateData.description = command.description;
    }

    // If no fields to update, return existing collection
    if (Object.keys(updateData).length === 0) {
        logger.info('No fields to update, returning existing collection', { collectionId });
        return {
            id: existing.id,
            name: existing.name,
            description: (await client
                .from('collections')
                .select('description')
                .eq('id', collectionId)
                .single()).data?.description ?? null,
        };
    }

    const { data, error } = await client
        .from('collections')
        .update(updateData)
        .eq('id', collectionId)
        .eq('user_id', userId)
        .select(COLLECTION_SELECT_COLUMNS)
        .single();

    if (error) {
        if (error.code === '23505') {
            logger.warn('Collection name conflict during update', { userId, collectionId });
            throw new ApplicationError('CONFLICT', 'A collection with this name already exists');
        }
        logger.error('Database error while updating collection', {
            userId,
            collectionId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to update collection');
    }

    logger.info('Collection updated successfully', { userId, collectionId });

    return {
        id: data.id,
        name: data.name,
        description: data.description,
    };
}

/**
 * Deletes a collection. Does not delete recipes in the collection.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param collectionId - The ID of the collection to delete
 * @throws ApplicationError with NOT_FOUND if collection doesn't exist
 */
export async function deleteCollection(
    client: TypedSupabaseClient,
    userId: string,
    collectionId: number
): Promise<void> {
    logger.info('Deleting collection', { userId, collectionId });

    // Verify collection exists and belongs to user
    const { data: existing, error: fetchError } = await client
        .from('collections')
        .select('id')
        .eq('id', collectionId)
        .eq('user_id', userId)
        .single();

    if (fetchError || !existing) {
        logger.warn('Collection not found for deletion', { userId, collectionId });
        throw new ApplicationError('NOT_FOUND', 'Collection not found');
    }

    // Delete recipe-collection associations first (CASCADE should handle this, but being explicit)
    await client
        .from('recipe_collections')
        .delete()
        .eq('collection_id', collectionId);

    // Delete the collection
    const { error } = await client
        .from('collections')
        .delete()
        .eq('id', collectionId)
        .eq('user_id', userId);

    if (error) {
        logger.error('Database error while deleting collection', {
            userId,
            collectionId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to delete collection');
    }

    logger.info('Collection deleted successfully', { userId, collectionId });
}

// #endregion

// #region --- Recipe-Collection Operations ---

/**
 * Adds a recipe to a collection.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param collectionId - The ID of the collection
 * @param recipeId - The ID of the recipe to add
 * @throws ApplicationError with NOT_FOUND if collection or recipe doesn't exist
 * @throws ApplicationError with CONFLICT if recipe is already in collection
 */
export async function addRecipeToCollection(
    client: TypedSupabaseClient,
    userId: string,
    collectionId: number,
    recipeId: number
): Promise<void> {
    logger.info('Adding recipe to collection', { userId, collectionId, recipeId });

    // Verify collection exists and belongs to user
    const { data: collection, error: collectionError } = await client
        .from('collections')
        .select('id')
        .eq('id', collectionId)
        .eq('user_id', userId)
        .single();

    if (collectionError || !collection) {
        logger.warn('Collection not found for adding recipe', { userId, collectionId });
        throw new ApplicationError('NOT_FOUND', 'Collection not found');
    }

    // Verify recipe exists, belongs to user, and is not deleted
    const { data: recipe, error: recipeError } = await client
        .from('recipes')
        .select('id')
        .eq('id', recipeId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

    if (recipeError || !recipe) {
        logger.warn('Recipe not found for adding to collection', { userId, recipeId });
        throw new ApplicationError('NOT_FOUND', 'Recipe not found');
    }

    // Check if recipe is already in collection
    const { data: existing } = await client
        .from('recipe_collections')
        .select('recipe_id')
        .eq('collection_id', collectionId)
        .eq('recipe_id', recipeId)
        .single();

    if (existing) {
        logger.warn('Recipe already in collection', { collectionId, recipeId });
        throw new ApplicationError('CONFLICT', 'Recipe is already in this collection');
    }

    // Add recipe to collection
    const { error: insertError } = await client
        .from('recipe_collections')
        .insert({
            collection_id: collectionId,
            recipe_id: recipeId,
        });

    if (insertError) {
        if (insertError.code === '23505') {
            logger.warn('Recipe already in collection (constraint)', { collectionId, recipeId });
            throw new ApplicationError('CONFLICT', 'Recipe is already in this collection');
        }
        logger.error('Database error while adding recipe to collection', {
            collectionId,
            recipeId,
            errorCode: insertError.code,
            errorMessage: insertError.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to add recipe to collection');
    }

    logger.info('Recipe added to collection successfully', { collectionId, recipeId });
}

/**
 * Removes a recipe from a collection.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param collectionId - The ID of the collection
 * @param recipeId - The ID of the recipe to remove
 * @throws ApplicationError with NOT_FOUND if collection doesn't exist or recipe is not in collection
 */
export async function removeRecipeFromCollection(
    client: TypedSupabaseClient,
    userId: string,
    collectionId: number,
    recipeId: number
): Promise<void> {
    logger.info('Removing recipe from collection', { userId, collectionId, recipeId });

    // Verify collection exists and belongs to user
    const { data: collection, error: collectionError } = await client
        .from('collections')
        .select('id')
        .eq('id', collectionId)
        .eq('user_id', userId)
        .single();

    if (collectionError || !collection) {
        logger.warn('Collection not found for removing recipe', { userId, collectionId });
        throw new ApplicationError('NOT_FOUND', 'Collection not found');
    }

    // Check if recipe is in collection
    const { data: existing } = await client
        .from('recipe_collections')
        .select('recipe_id')
        .eq('collection_id', collectionId)
        .eq('recipe_id', recipeId)
        .single();

    if (!existing) {
        logger.warn('Recipe not in collection', { collectionId, recipeId });
        throw new ApplicationError('NOT_FOUND', 'Recipe is not in this collection');
    }

    // Remove recipe from collection
    const { error } = await client
        .from('recipe_collections')
        .delete()
        .eq('collection_id', collectionId)
        .eq('recipe_id', recipeId);

    if (error) {
        logger.error('Database error while removing recipe from collection', {
            collectionId,
            recipeId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to remove recipe from collection');
    }

    logger.info('Recipe removed from collection successfully', { collectionId, recipeId });
}

// #endregion
