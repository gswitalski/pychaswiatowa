import { CurrencyPipe, DatePipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    OnInit,
    computed,
    inject,
    signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';

import type {
    BillingPaymentDto,
    SubscriptionPlanId,
    SubscriptionStatus,
} from '../../../../../../shared/contracts/types';
import { BillingService } from '../../../../core/services/billing.service';
import { SubscriptionStateService } from '../../../../core/services/subscription-state.service';
import type { PaymentHistoryRowViewModel } from './payment-history.model';

type PaymentHistoryLoadState = 'loading' | 'loaded' | 'error';

@Component({
    selector: 'pych-payment-history',
    standalone: true,
    imports: [
        CurrencyPipe,
        DatePipe,
        MatButtonModule,
        MatCardModule,
        MatChipsModule,
        MatIconModule,
        MatTableModule,
    ],
    templateUrl: './payment-history.component.html',
    styleUrl: './payment-history.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentHistoryComponent implements OnInit {
    private readonly billingService = inject(BillingService);
    private readonly subscriptionState = inject(SubscriptionStateService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly payments = signal<PaymentHistoryRowViewModel[]>([]);
    protected readonly loadState = signal<PaymentHistoryLoadState>('loading');
    protected readonly displayedColumns = [
        'paidAt',
        'plan',
        'amount',
        'method',
        'status',
        'invoice',
    ];

    protected readonly subscriptionStatus = this.subscriptionState.status;
    protected readonly subscriptionPlanId = this.subscriptionState.planId;
    protected readonly currentPeriodEnd = this.subscriptionState.currentPeriodEnd;
    protected readonly autoRenew = this.subscriptionState.autoRenew;
    protected readonly isVisible = computed(
        () =>
            this.loadState() === 'loading' ||
            this.loadState() === 'error' ||
            this.payments().length > 0 ||
            this.subscriptionStatus() !== null,
    );

    public ngOnInit(): void {
        void this.subscriptionState.ensureLoaded();
        this.loadPayments();
    }

    protected retry(): void {
        this.loadPayments();
    }

    protected planLabel(planId: SubscriptionPlanId | null): string {
        if (planId === 'premium_yearly') {
            return 'Premium — roczny';
        }

        if (planId === 'premium_monthly') {
            return 'Premium — miesięczny';
        }

        return 'Premium';
    }

    protected statusLabel(status: SubscriptionStatus): string {
        const labels: Readonly<Record<SubscriptionStatus, string>> = {
            active: 'Premium — aktywne',
            trialing: 'Premium — okres próbny',
            past_due: 'Premium — zaległa płatność',
            canceled: 'Premium — anulowane',
            expired: 'Premium — wygasłe',
        };

        return labels[status];
    }

    private loadPayments(): void {
        this.loadState.set('loading');

        this.billingService
            .getPayments(20)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (response) => {
                    this.payments.update(() =>
                        response.data.map((payment) => this.mapPayment(payment)),
                    );
                    this.loadState.set('loaded');
                },
                error: (error: unknown) => {
                    console.error(
                        '[PaymentHistoryComponent] Nie udało się pobrać płatności:',
                        error,
                    );
                    this.loadState.set('error');
                },
            });
    }

    private mapPayment(payment: BillingPaymentDto): PaymentHistoryRowViewModel {
        return {
            id: payment.id,
            paidAt: this.parseDate(payment.paid_at),
            planLabel: this.planLabel(payment.plan_id),
            amountGross: payment.amount_gross,
            methodLabel: payment.payment_method_type === 'card' ? 'Karta' : 'BLIK',
            statusLabel: payment.status === 'paid' ? 'Opłacona' : 'Nieudana',
            statusKind: payment.status,
            documentUrl: payment.status === 'paid' ? payment.document_url : null,
            documentNumber: payment.document_number,
        };
    }

    private parseDate(value: string | null): Date | null {
        if (!value) {
            return null;
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
}
