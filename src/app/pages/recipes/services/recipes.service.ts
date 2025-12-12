import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { environment } from '../../../../environments/environment';
import {
    RecipeDetailDto,
    CreateRecipeCommand,
    UpdateRecipeCommand,
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
        return from(
            this.supabase.functions.invoke<RecipeDetailDto>(`recipes/${id}`, {
                method: 'GET',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message);
                }
                if (!response.data) {
                    throw new Error('Przepis nie został znaleziony');
                }
                return response.data;
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
        return from(this.performCreateRecipe(command, imageFile));
    }

    /**
     * Updates an existing recipe
     */
    updateRecipe(
        id: number,
        command: UpdateRecipeCommand,
        imageFile: File | null
    ): Observable<void> {
        return from(this.performUpdateRecipe(id, command, imageFile));
    }

    /**
     * Deletes a recipe by its ID
     */
    deleteRecipe(id: number): Observable<void> {
        return from(
            this.supabase.functions.invoke(`recipes/${id}`, {
                method: 'DELETE',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message);
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


    private async performCreateRecipe(
        command: CreateRecipeCommand,
        imageFile: File | null
    ): Promise<{ id: number }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            throw new Error('Użytkownik niezalogowany');
        }

        let imagePath: string | null = null;

        // Upload image if provided (Storage operations are allowed in frontend)
        if (imageFile) {
            const uploadResult = await this.uploadImage(imageFile, user.id);
            if (uploadResult.error) {
                throw uploadResult.error;
            }
            imagePath = uploadResult.path;
        }

        // Prepare command with image path
        const createCommand = {
            ...command,
            image_path: imagePath,
        };

        // Call backend API to create recipe
        const response = await this.supabase.functions.invoke<{ id: number }>(
            'recipes',
            {
                method: 'POST',
                body: createCommand,
            }
        );

        if (response.error) {
            throw new Error(response.error.message);
        }

        if (!response.data) {
            throw new Error('Nie udało się utworzyć przepisu');
        }

        return response.data;
    }

    private async performUpdateRecipe(
        id: number,
        command: UpdateRecipeCommand,
        imageFile: File | null
    ): Promise<void> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            throw new Error('Użytkownik niezalogowany');
        }

        let imagePath: string | undefined = undefined;

        // Upload new image if provided (Storage operations are allowed in frontend)
        if (imageFile) {
            const uploadResult = await this.uploadImage(imageFile, user.id);
            if (uploadResult.error) {
                throw uploadResult.error;
            }
            imagePath = uploadResult.path ?? undefined;
        }

        // Prepare update command with image path if uploaded
        const updateCommand = imagePath
            ? { ...command, image_path: imagePath }
            : command;

        // Call backend API to update recipe
        const response = await this.supabase.functions.invoke(
            `recipes/${id}`,
            {
                method: 'PUT',
                body: updateCommand,
            }
        );

        if (response.error) {
            throw new Error(response.error.message);
        }
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

