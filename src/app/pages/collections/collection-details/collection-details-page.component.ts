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
import { PageEvent } from '@angular/material/paginator';
import { Subject, takeUntil, filter, switchMap } from 'rxjs';

import { CollectionsApiService } from '../../../core/services/collections-api.service';
import {
    ConfirmDialogComponent,
    ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { RecipeListComponent } from '../../recipes/recipes-list/components/recipe-list/recipe-list.component';
import { CollectionHeaderComponent } from './components/collection-header/collection-header.component';
import {
    CollectionDetailsViewModel,
    initialCollectionDetailsState,
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

    /** Rozmiar strony dla paginacji */
    private readonly pageSize = 12;

    /** Stan widoku */
    readonly state = signal<CollectionDetailsViewModel>(initialCollectionDetailsState);

    /** ID kolekcji z parametru URL */
    readonly collectionId = signal<number | null>(null);

    /** Aktualna strona */
    readonly currentPage = signal<number>(1);

    /** Computed signals */
    readonly isLoading = computed(() => this.state().isLoading);
    readonly error = computed(() => this.state().error);
    readonly collectionData = computed(() => ({
        name: this.state().name,
        description: this.state().description,
    }));
    readonly recipes = computed(() => this.state().recipes);
    readonly pagination = computed(() => this.state().pagination);
    readonly isEmpty = computed(
        () => !this.state().isLoading && this.state().recipes.length === 0 && !this.state().error
    );
    readonly hasData = computed(
        () => !this.state().isLoading && !this.state().error && this.state().id > 0
    );

    constructor() {
        // Efekt nasłuchujący na zmiany parametru ID w URL
        effect(() => {
            const id = this.collectionId();
            const page = this.currentPage();

            if (id !== null) {
                this.loadCollectionDetails(id, page);
            }
        });

        // Subskrypcja na parametry routingu
        this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
            const idParam = params.get('id');
            const id = idParam ? parseInt(idParam, 10) : null;

            if (id === null || isNaN(id)) {
                this.state.update((s) => ({
                    ...s,
                    isLoading: false,
                    error: 'Nieprawidłowy identyfikator kolekcji',
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
     * Obsługuje zmianę strony w paginatorze
     */
    onPageChange(event: PageEvent): void {
        this.currentPage.set(event.pageIndex + 1);
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
                    return this.collectionsApi.removeRecipeFromCollection(collectionId, recipeId);
                }),
                takeUntil(this.destroy$)
            )
            .subscribe({
                next: () => {
                    this.showSuccess('Przepis został usunięty z kolekcji.');
                    // Odśwież dane po usunięciu
                    this.refreshCurrentPage();
                },
                error: () => {
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
     * Ładuje szczegóły kolekcji z API
     */
    private loadCollectionDetails(id: number, page: number): void {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        this.collectionsApi
            .getCollectionDetails(id, page, this.pageSize)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (details) => {
                    this.state.update((s) => ({
                        ...s,
                        id: details.id,
                        name: details.name,
                        description: details.description,
                        recipes: details.recipes.data,
                        pagination: details.recipes.pagination,
                        isLoading: false,
                        error: null,
                    }));
                },
                error: (err) => {
                    const errorMessage = this.getErrorMessage(err);
                    this.state.update((s) => ({
                        ...s,
                        isLoading: false,
                        error: errorMessage,
                    }));
                },
            });
    }

    /**
     * Odświeża dane dla bieżącej strony
     */
    private refreshCurrentPage(): void {
        const id = this.collectionId();
        const page = this.currentPage();

        if (id !== null) {
            this.loadCollectionDetails(id, page);
        }
    }

    /**
     * Generuje komunikat błędu na podstawie typu błędu
     */
    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            if (error.message.includes('nie znaleziono') || error.message.includes('Not Found')) {
                return 'Nie znaleziono kolekcji. Być może została usunięta.';
            }
        }
        return 'Wystąpił błąd podczas ładowania kolekcji. Spróbuj ponownie później.';
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


