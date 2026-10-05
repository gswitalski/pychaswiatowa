import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import type { OrderSummaryViewModel } from '../../models/checkout.model';

@Component({
    selector: 'pych-order-summary',
    standalone: true,
    imports: [
        CurrencyPipe,
        DatePipe,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './order-summary.component.html',
    styleUrl: './order-summary.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSummaryComponent {
    readonly summary = input.required<OrderSummaryViewModel>();
    readonly canSubmit = input.required<boolean>();
    readonly submitting = input(false);
    readonly pay = output<void>();

    protected requestPayment(): void {
        if (!this.canSubmit() || this.submitting()) {
            return;
        }

        this.pay.emit();
    }
}
