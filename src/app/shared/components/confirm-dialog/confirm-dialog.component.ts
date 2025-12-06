import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'primary' | 'accent' | 'warn';
}

@Component({
    selector: 'pych-confirm-dialog',
    standalone: true,
    imports: [MatDialogModule, MatButtonModule, MatIconModule],
    templateUrl: './confirm-dialog.component.html',
    styleUrl: './confirm-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
    readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
    readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

    get confirmText(): string {
        return this.data.confirmText ?? 'Potwierdź';
    }

    get cancelText(): string {
        return this.data.cancelText ?? 'Anuluj';
    }

    get confirmColor(): 'primary' | 'accent' | 'warn' {
        return this.data.confirmColor ?? 'primary';
    }

    onConfirm(): void {
        this.dialogRef.close(true);
    }

    onCancel(): void {
        this.dialogRef.close(false);
    }
}

