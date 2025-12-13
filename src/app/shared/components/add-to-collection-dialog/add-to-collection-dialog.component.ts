import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    inject,
    signal,
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
import { MatSnackBar } from '@angular/material/snack-bar';

import { CollectionsService } from './collections.service';
import { CollectionListItemDto } from '../../../../../shared/contracts/types';

export interface AddToCollectionDialogData {
    recipeId: number;
    recipeName: string;
}

export interface AddToCollectionDialogResult {
    action: 'added' | 'created' | 'cancelled';
    collectionName?: string;
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

    readonly collections = signal<CollectionListItemDto[]>([]);
    readonly isLoading = signal(true);
    readonly isCreatingNew = signal(false);
    readonly newCollectionName = signal('');
    readonly selectedCollectionId = signal<number | null>(null);

    ngOnInit(): void {
        this.loadCollections();
    }

    private loadCollections(): void {
        this.collectionsService.getCollections().subscribe({
            next: (collections) => {
                this.collections.set(collections);
                this.isLoading.set(false);
            },
            error: () => {
                this.isLoading.set(false);
            },
        });
    }

    toggleCreateNew(): void {
        this.isCreatingNew.update((v) => !v);
        if (this.isCreatingNew()) {
            this.selectedCollectionId.set(null);
        }
    }

    selectCollection(id: number): void {
        this.selectedCollectionId.set(id);
        this.isCreatingNew.set(false);
    }

    onCancel(): void {
        this.dialogRef.close({ action: 'cancelled' } as AddToCollectionDialogResult);
    }

    onConfirm(): void {
        if (this.isCreatingNew() && this.newCollectionName().trim()) {
            this.createNewCollectionAndAdd();
        } else if (this.selectedCollectionId()) {
            this.addToExistingCollection();
        }
    }

    private createNewCollectionAndAdd(): void {
        const name = this.newCollectionName().trim();

        this.collectionsService
            .createCollectionAndAddRecipe(name, this.data.recipeId)
            .subscribe({
                next: () => {
                    this.dialogRef.close({
                        action: 'created',
                        collectionName: name,
                    } as AddToCollectionDialogResult);
                },
                error: (err) => {
                    // Obsługa błędu 409 (przepis już w kolekcji) i innych błędów
                    if (err.status === 409) {
                        this.snackBar.open(
                            'Ten przepis jest już w tej kolekcji',
                            'OK',
                            { duration: 4000 }
                        );
                    } else {
                        this.snackBar.open(
                            err.message || 'Nie udało się dodać przepisu do kolekcji',
                            'OK',
                            { duration: 5000 }
                        );
                    }
                },
            });
    }

    private addToExistingCollection(): void {
        const collectionId = this.selectedCollectionId();
        if (!collectionId) return;

        const collection = this.collections().find((c) => c.id === collectionId);

        this.collectionsService
            .addRecipeToCollection(collectionId, this.data.recipeId)
            .subscribe({
                next: () => {
                    this.dialogRef.close({
                        action: 'added',
                        collectionName: collection?.name,
                    } as AddToCollectionDialogResult);
                },
                error: (err) => {
                    // Obsługa błędu 409 (przepis już w kolekcji) i innych błędów
                    if (err.status === 409) {
                        this.snackBar.open(
                            'Ten przepis jest już w tej kolekcji',
                            'OK',
                            { duration: 4000 }
                        );
                    } else {
                        this.snackBar.open(
                            err.message || 'Nie udało się dodać przepisu do kolekcji',
                            'OK',
                            { duration: 5000 }
                        );
                    }
                },
            });
    }

    get canConfirm(): boolean {
        return (
            (this.isCreatingNew() && this.newCollectionName().trim().length > 0) ||
            this.selectedCollectionId() !== null
        );
    }
}

