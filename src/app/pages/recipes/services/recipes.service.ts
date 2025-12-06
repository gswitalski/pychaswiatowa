import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
    RecipeDetailDto,
    CreateRecipeCommand,
    UpdateRecipeCommand,
    RecipeContent,
    TagDto,
    PaginatedResponseDto,
    RecipeListItemDto,
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
     */
    getRecipes(
        params: GetRecipesParams = {}
    ): Observable<PaginatedResponseDto<RecipeListItemDto>> {
        return from(this.fetchRecipes(params)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                return result.data;
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

    private async fetchRecipes(params: GetRecipesParams): Promise<{
        data: PaginatedResponseDto<RecipeListItemDto>;
        error: Error | null;
    }> {
        const {
            sort = 'created_at.desc',
            limit = 12,
            page = 1,
            search,
            categoryId,
            tags,
        } = params;

        const [column, order] = sort.split('.');
        const ascending = order === 'asc';

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return {
                data: {
                    data: [],
                    pagination: { currentPage: 1, totalPages: 0, totalItems: 0 },
                },
                error: new Error('Użytkownik niezalogowany'),
            };
        }

        // Najpierw sprawdź czy mamy filtry po tagach
        let recipeIdsFromTags: number[] | null = null;

        if (tags && tags.length > 0) {
            recipeIdsFromTags = await this.getRecipeIdsByTags(tags, user.id);

            // Jeśli nie znaleziono przepisów z tymi tagami, zwróć pusty wynik
            if (recipeIdsFromTags.length === 0) {
                return {
                    data: {
                        data: [],
                        pagination: { currentPage: page, totalPages: 0, totalItems: 0 },
                    },
                    error: null,
                };
            }
        }

        // Buduj zapytanie
        let query = this.supabase
            .from('recipes')
            .select('id, name, image_path, created_at', { count: 'exact' })
            .eq('user_id', user.id);

        // Filtr po wyszukiwaniu
        if (search && search.trim()) {
            query = query.ilike('name', `%${search.trim()}%`);
        }

        // Filtr po kategorii
        if (categoryId) {
            query = query.eq('category_id', categoryId);
        }

        // Filtr po tagach (jeśli mamy listę ID przepisów z tagami)
        if (recipeIdsFromTags) {
            query = query.in('id', recipeIdsFromTags);
        }

        // Sortowanie i paginacja
        const { data, error, count } = await query
            .order(column, { ascending })
            .range(from, to);

        if (error) {
            return {
                data: {
                    data: [],
                    pagination: { currentPage: 1, totalPages: 0, totalItems: 0 },
                },
                error,
            };
        }

        const totalItems = count ?? 0;
        const totalPages = Math.ceil(totalItems / limit);

        return {
            data: {
                data: data ?? [],
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems,
                },
            },
            error: null,
        };
    }

    /**
     * Pobiera ID przepisów które mają wszystkie podane tagi
     */
    private async getRecipeIdsByTags(
        tagNames: string[],
        userId: string
    ): Promise<number[]> {
        // Pobierz ID tagów
        const { data: tagData } = await this.supabase
            .from('tags')
            .select('id')
            .eq('user_id', userId)
            .in('name', tagNames);

        if (!tagData || tagData.length === 0) {
            return [];
        }

        const tagIds = tagData.map((t) => t.id);

        // Znajdź przepisy które mają WSZYSTKIE te tagi
        const { data: recipeTagsData } = await this.supabase
            .from('recipe_tags')
            .select('recipe_id, tag_id')
            .in('tag_id', tagIds);

        if (!recipeTagsData) {
            return [];
        }

        // Grupuj po recipe_id i sprawdź czy przepis ma wszystkie tagi
        const recipeTagCount = new Map<number, Set<number>>();

        for (const rt of recipeTagsData) {
            if (!recipeTagCount.has(rt.recipe_id)) {
                recipeTagCount.set(rt.recipe_id, new Set());
            }
            recipeTagCount.get(rt.recipe_id)!.add(rt.tag_id);
        }

        // Zwróć tylko przepisy które mają wszystkie wymagane tagi
        const result: number[] = [];
        for (const [recipeId, tagSet] of recipeTagCount) {
            if (tagIds.every((tagId) => tagSet.has(tagId))) {
                result.push(recipeId);
            }
        }

        return result;
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
}

