import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { SUPPORT_EMAIL } from '../checkout.constants';
import { CheckoutService } from '../services/checkout.service';

@Component({
    selector: 'pych-checkout-cancel-page',
    standalone: true,
    imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
    templateUrl: './checkout-cancel-page.html',
    styleUrl: './checkout-cancel-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutCancelPageComponent {
    private readonly router = inject(Router);
    private readonly checkoutService = inject(CheckoutService);

    protected readonly supportEmail = SUPPORT_EMAIL;

    protected retryCheckout(): void {
        const draft = this.checkoutService.readDraft();
        if (!draft) {
            void this.router.navigate(['/checkout']);
            return;
        }

        void this.router.navigate(['/checkout'], {
            queryParams: {
                plan: draft.planId,
                method: draft.paymentMethod,
            },
        });
    }
}
