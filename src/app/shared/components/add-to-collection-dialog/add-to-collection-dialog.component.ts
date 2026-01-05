import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    inject,
    signal,
    computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MatDialogModule,
    MAT_DIALOG_DATA,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CollectionsService } from './collections.service';
import {
    CollectionListItemDto,
    SetRecipeCollectionsCommand,
} from '../../../../../shared/contracts/types';

export interface AddToCollectionDialogData {
    recipeId: number;
    recipeName: string;
    initialCollectionIds: number[];
}

export interface AddToCollectionDialogResult {
    action: 'saved' | 'cancelled';
    collection_ids?: number[];
    added_ids?: number[];
    removed_ids?: number[];
}

@Component({
    selector: 'pych-add-to-collection-dialog',
    standalone: true,
    imports: [
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatListModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatCheckboxModule,
    ],
    templateUrl: './add-to-collection-dialog.component.html',
    styleUrl: './add-to-collection-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddToCollectionDialogComponent implements OnInit {
    readonly dialogRef = inject(MatDialogRef<AddToCollectionDialogComponent>);
    readonly data = inject<AddToCollectionDialogData>(MAT_DIALOG_DATA);
    private readonly collectionsService = inject(CollectionsService);
    private readonly snackBar = inject(MatSnackBar);

    // Kolekcje użytkownika
    readonly collections = signal<CollectionListItemDto[]>([]);
    readonly isLoading = signal(true);
    readonly loadError = signal<string | null>(null);

    // Wyszukiwanie
    readonly searchQuery = signal('');
    readonly filteredCollections = computed(() => {
        const query = this.searchQuery().trim().toLowerCase();
        const allCollections = this.collections();

        if (!query) {
            return allCollections;
        }

        return allCollections.filter((c) =>
            c.name.toLowerCase().includes(query)
        );
    });

    // Multi-select: zaznaczone kolekcje
    readonly selectedCollectionIds = signal<Set<number>>(new Set());

    // Licznik zaznaczonych kolekcji
    readonly selectedCount = computed(() => this.selectedCollectionIds().size);

    // Sekcja tworzenia nowej kolekcji
    readonly isCreatingNew = signal(false);
    readonly newCollectionName = signal('');
    readonly isCreatingCollection = signal(false);

    // Stan zapisu
    readonly isSaving = signal(false);

    ngOnInit(): void {
        // Guard clause: walidacja recipeId
        if (!this.data.recipeId || this.data.recipeId <= 0) {
            this.loadError.set('Nieprawidłowy identyfikator przepisu');
            this.isLoading.set(false);
            return;
        }

        // Inicjalizacja zaznaczonych kolekcji z pre-selekcji
        const initialIds = this.data.initialCollectionIds ?? [];
        const validIds = initialIds.filter((id) => id > 0);
        this.selectedCollectionIds.set(new Set(validIds));

        this.loadCollections();
    }

    private loadCollections(): void {
        this.collectionsService.getCollections().subscribe({
            next: (collections) => {
                this.collections.set(collections);
                this.isLoading.set(false);
            },
            error: (err) => {
                this.loadError.set(
                    err.message || 'Nie udało się pobrać kolekcji'
                );
                this.isLoading.set(false);
            },
        });
    }

    onSearchChange(query: string): void {
        this.searchQuery.set(query);
    }

    onToggleCollection(collectionId: number, checked: boolean): void {
        const currentSelection = new Set(this.selectedCollectionIds());

        if (checked) {
            currentSelection.add(collectionId);
        } else {
            currentSelection.delete(collectionId);
        }

        this.selectedCollectionIds.set(currentSelection);
    }

    isCollectionSelected(collectionId: number): boolean {
        return this.selectedCollectionIds().has(collectionId);
    }

    toggleCreateNew(): void {
        this.isCreatingNew.update((v) => !v);
    }

    onCreateCollection(): void {
        const name = this.newCollectionName().trim();

        // Guard clause: walidacja nazwy
        if (!name) {
            return;
        }

        this.isCreatingCollection.set(true);

        this.collectionsService
            .createCollection({ name, description: null })
            .subscribe({
                next: (newCollection) => {
                    // Dodaj nową kolekcję do listy
                    this.collections.update((current) => [...current, newCollection]);

                    // Automatyczne zaznaczenie nowej kolekcji
                    const currentSelection = new Set(this.selectedCollectionIds());
                    currentSelection.add(newCollection.id);
                    this.selectedCollectionIds.set(currentSelection);

                    // Resetuj formularz tworzenia
                    this.newCollectionName.set('');
                    this.isCreatingNew.set(false);
                    this.isCreatingCollection.set(false);

                    this.snackBar.open(
                        `Utworzono kolekcję "${newCollection.name}"`,
                        'OK',
                        { duration: 3000 }
                    );
                },
                error: (err) => {
                    this.isCreatingCollection.set(false);

                    if (err.status === 409) {
                        this.snackBar.open(
                            'Kolekcja o tej nazwie już istnieje',
                            'OK',
                            { duration: 4000 }
                        );
                    } else {
                        this.snackBar.open(
                            err.message || 'Nie udało się utworzyć kolekcji',
                            'OK',
                            { duration: 5000 }
                        );
                    }
                },
            });
    }

    onCancel(): void {
        this.dialogRef.close({ action: 'cancelled' } as AddToCollectionDialogResult);
    }

    onSave(): void {
        // Guard clause: walidacja recipeId
        if (!this.data.recipeId || this.data.recipeId <= 0) {
            return;
        }

        this.isSaving.set(true);

        // Przygotuj command z finalną listą kolekcji
        const collectionIds = Array.from(this.selectedCollectionIds()).sort(
            (a, b) => a - b
        );

        const command: SetRecipeCollectionsCommand = {
            collection_ids: collectionIds,
        };

        this.collectionsService
            .setRecipeCollections(this.data.recipeId, command)
            .subscribe({
                next: (response) => {
                    this.isSaving.set(false);
                    this.dialogRef.close({
                        action: 'saved',
                        collection_ids: response.collection_ids,
                        added_ids: response.added_ids,
                        removed_ids: response.removed_ids,
                    } as AddToCollectionDialogResult);
                },
                error: (err) => {
                    this.isSaving.set(false);

                    // Obsługa błędów z zachowaniem stanu zaznaczeń
                    let errorMessage = 'Nie udało się zapisać. Spróbuj ponownie.';

                    if (err.status === 403) {
                        errorMessage = 'Nie masz dostępu do jednej z kolekcji';
                    } else if (err.status === 404) {
                        errorMessage = 'Przepis nie istnieje lub nie masz do niego dostępu';
                    } else if (err.status === 401) {
                        errorMessage = 'Sesja wygasła. Zaloguj się ponownie.';
                    } else if (err.message) {
                        errorMessage = err.message;
                    }

                    this.snackBar.open(errorMessage, 'OK', { duration: 5000 });
                },
            });
    }

    get canCreateCollection(): boolean {
        return (
            this.newCollectionName().trim().length > 0 &&
            !this.isCreatingCollection()
        );
    }

    get canSave(): boolean {
        return !this.isLoading() && !this.isSaving() && !this.loadError();
    }
}

