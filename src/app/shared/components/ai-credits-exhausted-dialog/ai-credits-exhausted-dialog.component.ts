import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

export interface AiCreditsExhaustedDialogData {
    creditType: 'draft' | 'image';
    limitType: 'lifetime' | 'monthly';
    nextResetAt: Date | null;
}

@Component({
    selector: 'pych-ai-credits-exhausted-dialog',
    standalone: true,
    imports: [DatePipe, MatButtonModule, MatDialogModule, MatIconModule],
    templateUrl: './ai-credits-exhausted-dialog.component.html',
    styleUrl: './ai-credits-exhausted-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        role: 'dialog',
        'aria-labelledby': 'ai-credits-dialog-title',
    },
})
export class AiCreditsExhaustedDialogComponent {
    private readonly dialogRef = inject(
        MatDialogRef<AiCreditsExhaustedDialogComponent>
    );
    private readonly router = inject(Router);

    protected readonly data = inject<AiCreditsExhaustedDialogData>(MAT_DIALOG_DATA);

    protected close(): void {
        this.dialogRef.close();
    }

    protected goToPricing(): void {
        this.dialogRef.close();
        void this.router.navigate(['/pricing']);
    }
}
