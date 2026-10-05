import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    OnDestroy,
    OnInit,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subscription, exhaustMap, firstValueFrom, takeWhile, tap, timer } from 'rxjs';

import type {
    BillingPaymentDto,
    MeDto,
    SubscriptionPlanId,
} from '../../../../../shared/contracts/types';
import { AuthService } from '../../../core/services/auth.service';
import { BillingService } from '../../../core/services/billing.service';
import { SubscriptionStateService } from '../../../core/services/subscription-state.service';
import { CHECKOUT_POLL_INTERVAL_MS, CHECKOUT_POLL_MAX_ATTEMPTS } from '../checkout.constants';
import type { CheckoutSuccessState, CheckoutSuccessViewModel } from '../models/checkout.model';
import { CheckoutService } from '../services/checkout.service';

const CHECKOUT_SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]+$/;

@Component({
    selector: 'pych-checkout-success-page',
    standalone: true,
    imports: [
        DatePipe,
        RouterLink,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
    ],
    templateUrl: './checkout-success-page.html',
    styleUrl: './checkout-success-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutSuccessPageComponent implements OnInit, OnDestroy {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly billingService = inject(BillingService);
    private readonly subscriptionState = inject(SubscriptionStateService);
    private readonly checkoutService = inject(CheckoutService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    private pollingSubscription: Subscription | null = null;

    protected readonly state = signal<CheckoutSuccessState>('confirming');
    protected readonly attempt = signal(0);
    protected readonly viewModel = signal<CheckoutSuccessViewModel | null>(null);
    protected readonly stateHeading = viewChild<ElementRef<HTMLHeadingElement>>('stateHeading');

    public ngOnInit(): void {
        const sessionId = this.route.snapshot.queryParamMap.get('session_id');
        if (!sessionId || !CHECKOUT_SESSION_ID_PATTERN.test(sessionId)) {
            void this.router.navigate(['/checkout'], { replaceUrl: true });
            return;
        }

        this.startPolling();
    }

    public ngOnDestroy(): void {
        this.stopPolling();
    }

    protected checkAgain(): void {
        this.startPolling();
    }

    protected planLabel(planId: SubscriptionPlanId | null): string {
        if (planId === 'premium_yearly') {
            return 'Premium — plan roczny';
        }

        if (planId === 'premium_monthly') {
            return 'Premium — plan miesięczny';
        }

        return 'Premium';
    }

    private startPolling(): void {
        this.stopPolling();
        this.attempt.set(0);
        this.setState('confirming');

        this.pollingSubscription = timer(0, CHECKOUT_POLL_INTERVAL_MS)
            .pipe(
                exhaustMap(() => this.subscriptionState.refresh()),
                tap(() => this.attempt.update((value) => value + 1)),
                takeWhile(
                    (me) =>
                        this.subscriptionState.refreshErrorStatus() !== 401 &&
                        me?.subscription_status !== 'active' &&
                        this.attempt() < CHECKOUT_POLL_MAX_ATTEMPTS,
                    true,
                ),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe((me) => {
                if (this.subscriptionState.refreshErrorStatus() === 401) {
                    void this.router.navigate(['/login'], {
                        queryParams: { returnUrl: this.router.url },
                    });
                    return;
                }

                if (me?.subscription_status === 'active') {
                    void this.confirmPurchase(me);
                    return;
                }

                if (this.attempt() >= CHECKOUT_POLL_MAX_ATTEMPTS) {
                    this.setState('pending');
                }
            });
    }

    private stopPolling(): void {
        this.pollingSubscription?.unsubscribe();
        this.pollingSubscription = null;
    }

    private async confirmPurchase(me: MeDto): Promise<void> {
        await this.refreshPremiumRole();
        const invoiceUrl = await this.loadInvoiceUrl();

        this.viewModel.set({
            planId: me.subscription_plan_id,
            currentPeriodEnd: this.parseDate(me.current_period_end),
            autoRenew: me.auto_renew,
            invoiceUrl,
        });
        this.checkoutService.clearDraft();
        this.setState('confirmed');
    }

    private async refreshPremiumRole(): Promise<void> {
        try {
            await this.authService.refreshSession();

            if (this.authService.appRole() !== 'premium') {
                await this.authService.refreshSession();
            }

            if (this.authService.appRole() === 'premium') {
                return;
            }
        } catch (error) {
            console.error('[CheckoutSuccessPageComponent] Nie udało się odświeżyć sesji:', error);
        }

        this.snackBar.open('Odśwież stronę, aby zobaczyć funkcje Premium.', 'OK', {
            duration: 6_000,
        });
    }

    private async loadInvoiceUrl(): Promise<string | null> {
        try {
            const response = await firstValueFrom(this.billingService.getPayments(1));
            const latestPayment = response.data[0];

            return this.getInvoiceUrl(latestPayment);
        } catch (error) {
            console.error('[CheckoutSuccessPageComponent] Nie udało się pobrać faktury:', error);
            return null;
        }
    }

    private getInvoiceUrl(payment: BillingPaymentDto | undefined): string | null {
        return payment?.status === 'paid' ? payment.document_url : null;
    }

    private setState(state: CheckoutSuccessState): void {
        this.state.set(state);
        queueMicrotask(() => this.stateHeading()?.nativeElement.focus());
    }

    private parseDate(value: string | null): Date | null {
        if (!value) {
            return null;
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
}
