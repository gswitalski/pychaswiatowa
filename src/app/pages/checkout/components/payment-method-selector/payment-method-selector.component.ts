import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';

import type { SubscriptionPaymentMethod } from '../../../../../../shared/contracts/types';
import type { PaymentMethodOptionViewModel } from '../../models/checkout.model';

@Component({
    selector: 'pych-payment-method-selector',
    standalone: true,
    imports: [MatIconModule, MatRadioModule],
    templateUrl: './payment-method-selector.component.html',
    styleUrl: './payment-method-selector.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodSelectorComponent {
    readonly selectedMethod = model.required<SubscriptionPaymentMethod>();
    readonly disabled = input(false);

    protected readonly options: readonly PaymentMethodOptionViewModel[] = [
        {
            id: 'card',
            label: 'Karta płatnicza',
            description: 'Odnawia się automatycznie.',
            icon: 'credit_card',
            autoRenew: true,
        },
        {
            id: 'blik',
            label: 'BLIK',
            description: 'Płatność jednorazowa za wybrany okres, bez automatycznego odnowienia.',
            icon: 'smartphone',
            autoRenew: false,
        },
    ];

    protected selectMethod(event: MatRadioChange): void {
        this.selectedMethod.set(event.value as SubscriptionPaymentMethod);
    }
}
