import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    signal,
    OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subject, takeUntil, filter, switchMap, catchError, of } from 'rxjs';

import { CollectionsApiService } from '../../../core/services/collections-api.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import {
    ConfirmDialogComponent,
    ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
    RecipeListComponent,
    RecipeListItemViewModel,
} from '../../../shared/components/recipe-list/recipe-list.component';
import { CollectionHeaderComponent } from './components/collection-header/collection-header.component';
import {
    CollectionDetailsViewModel,
    initialCollectionDetailsState,
    CollectionDetailsErrorKind,
} from './models/collection-details.model';

@Component({
    selector: 'pych-collection-details-page',
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatDialogModule,
        PageHeaderComponent,
        RecipeListComponent,
        CollectionHeaderComponent,
    ],
    templateUrl: './collection-details-page.component.html',
    styleUrl: './collection-details-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionDetailsPageComponent implements OnDestroy {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly collectionsApi = inject(CollectionsApiService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly dialog = inject(MatDialog);
    private readonly destroy$ = new Subject<void>();

    /** Limit techniczny dla batch recipes */
    private readonly RECIPES_LIMIT = 500;

    /** Stan widoku */
    readonly state = signal<CollectionDetailsViewModel>(initialCollectionDetailsState);

    /** ID kolekcji z parametru URL */
    readonly collectionId = signal<number | null>(null);

    /** Computed signals */
    readonly isLoading = computed(() => this.state().isLoading);
    readonly error = computed(() => this.state().error);
    readonly collectionData = computed(() => ({
        name: this.state().name,
        description: this.state().description,
    }));
    readonly recipes = computed(() => this.state().recipes);
    readonly recipesPageInfo = computed(() => this.state().recipesPageInfo);
    readonly isEmpty = computed(
        () => !this.state().isLoading && this.state().recipes.length === 0 && !this.state().error
    );
    readonly hasData = computed(
        () => !this.state().isLoading && !this.state().error && this.state().id > 0
    );
    readonly isTruncated = computed(() => this.state().recipesPageInfo?.truncated === true);
    readonly totalRecipesCount = computed(() => this.state().recipesPageInfo?.returned ?? 0);
    
    readonly recipeListItems = computed<RecipeListItemViewModel[]>(() =>
        this.state().recipes.map((recipe) => ({
            card: {
                id: recipe.id,
                name: recipe.name,
                imageUrl: recipe.image_path,
                categoryName: recipe.category_name ?? null,
                isTermorobot: recipe.is_termorobot ?? false,
            },
            isOwnRecipe: recipe.is_owner,
            inMyCollections: recipe.in_my_collections,
        }))
    );

    /** Page title - collection name or fallback */
    readonly pageTitle = computed(() => this.state().name || 'Szczegóły kolekcji');

    constructor() {
        // Efekt nasłuchujący na zmiany parametru ID w URL
        effect(() => {
            const id = this.collectionId();

            if (id !== null) {
                this.loadCollectionDetails(id);
            }
        });

        // Subskrypcja na parametry routingu
        this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
            const idParam = params.get('id');
            const id = idParam ? parseInt(idParam, 10) : null;

            if (id === null || isNaN(id) || id <= 0) {
                this.state.update((s) => ({
                    ...s,
                    isLoading: false,
                    error: {
                        kind: 'invalid_id',
                        message: 'Nieprawidłowy identyfikator kolekcji.',
                    },
                }));
                return;
            }

            this.collectionId.set(id);
        });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Obsługuje żądanie usunięcia przepisu z kolekcji
     */
    onRemoveRecipe(recipeId: number): void {
        const recipe = this.state().recipes.find((r) => r.id === recipeId);
        const recipeName = recipe?.name ?? 'ten przepis';

        const dialogData: ConfirmDialogData = {
            title: 'Usuń z kolekcji',
            message: `Czy na pewno chcesz usunąć "${recipeName}" z tej kolekcji?`,
            confirmText: 'Usuń',
            cancelText: 'Anuluj',
            confirmColor: 'warn',
        };

        this.dialog
            .open(ConfirmDialogComponent, {
                data: dialogData,
                width: '400px',
            })
            .afterClosed()
            .pipe(
                filter((confirmed) => confirmed === true),
                switchMap(() => {
                    const collectionId = this.collectionId();
                    if (collectionId === null) {
                        throw new Error('Brak ID kolekcji');
                    }
                    // Sygnalizuj reload (bez zerowania listy)
                    this.state.update((s) => ({ ...s, isLoading: true }));
                    
                    return this.collectionsApi.removeRecipeFromCollection(collectionId, recipeId);
                }),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: () => {
                    this.showSuccess('Przepis został usunięty z kolekcji.');
                    // Odśwież dane (utrzymując poprzednie przepisy widoczne do momentu załadowania)
                    this.reloadCollectionDetails();
                },
                error: () => {
                    // Wyłącz loading i przywróć stan
                    this.state.update((s) => ({ ...s, isLoading: false }));
                    this.showError('Nie udało się usunąć przepisu z kolekcji.');
                },
            });
    }

    /**
     * Nawiguje z powrotem do listy kolekcji
     */
    navigateBack(): void {
        this.router.navigate(['/collections']);
    }

    /**
     * Ponawia ładowanie kolekcji (retry)
     */
    retry(): void {
        const id = this.collectionId();
        if (id !== null) {
            this.loadCollectionDetails(id);
        }
    }

    /**
     * Ładuje szczegóły kolekcji z API (jednorazowo, bez paginacji)
     */
    private loadCollectionDetails(id: number): void {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        this.collectionsApi
            .getCollectionDetails(id, this.RECIPES_LIMIT)
            .pipe(
                catchError((err) => {
                    const error = this.parseError(err);
                    this.state.update((s) => ({
                        ...s,
                        isLoading: false,
                        error,
                    }));
                    return of(null);
                }),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: (details) => {
                    if (details) {
                        this.state.update((s) => ({
                            ...s,
                            id: details.id,
                            name: details.name,
                            description: details.description,
                            recipes: details.recipes.data,
                            recipesPageInfo: details.recipes.pageInfo,
                            isLoading: false,
                            error: null,
                        }));
                    }
                },
            });
    }

    /**
     * Przeładowuje kolekcję (używane po usunięciu przepisu)
     * Utrzymuje poprzednie dane widoczne i używa state.update()
     */
    private reloadCollectionDetails(): void {
        const id = this.collectionId();
        if (id === null) return;

        this.collectionsApi
            .getCollectionDetails(id, this.RECIPES_LIMIT)
            .pipe(
                catchError((err) => {
                    const error = this.parseError(err);
                    this.state.update((s) => ({
                        ...s,
                        isLoading: false,
                        error,
                    }));
                    return of(null);
                }),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: (details) => {
                    if (details) {
                        // Aktualizuj dane bez zerowania (state.update)
                        this.state.update((s) => ({
                            ...s,
                            id: details.id,
                            name: details.name,
                            description: details.description,
                            recipes: details.recipes.data,
                            recipesPageInfo: details.recipes.pageInfo,
                            isLoading: false,
                            error: null,
                        }));
                    }
                },
            });
    }

    /**
     * Parsuje błąd z API i zwraca typowany error object
     */
    private parseError(error: unknown): { kind: CollectionDetailsErrorKind; message: string } {
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            
            if (msg.includes('nie znaleziono') || msg.includes('not found') || msg.includes('404')) {
                return {
                    kind: 'not_found',
                    message: 'Nie znaleziono kolekcji. Być może została usunięta.',
                };
            }
            
            if (msg.includes('forbidden') || msg.includes('403') || msg.includes('brak dostępu')) {
                return {
                    kind: 'forbidden',
                    message: 'Nie masz dostępu do tej kolekcji.',
                };
            }
            
            if (msg.includes('500') || msg.includes('internal') || msg.includes('server')) {
                return {
                    kind: 'server',
                    message: 'Wystąpił błąd serwera. Spróbuj ponownie później.',
                };
            }
        }
        
        return {
            kind: 'unknown',
            message: 'Wystąpił nieoczekiwany błąd podczas ładowania kolekcji.',
        };
    }

    /**
     * Wyświetla komunikat o błędzie
     */
    private showError(message: string): void {
        this.snackBar.open(message, 'Zamknij', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['error-snackbar'],
        });
    }

    /**
     * Wyświetla komunikat o sukcesie
     */
    private showSuccess(message: string): void {
        this.snackBar.open(message, 'Zamknij', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
        });
    }
}


