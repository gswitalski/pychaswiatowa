import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export type ConfirmDialogResult = boolean | 'secondary';

export interface ConfirmDialogData {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: 'primary' | 'accent' | 'warn';
    /** Gdy ustawione, pokazuje trzeci przycisk i zamyka dialog wartością `'secondary'`. */
    secondaryConfirmText?: string;
    secondaryConfirmColor?: 'primary' | 'accent' | 'warn';
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

    get secondaryConfirmText(): string | null {
        return this.data.secondaryConfirmText ?? null;
    }

    get secondaryConfirmColor(): 'primary' | 'accent' | 'warn' {
        return this.data.secondaryConfirmColor ?? 'warn';
    }

    onConfirm(): void {
        this.dialogRef.close(true);
    }

    onSecondary(): void {
        this.dialogRef.close('secondary');
    }

    onCancel(): void {
        this.dialogRef.close(false);
    }
}

