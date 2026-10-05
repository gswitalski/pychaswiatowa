import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';

import type { SubscriptionPlanId } from '../../../../../../shared/contracts/types';
import type { PlanOptionViewModel } from '../../models/checkout.model';
import { PRICING_CONFIG } from '../../../pricing/pricing.config';

@Component({
    selector: 'pych-plan-selector',
    standalone: true,
    imports: [CurrencyPipe, MatChipsModule, MatRadioModule],
    templateUrl: './plan-selector.component.html',
    styleUrl: './plan-selector.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanSelectorComponent {
    readonly selectedPlanId = model.required<SubscriptionPlanId>();
    readonly disabled = input(false);

    protected readonly options: readonly PlanOptionViewModel[] = [
        {
            id: 'premium_yearly',
            label: 'Roczny',
            priceGross: PRICING_CONFIG.plans.premium.priceYearly,
            priceSuffix: '/ rok',
            monthlyEquivalent: PRICING_CONFIG.plans.premium.priceYearlyMonthly,
            savingsPercent: PRICING_CONFIG.plans.premium.savingsPercent,
        },
        {
            id: 'premium_monthly',
            label: 'Miesięczny',
            priceGross: PRICING_CONFIG.plans.premium.priceMonthly,
            priceSuffix: '/ mies.',
            monthlyEquivalent: null,
            savingsPercent: null,
        },
    ];

    protected selectPlan(event: MatRadioChange): void {
        this.selectedPlanId.set(event.value as SubscriptionPlanId);
    }
}
