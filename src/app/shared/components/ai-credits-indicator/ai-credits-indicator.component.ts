import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
    AiCreditsIndicatorVariant,
    AiCreditType,
} from '../../../core/models/ai-credits.model';
import { AiCreditsService } from '../../../core/services/ai-credits.service';
import {
    AiCreditsExhaustedDialogComponent,
    AiCreditsExhaustedDialogData,
} from '../ai-credits-exhausted-dialog/ai-credits-exhausted-dialog.component';

@Component({
    selector: 'pych-ai-credits-indicator',
    standalone: true,
    imports: [
        DatePipe,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
    ],
    templateUrl: './ai-credits-indicator.component.html',
    styleUrl: './ai-credits-indicator.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiCreditsIndicatorComponent {
    readonly type = input.required<AiCreditType>();
    readonly showResetDate = input(true);
    readonly compact = input(false);

    private readonly creditsService = inject(AiCreditsService);
    private readonly dialog = inject(MatDialog);

    protected readonly state = this.creditsService.credits;
    protected readonly balance = computed(() => {
        const state = this.state();
        return state ? state[this.type()] : null;
    });

    protected readonly variant = computed<AiCreditsIndicatorVariant>(() => {
        const state = this.state();

        if (state?.error || state?.limitType === 'unlimited') {
            return 'hidden';
        }

        if (!state || state.loading) {
            return 'loading';
        }

        const balance = state[this.type()];
        if (balance.remaining === 0) {
            return 'exhausted';
        }

        if (
            balance.total !== null &&
            balance.total > 0 &&
            balance.remaining !== null &&
            balance.remaining / balance.total <= 0.25
        ) {
            return 'warning';
        }

        return 'normal';
    });

    protected readonly label = computed(() => {
        const balance = this.balance();

        if (!balance || balance.remaining === null || balance.total === null) {
            return '';
        }

        if (balance.remaining === 0) {
            return 'Brak kredytów AI';
        }

        if (this.compact()) {
            return `${balance.remaining}/${balance.total}`;
        }

        return `Kredyty AI: ${balance.remaining} / ${balance.total}`;
    });

    protected readonly icon = computed(() => {
        switch (this.variant()) {
            case 'warning':
                return 'warning_amber';
            case 'exhausted':
                return 'block';
            default:
                return 'auto_awesome';
        }
    });

    protected readonly tooltip = computed(() => {
        if (this.variant() === 'exhausted') {
            return 'Brak kredytów AI — sprawdź możliwości odnowienia puli';
        }

        if (this.variant() === 'warning') {
            return 'Kończy się pula kredytów AI';
        }

        return '';
    });

    protected openExhaustedDialog(): void {
        if (this.variant() !== 'exhausted') {
            return;
        }

        const state = this.state();
        if (!state || state.limitType === 'unlimited') {
            return;
        }

        this.dialog.open<
            AiCreditsExhaustedDialogComponent,
            AiCreditsExhaustedDialogData
        >(AiCreditsExhaustedDialogComponent, {
            data: {
                creditType: this.type(),
                limitType: state.limitType,
                nextResetAt: state.nextResetAt,
            },
            width: '480px',
            maxWidth: 'calc(100vw - 32px)',
            panelClass: 'mobile-fullscreen-dialog',
        });
    }

    protected handleKeydown(event: Event): void {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') {
            return;
        }

        keyboardEvent.preventDefault();
        this.openExhaustedDialog();
    }
}
