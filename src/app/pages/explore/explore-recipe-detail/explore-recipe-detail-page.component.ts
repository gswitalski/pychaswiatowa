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
import { map } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ExploreRecipesService } from '../../../core/services/explore-recipes.service';
import { RecipesService } from '../../recipes/services/recipes.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import {
    RecipeDetailDto,
    ApiError,
} from '../../../../../shared/contracts/types';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { RecipeHeaderComponent } from '../../recipes/recipe-detail/components/recipe-header/recipe-header.component';
import { RecipeImageComponent } from '../../recipes/recipe-detail/components/recipe-image/recipe-image.component';
import { RecipeContentListComponent } from '../../recipes/recipe-detail/components/recipe-content-list/recipe-content-list.component';
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
 * Stan komponentu szczegółów przepisu explore
 */
interface ExploreRecipeDetailState {
    recipe: RecipeDetailDto | null;
    isLoading: boolean;
    error: ApiError | null;
}

/**
 * Tryb nagłówka strony - określa jakie akcje są dostępne
 * - 'guest': niezalogowany użytkownik - CTA do logowania
 * - 'addToCollection': zalogowany, ale nie jest właścicielem - przycisk dodaj do kolekcji
 * - 'ownerActions': zalogowany i jest właścicielem - pełne akcje (edytuj, usuń, dodaj do kolekcji)
 */
type HeaderMode = 'guest' | 'addToCollection' | 'ownerActions';

/**
 * Komponent strony szczegółów przepisu w kontekście explore (publiczny widok).
 * Używany dla ścieżki /explore/recipes/:id.
 *
 * Zasada dostępu:
 * - visibility=PUBLIC → dostępne dla wszystkich (także gości)
 * - visibility!=PUBLIC → dostępne tylko dla zalogowanego autora
 * - pozostałe przypadki → 404
 */
@Component({
    selector: 'pych-explore-recipe-detail-page',
    standalone: true,
    imports: [
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
    templateUrl: './explore-recipe-detail-page.component.html',
    styleUrl: './explore-recipe-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreRecipeDetailPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly exploreRecipesService = inject(ExploreRecipesService);
    private readonly recipesService = inject(RecipesService);
    private readonly supabase = inject(SupabaseService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly dialog = inject(MatDialog);
    private readonly destroyRef = inject(DestroyRef);

    readonly state = signal<ExploreRecipeDetailState>({
        recipe: null,
        isLoading: true,
        error: null,
    });

    /** Czy użytkownik jest zalogowany */
    readonly isAuthenticated = signal<boolean>(false);

    /** ID aktualnie zalogowanego użytkownika (null jeśli gość) */
    readonly currentUserId = signal<string | null>(null);

    readonly recipe = computed(() => this.state().recipe);
    readonly isLoading = computed(() => this.state().isLoading);
    readonly error = computed(() => this.state().error);
    readonly hasRecipe = computed(() => this.state().recipe !== null);

    /** Tytuł strony - nazwa przepisu lub fallback */
    readonly pageTitle = computed(() => this.state().recipe?.name ?? 'Szczegóły przepisu');

    /**
     * Czy aktualnie zalogowany użytkownik jest właścicielem przepisu
     */
    readonly isOwner = computed(() => {
        const recipe = this.recipe();
        const userId = this.currentUserId();

        if (!recipe || !userId) return false;
        return recipe.user_id === userId;
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

                if (isNaN(id) || id <= 0) {
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
     * Ładuje przepis przez endpoint explore
     * (opcjonalne uwierzytelnienie - PUBLIC dla wszystkich, nie-PUBLIC tylko dla autora)
     */
    private loadRecipe(id: number): void {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        this.exploreRecipesService.getExploreRecipeById(id).subscribe({
            next: (recipe) => {
                this.state.update((s) => ({
                    ...s,
                    recipe,
                    isLoading: false,
                }));
            },
            error: (err) => {
                this.handleLoadError(err);
            },
        });
    }

    /**
     * Obsługuje błąd ładowania przepisu
     */
    private handleLoadError(err: Error & { status?: number }): void {
        let message = err.message || 'Wystąpił nieoczekiwany błąd';
        const status = err.status || 500;

        // Specjalne komunikaty dla różnych statusów
        if (status === 404) {
            if (!this.isAuthenticated()) {
                message = 'Ten przepis nie został znaleziony lub jest prywatny. Zaloguj się, aby uzyskać dostęp.';
            } else {
                message = 'Przepis nie został znaleziony lub nie masz do niego dostępu.';
            }
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
                this.router.navigate(['/my-recipes']);
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

    /**
     * Powrót do strony explore
     */
    onBackToExplore(): void {
        this.router.navigate(['/explore']);
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
