import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { environment } from '../../../../environments/environment';
import {
    RecipeDetailDto,
    CreateRecipeCommand,
    UpdateRecipeCommand,
    RecipeContent,
    TagDto,
    PaginatedResponseDto,
    RecipeListItemDto,
    ImportRecipeCommand,
} from '../../../../../shared/contracts/types';

/**
 * Parametry zapytania do pobierania listy przepisów
 */
export interface GetRecipesParams {
    /** Format: 'column.direction' np. 'created_at.desc' */
    sort?: string;
    /** Liczba elementów na stronie */
    limit?: number;
    /** Numer strony (zaczyna od 1) */
    page?: number;
    /** Fraza do wyszukiwania w nazwie przepisu */
    search?: string;
    /** ID kategorii do filtrowania */
    categoryId?: number | null;
    /** Lista nazw tagów do filtrowania */
    tags?: string[];
}

@Injectable({
    providedIn: 'root',
})
export class RecipesService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Fetches a single recipe by its ID
     */
    getRecipeById(id: number): Observable<RecipeDetailDto> {
        return from(this.fetchRecipeById(id)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                if (!result.data) {
                    throw new Error('Przepis nie został znaleziony');
                }
                return result.data;
            })
        );
    }

    /**
     * Fetches paginated list of recipes with optional filtering and sorting
     * Calls GET /functions/v1/recipes with query parameters
     */
    getRecipes(
        params: GetRecipesParams = {}
    ): Observable<PaginatedResponseDto<RecipeListItemDto>> {
        // Build query parameters
        const queryParams = new URLSearchParams();

        if (params.page) {
            queryParams.append('page', params.page.toString());
        }

        if (params.limit) {
            queryParams.append('limit', params.limit.toString());
        }

        if (params.sort) {
            queryParams.append('sort', params.sort);
        }

        if (params.search) {
            queryParams.append('search', params.search);
        }

        if (params.categoryId) {
            queryParams.append('filter[category_id]', params.categoryId.toString());
        }

        if (params.tags && params.tags.length > 0) {
            queryParams.append('filter[tags]', params.tags.join(','));
        }

        const queryString = queryParams.toString();
        const endpoint = queryString ? `recipes?${queryString}` : 'recipes';

        return from(
            this.supabase.functions.invoke<PaginatedResponseDto<RecipeListItemDto>>(
                endpoint,
                {
                    method: 'GET',
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message || 'Błąd pobierania przepisów');
                }
                return response.data ?? {
                    data: [],
                    pagination: { currentPage: 1, totalPages: 0, totalItems: 0 },
                };
            })
        );
    }

    /**
     * Creates a new recipe
     */
    createRecipe(
        command: CreateRecipeCommand,
        imageFile: File | null
    ): Observable<{ id: number }> {
        return from(this.performCreateRecipe(command, imageFile)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                return result.data!;
            })
        );
    }

    /**
     * Updates an existing recipe
     */
    updateRecipe(
        id: number,
        command: UpdateRecipeCommand,
        imageFile: File | null
    ): Observable<void> {
        return from(this.performUpdateRecipe(id, command, imageFile)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
            })
        );
    }

    /**
     * Deletes a recipe by its ID
     */
    deleteRecipe(id: number): Observable<void> {
        return from(this.performDeleteRecipe(id)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
            })
        );
    }

    /**
     * Imports a recipe from raw text in Markdown format
     */
    importRecipe(command: ImportRecipeCommand): Observable<RecipeDetailDto> {
        return from(this.performImportRecipe(command)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                return result.data!;
            })
        );
    }


    private async fetchRecipeById(id: number): Promise<{
        data: RecipeDetailDto | null;
        error: Error | null;
    }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { data: null, error: new Error('Użytkownik niezalogowany') };
        }

        const { data, error } = await this.supabase
            .from('recipe_details')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (error) {
            return { data: null, error };
        }

        // Parse JSONB fields
        const parsedData: RecipeDetailDto = {
            ...data,
            ingredients: this.parseJsonField<RecipeContent>(
                data.ingredients,
                []
            ),
            steps: this.parseJsonField<RecipeContent>(data.steps, []),
            tags: this.parseJsonField<TagDto[]>(data.tags, []),
        };

        return { data: parsedData, error: null };
    }

    private async performCreateRecipe(
        command: CreateRecipeCommand,
        imageFile: File | null
    ): Promise<{ data: { id: number } | null; error: Error | null }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { data: null, error: new Error('Użytkownik niezalogowany') };
        }

        let imagePath: string | null = null;

        // Upload image if provided
        if (imageFile) {
            const uploadResult = await this.uploadImage(imageFile, user.id);
            if (uploadResult.error) {
                return { data: null, error: uploadResult.error };
            }
            imagePath = uploadResult.path;
        }

        // Parse ingredients and steps
        const ingredients = this.parseRawContent(command.ingredients_raw);
        const steps = this.parseRawContent(command.steps_raw);

        // Insert recipe
        const { data: recipe, error: recipeError } = await this.supabase
            .from('recipes')
            .insert({
                name: command.name,
                description: command.description,
                category_id: command.category_id,
                ingredients,
                steps,
                image_path: imagePath,
                user_id: user.id,
            })
            .select('id')
            .single();

        if (recipeError) {
            return { data: null, error: recipeError };
        }

        // Handle tags
        if (command.tags && command.tags.length > 0) {
            await this.handleTags(recipe.id, command.tags, user.id);
        }

        return { data: { id: recipe.id }, error: null };
    }

    private async performDeleteRecipe(id: number): Promise<{ error: Error | null }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { error: new Error('Użytkownik niezalogowany') };
        }

        // Delete recipe tags first (foreign key constraint)
        await this.supabase.from('recipe_tags').delete().eq('recipe_id', id);

        // Delete the recipe
        const { error } = await this.supabase
            .from('recipes')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            return { error };
        }

        return { error: null };
    }

    private async performUpdateRecipe(
        id: number,
        command: UpdateRecipeCommand,
        imageFile: File | null
    ): Promise<{ error: Error | null }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { error: new Error('Użytkownik niezalogowany') };
        }

        const updateData: Record<string, unknown> = {};

        if (command.name !== undefined) {
            updateData['name'] = command.name;
        }

        if (command.description !== undefined) {
            updateData['description'] = command.description;
        }

        if (command.category_id !== undefined) {
            updateData['category_id'] = command.category_id;
        }

        if (command.ingredients_raw !== undefined) {
            updateData['ingredients'] = this.parseRawContent(
                command.ingredients_raw
            );
        }

        if (command.steps_raw !== undefined) {
            updateData['steps'] = this.parseRawContent(command.steps_raw);
        }

        // Upload new image if provided
        if (imageFile) {
            const uploadResult = await this.uploadImage(imageFile, user.id);
            if (uploadResult.error) {
                return { error: uploadResult.error };
            }
            updateData['image_path'] = uploadResult.path;
        }

        // Update recipe
        const { error: updateError } = await this.supabase
            .from('recipes')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', user.id);

        if (updateError) {
            return { error: updateError };
        }

        // Handle tags if provided
        if (command.tags !== undefined) {
            // Delete existing tags
            await this.supabase
                .from('recipe_tags')
                .delete()
                .eq('recipe_id', id);

            // Add new tags
            if (command.tags.length > 0) {
                await this.handleTags(id, command.tags, user.id);
            }
        }

        return { error: null };
    }

    private async uploadImage(
        file: File,
        userId: string
    ): Promise<{ path: string | null; error: Error | null }> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;

        const { data, error } = await this.supabase.storage
            .from('recipe-images')
            .upload(fileName, file);

        if (error) {
            return { path: null, error };
        }

        // Get public URL
        const {
            data: { publicUrl },
        } = this.supabase.storage.from('recipe-images').getPublicUrl(data.path);

        return { path: publicUrl, error: null };
    }

    private async handleTags(
        recipeId: number,
        tagNames: string[],
        userId: string
    ): Promise<void> {
        for (const tagName of tagNames) {
            const normalizedName = tagName.trim().toLowerCase();

            if (!normalizedName) continue;

            // Find or create tag
            let tagId: number;

            const { data: existingTag } = await this.supabase
                .from('tags')
                .select('id')
                .eq('name', normalizedName)
                .eq('user_id', userId)
                .maybeSingle();

            if (existingTag) {
                tagId = existingTag.id;
            } else {
                const { data: newTag, error: insertError } = await this.supabase
                    .from('tags')
                    .insert({ name: normalizedName, user_id: userId })
                    .select('id')
                    .single();

                if (insertError || !newTag) {
                    console.error('Error creating tag:', insertError);
                    continue;
                }
                tagId = newTag.id;
            }

            // Link tag to recipe
            await this.supabase
                .from('recipe_tags')
                .insert({ recipe_id: recipeId, tag_id: tagId });
        }
    }

    private parseRawContent(raw: string): RecipeContent {
        if (!raw) return [];

        return raw
            .split('\n')
            .filter((line) => line.trim())
            .map((line) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('#')) {
                    return {
                        type: 'header' as const,
                        content: trimmed.substring(1).trim(),
                    };
                }
                return { type: 'item' as const, content: trimmed };
            });
    }

    private parseJsonField<T>(value: unknown, defaultValue: T): T {
        if (value === null || value === undefined) {
            return defaultValue;
        }

        if (typeof value === 'string') {
            try {
                return JSON.parse(value) as T;
            } catch {
                return defaultValue;
            }
        }

        return value as T;
    }

    private async performImportRecipe(
        command: ImportRecipeCommand
    ): Promise<{ data: RecipeDetailDto | null; error: Error | null }> {
        const {
            data: { user },
            error: authError,
        } = await this.supabase.auth.getUser();

        if (authError || !user) {
            return { data: null, error: new Error('Użytkownik niezalogowany') };
        }

        // Get the session to obtain the access token
        const {
            data: { session },
        } = await this.supabase.auth.getSession();

        if (!session) {
            return { data: null, error: new Error('Brak sesji użytkownika') };
        }

        // Make direct HTTP call to the edge function with sub-path
        const functionUrl = `${environment.supabase.url}/functions/v1/recipes/import`;

        try {
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(command),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    message: 'Wystąpił błąd podczas importu przepisu',
                }));
                return {
                    data: null,
                    error: new Error(
                        errorData.message || 'Wystąpił błąd podczas importu przepisu'
                    ),
                };
            }

            const data = await response.json();
            return { data, error: null };
        } catch (error) {
            return {
                data: null,
                error: new Error(
                    error instanceof Error
                        ? error.message
                        : 'Wystąpił błąd podczas importu przepisu'
                ),
            };
        }
    }
}

