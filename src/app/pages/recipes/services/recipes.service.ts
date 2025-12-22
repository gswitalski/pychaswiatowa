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
    UploadRecipeImageResponseDto,
    CursorPaginatedResponseDto,
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
    /** Widok: 'my_recipes' - moje przepisy + cudze z moich kolekcji, domyślnie wszystkie */
    view?: 'my_recipes';
    /** Filtr termorobot: true = tylko termorobot, false = bez termorobota, null/undefined = wszystkie */
    termorobot?: boolean | null;
}

/**
 * Parametry zapytania do pobierania feedu przepisów (cursor-based)
 */
export interface GetRecipesFeedParams {
    /** Cursor do pobrania kolejnej strony (opcjonalny) */
    cursor?: string;
    /** Liczba elementów na stronie */
    limit?: number;
    /** Format: 'column.direction' np. 'created_at.desc' */
    sort?: string;
    /** Fraza do wyszukiwania w nazwie przepisu */
    search?: string;
    /** ID kategorii do filtrowania */
    categoryId?: number | null;
    /** Lista nazw tagów do filtrowania */
    tags?: string[];
    /** Widok: 'my_recipes' - moje przepisy + cudze z moich kolekcji, domyślnie wszystkie */
    view?: 'my_recipes';
    /** Filtr termorobot: true = tylko termorobot, false = bez termorobota, null/undefined = wszystkie */
    termorobot?: boolean | null;
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

        if (params.view) {
            queryParams.append('view', params.view);
        }

        if (params.termorobot !== null && params.termorobot !== undefined) {
            queryParams.append('filter[termorobot]', params.termorobot.toString());
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
     * Pobiera feed przepisów z cursor-based pagination.
     * Wywołuje GET /functions/v1/recipes/feed z parametrami zapytania.
     *
     * @param params Parametry zapytania (cursor, limit, sort, search, filtry)
     * @returns Observable z listą przepisów i metadanymi cursor pagination
     */
    getRecipesFeed(
        params: GetRecipesFeedParams = {}
    ): Observable<CursorPaginatedResponseDto<RecipeListItemDto>> {
        // Build query parameters
        const queryParams = new URLSearchParams();

        if (params.cursor) {
            queryParams.append('cursor', params.cursor);
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

        if (params.view) {
            queryParams.append('view', params.view);
        }

        if (params.termorobot !== null && params.termorobot !== undefined) {
            queryParams.append('filter[termorobot]', params.termorobot.toString());
        }

        const queryString = queryParams.toString();
        const endpoint = queryString ? `recipes/feed?${queryString}` : 'recipes/feed';

        return from(
            this.supabase.functions.invoke<CursorPaginatedResponseDto<RecipeListItemDto>>(
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
                    pageInfo: { hasMore: false, nextCursor: null },
                };
            })
        );
    }

    /**
     * Creates a new recipe
     * Note: Image should be uploaded separately using uploadRecipeImage() after recipe creation
     */
    createRecipe(
        command: CreateRecipeCommand,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _imageFile: File | null = null // Deprecated parameter, kept for compatibility
    ): Observable<{ id: number }> {
        return from(this.performCreateRecipe(command));
    }

    /**
     * Updates an existing recipe
     * Note: Image should be uploaded separately using uploadRecipeImage() or deleteRecipeImage()
     */
    updateRecipe(
        id: number,
        command: UpdateRecipeCommand,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _imageFile: File | null = null // Deprecated parameter, kept for compatibility
    ): Observable<void> {
        return from(this.performUpdateRecipe(id, command));
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
                    const error = new Error(response.error.message) as Error & { status: number };
                    error.status = this.extractStatusFromError(response.error) || 500;
                    throw error;
                }
            })
        );
    }

    /**
     * Wyciąga status HTTP z błędu zwróconego przez Supabase Functions
     * @private
     */
    private extractStatusFromError(error: { message?: string; status?: number; context?: { status?: number } }): number | null {
        if (error.status) return error.status;
        if (error.context?.status) return error.context.status;

        const message = error.message?.toLowerCase() || '';
        if (message.includes('not found') || message.includes('nie znaleziono')) {
            return 404;
        }
        if (message.includes('bad request') || message.includes('nieprawidłow')) {
            return 400;
        }
        if (message.includes('unauthorized') || message.includes('forbidden')) {
            return 403;
        }

        return null;
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

    /**
     * Uploads an image for a specific recipe
     * Uses multipart/form-data to send the file
     */
    uploadRecipeImage(
        recipeId: number,
        file: File
    ): Observable<UploadRecipeImageResponseDto> {
        return from(this.performUploadRecipeImage(recipeId, file));
    }

    /**
     * Deletes the image associated with a recipe
     */
    deleteRecipeImage(recipeId: number): Observable<void> {
        return from(this.performDeleteRecipeImage(recipeId));
    }

    private async performUploadRecipeImage(
        recipeId: number,
        file: File
    ): Promise<UploadRecipeImageResponseDto> {
        const {
            data: { session },
        } = await this.supabase.auth.getSession();

        if (!session) {
            throw new Error('Brak sesji użytkownika');
        }

        const formData = new FormData();
        formData.append('file', file);

        const functionUrl = `${environment.supabase.url}/functions/v1/recipes/${recipeId}/image`;

        try {
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    // Note: Don't set Content-Type for FormData - browser will set it automatically with boundary
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    message: 'Nie udało się przesłać zdjęcia',
                }));
                throw new Error(
                    errorData.message || 'Nie udało się przesłać zdjęcia'
                );
            }

            const data: UploadRecipeImageResponseDto = await response.json();
            return data;
        } catch (error) {
            throw new Error(
                error instanceof Error
                    ? error.message
                    : 'Nie udało się przesłać zdjęcia'
            );
        }
    }

    private async performDeleteRecipeImage(recipeId: number): Promise<void> {
        const {
            data: { session },
        } = await this.supabase.auth.getSession();

        if (!session) {
            throw new Error('Brak sesji użytkownika');
        }

        const functionUrl = `${environment.supabase.url}/functions/v1/recipes/${recipeId}/image`;

        try {
            const response = await fetch(functionUrl, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({
                    message: 'Nie udało się usunąć zdjęcia',
                }));
                throw new Error(
                    errorData.message || 'Nie udało się usunąć zdjęcia'
                );
            }
        } catch (error) {
            throw new Error(
                error instanceof Error
                    ? error.message
                    : 'Nie udało się usunąć zdjęcia'
            );
        }
    }

    private async performCreateRecipe(
        command: CreateRecipeCommand
    ): Promise<{ id: number }> {
        // Call backend API to create recipe
        // Note: Image is now handled separately via uploadRecipeImage()
        const response = await this.supabase.functions.invoke<{ id: number }>(
            'recipes',
            {
                method: 'POST',
                body: command,
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
        command: UpdateRecipeCommand
    ): Promise<void> {
        // Call backend API to update recipe
        // Note: Image is now handled separately via uploadRecipeImage() or deleteRecipeImage()
        const response = await this.supabase.functions.invoke(
            `recipes/${id}`,
            {
                method: 'PUT',
                body: command,
            }
        );

        if (response.error) {
            throw new Error(response.error.message);
        }
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

