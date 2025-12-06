import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    inject,
    signal,
    computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

import { RecipesService } from '../services/recipes.service';
import { RecipeDetailDto, ApiError } from '../../../../../shared/contracts/types';

import { RecipeHeaderComponent } from './components/recipe-header/recipe-header.component';
import { RecipeImageComponent } from './components/recipe-image/recipe-image.component';
import { RecipeContentListComponent } from './components/recipe-content-list/recipe-content-list.component';
import { RecipeActionsComponent } from './components/recipe-actions/recipe-actions.component';
import {
    ConfirmDialogComponent,
    ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
    AddToCollectionDialogComponent,
    AddToCollectionDialogData,
    AddToCollectionDialogResult,
} from '../../../shared/components/add-to-collection-dialog/add-to-collection-dialog.component';

interface RecipeDetailsState {
    recipe: RecipeDetailDto | null;
    isLoading: boolean;
    error: ApiError | null;
}

@Component({
    selector: 'pych-recipe-detail-page',
    standalone: true,
    imports: [
        RouterLink,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        RecipeHeaderComponent,
        RecipeImageComponent,
        RecipeContentListComponent,
        RecipeActionsComponent,
    ],
    templateUrl: './recipe-detail-page.component.html',
    styleUrl: './recipe-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeDetailPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly recipesService = inject(RecipesService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly dialog = inject(MatDialog);

    readonly state = signal<RecipeDetailsState>({
        recipe: null,
        isLoading: true,
        error: null,
    });

    readonly recipe = computed(() => this.state().recipe);
    readonly isLoading = computed(() => this.state().isLoading);
    readonly error = computed(() => this.state().error);
    readonly hasRecipe = computed(() => this.state().recipe !== null);

    ngOnInit(): void {
        const idParam = this.route.snapshot.paramMap.get('id');

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
    }

    private loadRecipe(id: number): void {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        this.recipesService.getRecipeById(id).subscribe({
            next: (recipe) => {
                this.state.update((s) => ({
                    ...s,
                    recipe,
                    isLoading: false,
                }));
            },
            error: (err) => {
                const apiError: ApiError = {
                    message: err.message || 'Wystąpił nieoczekiwany błąd',
                    status: err.status || 500,
                };
                this.state.update((s) => ({
                    ...s,
                    error: apiError,
                    isLoading: false,
                }));
            },
        });
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
        if (recipe) {
            this.router.navigate(['/recipes', recipe.id, 'edit']);
        }
    }

    onDelete(): void {
        const recipe = this.recipe();
        if (!recipe || recipe.id === null) return;

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
        if (!recipe || recipe.id === null) return;

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
        this.router.navigate(['/recipes']);
    }
}
