import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { filter, switchMap } from 'rxjs';

import { CollectionsApiService } from '../../../core/services/collections-api.service';
import {
    CollectionListItemDto,
    CreateCollectionCommand,
} from '../../../../../shared/contracts/types';
import {
    CollectionsListState,
    CollectionFormDialogData,
} from './models/collections-list.model';
import {
    ConfirmDialogComponent,
    ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CollectionListComponent } from './components/collection-list/collection-list.component';
import { CollectionFormComponent } from './components/collection-form/collection-form.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

@Component({
    selector: 'pych-collections-list-page',
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatDialogModule,
        MatSnackBarModule,
        CollectionListComponent,
        PageHeaderComponent,
        EmptyStateComponent,
    ],
    templateUrl: './collections-list-page.component.html',
    styleUrl: './collections-list-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionsListPageComponent implements OnInit {
    private readonly collectionsApi = inject(CollectionsApiService);
    private readonly dialog = inject(MatDialog);
    private readonly snackBar = inject(MatSnackBar);

    /** Stan strony */
    readonly state = signal<CollectionsListState>({
        collections: [],
        isLoading: true,
        error: null,
    });

    /** Computed signals */
    readonly collections = computed(() => this.state().collections);
    readonly isLoading = computed(() => this.state().isLoading);
    readonly error = computed(() => this.state().error);
    readonly isEmpty = computed(
        () => !this.state().isLoading && this.state().collections.length === 0
    );

    ngOnInit(): void {
        this.loadCollections();
    }

    /**
     * Ładuje listę kolekcji z API
     */
    loadCollections(): void {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        this.collectionsApi.getCollections().subscribe({
            next: (collections) => {
                this.state.update((s) => ({
                    ...s,
                    collections,
                    isLoading: false,
                }));
            },
            error: () => {
                this.state.update((s) => ({
                    ...s,
                    isLoading: false,
                    error: 'Nie udało się wczytać kolekcji. Spróbuj ponownie później.',
                }));
                this.showError('Nie udało się wczytać kolekcji.');
            },
        });
    }

    /**
     * Otwiera dialog tworzenia nowej kolekcji
     */
    openCreateDialog(): void {
        const dialogData: CollectionFormDialogData = {
            mode: 'create',
        };

        this.dialog
            .open(CollectionFormComponent, {
                data: dialogData,
                width: '500px',
                disableClose: false,
            })
            .afterClosed()
            .pipe(
                filter((result): result is CreateCollectionCommand => !!result),
                switchMap((command) => this.collectionsApi.createCollection(command))
            )
            .subscribe({
                next: (newCollection) => {
                    this.state.update((s) => ({
                        ...s,
                        collections: [...s.collections, newCollection].sort((a, b) =>
                            a.name.localeCompare(b.name)
                        ),
                    }));
                    this.showSuccess('Kolekcja została utworzona.');
                },
                error: () => {
                    this.showError('Nie udało się utworzyć kolekcji.');
                },
            });
    }

    /**
     * Otwiera dialog edycji kolekcji
     */
    openEditDialog(collection: CollectionListItemDto): void {
        const dialogData: CollectionFormDialogData = {
            mode: 'edit',
            collection,
        };

        this.dialog
            .open(CollectionFormComponent, {
                data: dialogData,
                width: '500px',
                disableClose: false,
            })
            .afterClosed()
            .pipe(
                filter((result): result is CreateCollectionCommand => !!result),
                switchMap((command) =>
                    this.collectionsApi.updateCollection(collection.id, command)
                )
            )
            .subscribe({
                next: (updatedCollection) => {
                    this.state.update((s) => ({
                        ...s,
                        collections: s.collections
                            .map((c) =>
                                c.id === updatedCollection.id ? updatedCollection : c
                            )
                            .sort((a, b) => a.name.localeCompare(b.name)),
                    }));
                    this.showSuccess('Kolekcja została zaktualizowana.');
                },
                error: () => {
                    this.showError('Nie udało się zaktualizować kolekcji.');
                },
            });
    }

    /**
     * Otwiera dialog potwierdzenia usunięcia
     */
    openDeleteDialog(collection: CollectionListItemDto): void {
        const dialogData: ConfirmDialogData = {
            title: 'Usuń kolekcję',
            message: `Czy na pewno chcesz usunąć kolekcję "${collection.name}"? Ta operacja jest nieodwracalna.`,
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
                switchMap(() => this.collectionsApi.deleteCollection(collection.id))
            )
            .subscribe({
                next: () => {
                    this.state.update((s) => ({
                        ...s,
                        collections: s.collections.filter(
                            (c) => c.id !== collection.id
                        ),
                    }));
                    this.showSuccess('Kolekcja została usunięta.');
                },
                error: () => {
                    this.showError('Nie udało się usunąć kolekcji.');
                },
            });
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
