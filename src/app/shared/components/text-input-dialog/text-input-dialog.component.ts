import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface TextInputDialogData {
    title: string;
    label: string;
    confirmText?: string;
    cancelText?: string;
    initialValue?: string;
}

@Component({
    selector: 'pych-text-input-dialog',
    standalone: true,
    imports: [A11yModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
    templateUrl: './text-input-dialog.component.html',
    styleUrl: './text-input-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextInputDialogComponent {
    readonly dialogRef = inject(MatDialogRef<TextInputDialogComponent, string | undefined>);
    readonly data = inject<TextInputDialogData>(MAT_DIALOG_DATA);

    readonly control = new FormControl(this.data.initialValue ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/\S/)],
    });

    get confirmText(): string {
        return this.data.confirmText ?? 'OK';
    }

    get cancelText(): string {
        return this.data.cancelText ?? 'Anuluj';
    }

    onConfirm(): void {
        this.control.markAsTouched();
        if (this.control.invalid) {
            return;
        }
        this.dialogRef.close(this.control.value.trim());
    }

    onCancel(): void {
        this.dialogRef.close(undefined);
    }
}