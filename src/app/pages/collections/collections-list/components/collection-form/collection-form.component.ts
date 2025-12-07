import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import {
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import {
    CollectionFormDialogData,
    CollectionFormViewModel,
} from '../../models/collections-list.model';

@Component({
    selector: 'pych-collection-form',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './collection-form.component.html',
    styleUrl: './collection-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionFormComponent implements OnInit {
    readonly dialogRef = inject(MatDialogRef<CollectionFormComponent>);
    readonly data = inject<CollectionFormDialogData>(MAT_DIALOG_DATA);

    /** Stan zapisywania */
    readonly isSaving = signal(false);

    /** Błąd z API */
    readonly apiError = signal<string | null>(null);

    /** Formularz kolekcji */
    readonly form = new FormGroup<CollectionFormViewModel>({
        name: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(100)],
        }),
        description: new FormControl<string | null>(null, {
            validators: [Validators.maxLength(500)],
        }),
    });

    /** Czy formularz jest w trybie edycji */
    get isEditMode(): boolean {
        return this.data.mode === 'edit';
    }

    /** Tytuł dialogu */
    get dialogTitle(): string {
        return this.isEditMode ? 'Edytuj kolekcję' : 'Utwórz nową kolekcję';
    }

    /** Tekst przycisku zapisu */
    get submitButtonText(): string {
        return this.isEditMode ? 'Zapisz zmiany' : 'Utwórz';
    }

    ngOnInit(): void {
        if (this.isEditMode && this.data.collection) {
            this.form.patchValue({
                name: this.data.collection.name,
                description: this.data.collection.description,
            });
        }
    }

    /**
     * Zamyka dialog bez zapisu
     */
    onCancel(): void {
        this.dialogRef.close();
    }

    /**
     * Zapisuje formularz
     */
    onSubmit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.apiError.set(null);

        const formValue = {
            name: this.form.value.name!,
            description: this.form.value.description ?? null,
        };

        this.dialogRef.close(formValue);
    }

    /**
     * Ustawia błąd API (wywoływane z zewnątrz gdy operacja się nie powiedzie)
     */
    setApiError(error: string): void {
        this.apiError.set(error);
        this.isSaving.set(false);
    }

    /**
     * Ustawia stan zapisywania
     */
    setSaving(saving: boolean): void {
        this.isSaving.set(saving);
    }
}
