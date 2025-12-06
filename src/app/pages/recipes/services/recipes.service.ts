import { Injectable, inject } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
    RecipeDetailDto,
    CreateRecipeCommand,
    UpdateRecipeCommand,
    RecipeContent,
    TagDto,
} from '../../../../../shared/contracts/types';

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

