import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

export interface PlanLimitExceededDialogData {
    /** Aktualny limit pozycji planu dla konta Free (z details.free_limit). */
    freeLimit: number;
    /** Limit pozycji planu dla konta Premium (z details.premium_limit). */
    premiumLimit: number;
    /** URL strony cennika do przejścia na Premium. */
    upgradeUrl: string;
}

@Component({
    selector: 'pych-plan-limit-exceeded-dialog',
    standalone: true,
    imports: [MatButtonModule, MatDialogModule, MatIconModule],
    templateUrl: './plan-limit-exceeded-dialog.component.html',
    styleUrl: './plan-limit-exceeded-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        role: 'dialog',
        'aria-labelledby': 'plan-limit-dialog-title',
        'aria-describedby': 'plan-limit-dialog-description',
    },
})
export class PlanLimitExceededDialogComponent {
    private readonly dialogRef = inject(
        MatDialogRef<PlanLimitExceededDialogComponent>
    );
    private readonly router = inject(Router);

    protected readonly data = inject<PlanLimitExceededDialogData>(MAT_DIALOG_DATA);

    protected close(): void {
        this.dialogRef.close();
    }

    protected goToPremium(): void {
        this.dialogRef.close();
        void this.router.navigate([this.data.upgradeUrl]);
    }
}
