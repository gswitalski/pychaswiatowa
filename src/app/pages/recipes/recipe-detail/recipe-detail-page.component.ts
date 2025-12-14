import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    inject,
    signal,
    computed,
    DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { map, catchError } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RecipesService } from '../services/recipes.service';
import { PublicRecipesService } from '../../../core/services/public-recipes.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
    RecipeDetailDto,
    PublicRecipeDetailDto,
    ApiError,
} from '../../../../../shared/contracts/types';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { RecipeHeaderComponent } from './components/recipe-header/recipe-header.component';
import { RecipeImageComponent } from './components/recipe-image/recipe-image.component';
import { RecipeContentListComponent } from './components/recipe-content-list/recipe-content-list.component';
import {
    ConfirmDialogComponent,
    ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
    AddToCollectionDialogComponent,
    AddToCollectionDialogData,
    AddToCollectionDialogResult,
} from '../../../shared/components/add-to-collection-dialog/add-to-collection-dialog.component';

/**
 * Uniwersalny typ przepisu - może być RecipeDetailDto (dla właściciela) lub PublicRecipeDetailDto (dla innych)
 */
type UnifiedRecipe = RecipeDetailDto | PublicRecipeDetailDto;

/**
 * Stan komponentu szczegółów przepisu
 */
interface RecipeDetailsState {
    recipe: UnifiedRecipe | null;
    isLoading: boolean;
    error: ApiError | null;
    /** Czy przepis został załadowany przez publiczne API */
    isPublicRecipe: boolean;
}

/**
 * Tryb nagłówka strony - określa jakie akcje są dostępne
 * - 'guest': niezalogowany użytkownik - CTA do logowania
 * - 'addToCollection': zalogowany, ale nie jest właścicielem - przycisk dodaj do kolekcji
 * - 'ownerActions': zalogowany i jest właścicielem - pełne akcje (edytuj, usuń, dodaj do kolekcji)
 */
type HeaderMode = 'guest' | 'addToCollection' | 'ownerActions';

@Component({
    selector: 'pych-recipe-detail-page',
    standalone: true,
    imports: [
        DatePipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        PageHeaderComponent,
        RecipeHeaderComponent,
        RecipeImageComponent,
        RecipeContentListComponent,
    ],
    templateUrl: './recipe-detail-page.component.html',
    styleUrl: './recipe-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeDetailPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly recipesService = inject(RecipesService);
    private readonly publicRecipesService = inject(PublicRecipesService);
    private readonly supabase = inject(SupabaseService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly dialog = inject(MatDialog);
    private readonly destroyRef = inject(DestroyRef);

    readonly state = signal<RecipeDetailsState>({
        recipe: null,
        isLoading: true,
        error: null,
        isPublicRecipe: false,
    });

    /** Czy użytkownik jest zalogowany */
    readonly isAuthenticated = signal<boolean>(false);

    /** ID aktualnie zalogowanego użytkownika (null jeśli gość) */
    readonly currentUserId = signal<string | null>(null);

    readonly recipe = computed(() => this.state().recipe);
    readonly isLoading = computed(() => this.state().isLoading);
    readonly error = computed(() => this.state().error);
    readonly hasRecipe = computed(() => this.state().recipe !== null);
    readonly isPublicRecipe = computed(() => this.state().isPublicRecipe);

    /** Tytuł strony - nazwa przepisu lub fallback */
    readonly pageTitle = computed(() => this.state().recipe?.name ?? 'Szczegóły przepisu');

    /**
     * Czy aktualnie zalogowany użytkownik jest właścicielem przepisu
     */
    readonly isOwner = computed(() => {
        const recipe = this.recipe();
        const userId = this.currentUserId();

        if (!recipe || !userId) return false;

        // Dla RecipeDetailDto sprawdzamy user_id
        if (this.isRecipeDetailDto(recipe)) {
            return recipe.user_id === userId;
        }

        // Dla PublicRecipeDetailDto sprawdzamy author.id
        return recipe.author.id === userId;
    });

    /**
     * Tryb nagłówka - określa jakie akcje są dostępne
     */
    readonly headerMode = computed<HeaderMode>(() => {
        if (!this.isAuthenticated()) {
            return 'guest';
        }
        return this.isOwner() ? 'ownerActions' : 'addToCollection';
    });

    /**
     * Czy pokazać nagłówek strony (pych-page-header)
     * Dla gości pokazujemy tylko jeśli mamy przepis
     */
    readonly showPageHeader = computed(() => {
        return this.hasRecipe() && (this.isAuthenticated() || this.headerMode() === 'guest');
    });

    /**
     * Informacje o autorze dla wyświetlenia w footerze
     */
    readonly authorInfo = computed(() => {
        const recipe = this.recipe();
        if (!recipe) return null;

        if (this.isRecipeDetailDto(recipe)) {
            // Dla własnych przepisów nie pokazujemy autora
            return null;
        }

        return {
            username: recipe.author.username,
            createdAt: recipe.created_at,
        };
    });

    async ngOnInit(): Promise<void> {
        // Sprawdź stan uwierzytelnienia
        await this.checkAuthStatus();

        // Subskrybuj się na zmiany parametru 'id' w URL
        this.route.paramMap
            .pipe(
                map((params) => params.get('id')),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((idParam) => {
                if (!idParam) {
                    this.handleInvalidId();
                    return;
                }

                const id = parseInt(idParam, 10);

                if (isNaN(id)) {
                    this.handleInvalidId();
                    return;
                }

                this.loadRecipe(id);
            });
    }

    /**
     * Sprawdza stan uwierzytelnienia użytkownika
     */
    private async checkAuthStatus(): Promise<void> {
        try {
            const {
                data: { session },
            } = await this.supabase.auth.getSession();

            if (session?.user) {
                this.isAuthenticated.set(true);
                this.currentUserId.set(session.user.id);
            } else {
                this.isAuthenticated.set(false);
                this.currentUserId.set(null);
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.isAuthenticated.set(false);
            this.currentUserId.set(null);
        }
    }

    /**
     * Ładuje przepis - najpierw próbuje przez prywatne API (dla zalogowanych),
     * jeśli nie ma dostępu - próbuje przez publiczne API
     */
    private loadRecipe(id: number): void {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        if (this.isAuthenticated()) {
            // Zalogowany użytkownik - najpierw próbuj przez prywatne API
            this.recipesService.getRecipeById(id)
                .pipe(
                    catchError((err) => {
                        // Jeśli błąd 403/404 - spróbuj przez publiczne API
                        if (err.status === 403 || err.status === 404) {
                            return this.loadPublicRecipe(id);
                        }
                        throw err;
                    })
                )
                .subscribe({
                    next: (recipe) => {
                        this.state.update((s) => ({
                            ...s,
                            recipe,
                            isLoading: false,
                            isPublicRecipe: false,
                        }));
                    },
                    error: (err) => {
                        this.handleLoadError(err);
                    },
                });
        } else {
            // Gość - tylko publiczne API
            this.publicRecipesService.getPublicRecipeById(id).subscribe({
                next: (recipe) => {
                    this.state.update((s) => ({
                        ...s,
                        recipe,
                        isLoading: false,
                        isPublicRecipe: true,
                    }));
                },
                error: (err) => {
                    this.handleLoadError(err, true);
                },
            });
        }
    }

    /**
     * Ładuje przepis przez publiczne API (jako fallback)
     */
    private loadPublicRecipe(id: number) {
        return this.publicRecipesService.getPublicRecipeById(id).pipe(
            map((recipe) => {
                this.state.update((s) => ({
                    ...s,
                    isPublicRecipe: true,
                }));
                return recipe;
            })
        );
    }

    /**
     * Obsługuje błąd ładowania przepisu
     */
    private handleLoadError(err: Error & { status?: number }, isGuest = false): void {
        let message = err.message || 'Wystąpił nieoczekiwany błąd';
        let status = err.status || 500;

        // Specjalne komunikaty dla gości
        if (isGuest && (status === 403 || status === 404)) {
            message = 'Ten przepis jest prywatny lub nie istnieje. Zaloguj się, aby uzyskać dostęp do swoich przepisów.';
            status = 403;
        }

        const apiError: ApiError = { message, status };
        this.state.update((s) => ({
            ...s,
            error: apiError,
            isLoading: false,
        }));
    }

    private handleInvalidId(): void {
        this.state.update((s) => ({
            ...s,
            isLoading: false,
            error: {
                message: 'Nieprawidłowy identyfikator przepisu',
                status: 400,
            },
        }));
    }

    /**
     * Type guard sprawdzający czy przepis to RecipeDetailDto
     */
    isRecipeDetailDto(recipe: UnifiedRecipe): recipe is RecipeDetailDto {
        return 'user_id' in recipe;
    }

    onEdit(): void {
        const recipe = this.recipe();
        if (recipe && this.isOwner()) {
            this.router.navigate(['/recipes', recipe.id, 'edit']);
        }
    }

    onDelete(): void {
        const recipe = this.recipe();
        if (!recipe || recipe.id === null || !this.isOwner()) return;

        const recipeName = recipe.name ?? 'Bez nazwy';
        const recipeId = recipe.id;

        const dialogData: ConfirmDialogData = {
            title: 'Usuń przepis',
            message: `Czy na pewno chcesz usunąć przepis "${recipeName}"? Ta operacja jest nieodwracalna.`,
            confirmText: 'Usuń',
            cancelText: 'Anuluj',
            confirmColor: 'warn',
        };

        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            data: dialogData,
            width: '400px',
        });

        dialogRef.afterClosed().subscribe((confirmed: boolean) => {
            if (confirmed) {
                this.deleteRecipe(recipeId);
            }
        });
    }

    private deleteRecipe(id: number): void {
        this.recipesService.deleteRecipe(id).subscribe({
            next: () => {
                this.snackBar.open('Przepis został usunięty', 'OK', {
                    duration: 3000,
                });
                this.router.navigate(['/recipes']);
            },
            error: (err) => {
                this.snackBar.open(
                    err.message || 'Nie udało się usunąć przepisu',
                    'OK',
                    { duration: 5000 }
                );
            },
        });
    }

    onAddToCollection(): void {
        const recipe = this.recipe();
        if (!recipe || recipe.id === null || !this.isAuthenticated()) return;

        const dialogData: AddToCollectionDialogData = {
            recipeId: recipe.id,
            recipeName: recipe.name ?? 'Bez nazwy',
        };

        const dialogRef = this.dialog.open(AddToCollectionDialogComponent, {
            data: dialogData,
            width: '450px',
        });

        dialogRef.afterClosed().subscribe((result: AddToCollectionDialogResult) => {
            if (result?.action === 'added') {
                this.snackBar.open(
                    `Dodano do kolekcji "${result.collectionName}"`,
                    'OK',
                    { duration: 3000 }
                );
            } else if (result?.action === 'created') {
                this.snackBar.open(
                    `Utworzono kolekcję "${result.collectionName}" i dodano przepis`,
                    'OK',
                    { duration: 3000 }
                );
            }
        });
    }

    onBackToList(): void {
        // Jeśli gość - wróć do explore, jeśli zalogowany - do recipes
        if (this.isAuthenticated()) {
            this.router.navigate(['/recipes']);
        } else {
            this.router.navigate(['/explore']);
        }
    }

    /**
     * Nawigacja do strony logowania z returnUrl
     */
    onLogin(): void {
        const currentUrl = this.router.url;
        this.router.navigate(['/login'], {
            queryParams: { returnUrl: currentUrl },
        });
    }

    /**
     * Nawigacja do strony rejestracji z returnUrl
     */
    onRegister(): void {
        const currentUrl = this.router.url;
        this.router.navigate(['/register'], {
            queryParams: { returnUrl: currentUrl },
        });
    }
}
