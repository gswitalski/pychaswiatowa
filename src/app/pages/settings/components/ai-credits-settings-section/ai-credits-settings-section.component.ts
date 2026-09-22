import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import {
    AiCreditBalance,
    AiCreditsSettingsViewModel,
} from '../../../../core/models/ai-credits.model';
import { AiCreditsService } from '../../../../core/services/ai-credits.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
    selector: 'pych-ai-credits-settings-section',
    standalone: true,
    imports: [
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressBarModule,
        RouterLink,
    ],
    templateUrl: './ai-credits-settings-section.component.html',
    styleUrl: './ai-credits-settings-section.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiCreditsSettingsSectionComponent {
    private readonly creditsService = inject(AiCreditsService);
    private readonly authService = inject(AuthService);

    protected readonly credits = this.creditsService.credits;
    protected readonly appRole = this.authService.appRole;

    protected readonly viewModel = computed<AiCreditsSettingsViewModel>(() => {
        const state = this.credits();
        const role = this.appRole();

        if (!state) {
            return this.createLoadingViewModel();
        }

        const draftExhausted = state.draft.remaining === 0;
        const imageExhausted = state.image.remaining === 0;

        return {
            draftProgressValue: this.calculateProgress(state.draft),
            imageProgressValue: this.calculateProgress(state.image),
            draftLabel: this.createUsageLabel(state.draft),
            imageLabel: this.createUsageLabel(state.image),
            draftColor: this.getProgressColor(state.draft),
            imageColor: this.getProgressColor(state.image),
            draftExhausted,
            imageExhausted,
            showUpgradeCta:
                role === 'user' && (draftExhausted || imageExhausted),
            nextResetFormatted: state.nextResetAt
                ? new Intl.DateTimeFormat('pl-PL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                  }).format(state.nextResetAt)
                : null,
            isLoading: state.loading,
            hasError: state.error,
        };
    });

    private calculateProgress(balance: AiCreditBalance): number {
        if (balance.total === null || balance.used === null || balance.total <= 0) {
            return 0;
        }

        return Math.min(100, Math.max(0, (balance.used / balance.total) * 100));
    }

    private createUsageLabel(balance: AiCreditBalance): string {
        if (balance.total === null || balance.used === null) {
            return 'Bez limitu';
        }

        return `Użyto ${balance.used} z ${balance.total} kredytów`;
    }

    private getProgressColor(balance: AiCreditBalance): 'primary' | 'warn' {
        if (
            balance.remaining === 0 ||
            (balance.total !== null &&
                balance.total > 0 &&
                balance.remaining !== null &&
                balance.remaining / balance.total <= 0.25)
        ) {
            return 'warn';
        }

        return 'primary';
    }

    private createLoadingViewModel(): AiCreditsSettingsViewModel {
        return {
            draftProgressValue: 0,
            imageProgressValue: 0,
            draftLabel: '',
            imageLabel: '',
            draftColor: 'primary',
            imageColor: 'primary',
            draftExhausted: false,
            imageExhausted: false,
            showUpgradeCta: false,
            nextResetFormatted: null,
            isLoading: true,
            hasError: false,
        };
    }
}
