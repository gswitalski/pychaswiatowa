import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    HostListener,
    OnInit,
    computed,
    inject,
    signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import type {
    CreateCheckoutSessionCommand,
    SubscriptionPaymentMethod,
    SubscriptionPlanId,
} from '../../../../shared/contracts/types';
import { SubscriptionStateService } from '../../core/services/subscription-state.service';
import { getPremiumPlanPrice } from '../pricing/pricing.config';
import { CheckoutConsentsComponent } from './components/checkout-consents/checkout-consents.component';
import { OrderSummaryComponent } from './components/order-summary/order-summary.component';
import { PaymentMethodSelectorComponent } from './components/payment-method-selector/payment-method-selector.component';
import { PlanSelectorComponent } from './components/plan-selector/plan-selector.component';
import type {
    CheckoutErrorViewModel,
    CheckoutSubmitState,
    OrderSummaryViewModel,
} from './models/checkout.model';
import { CheckoutService } from './services/checkout.service';
import { calculatePeriodEnd } from './utils/period.util';

@Component({
    selector: 'pych-checkout-page',
    standalone: true,
    imports: [
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        CheckoutConsentsComponent,
        OrderSummaryComponent,
        PaymentMethodSelectorComponent,
        PlanSelectorComponent,
    ],
    templateUrl: './checkout-page.html',
    styleUrl: './checkout-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly checkoutService = inject(CheckoutService);
    private readonly subscriptionState = inject(SubscriptionStateService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    private retryIntervalId: ReturnType<typeof setInterval> | null = null;

    protected readonly planId = signal<SubscriptionPlanId>(
        this.parsePlanId(this.route.snapshot.queryParamMap.get('plan')),
    );
    protected readonly paymentMethod = signal<SubscriptionPaymentMethod>(
        this.parsePaymentMethod(this.route.snapshot.queryParamMap.get('method')),
    );
    protected readonly acceptedTerms = signal(false);
    protected readonly acceptedDigitalWaiver = signal(false);
    protected readonly submitState = signal<CheckoutSubmitState>('idle');
    protected readonly error = signal<CheckoutErrorViewModel | null>(null);
    protected readonly retryCountdown = signal(0);
    protected readonly initialSubscriptionLoad = signal(!this.subscriptionState.loaded());

    protected readonly isTrialing = this.subscriptionState.isTrialing;
    protected readonly showSkeleton = computed(
        () => this.initialSubscriptionLoad() && !this.subscriptionState.loaded(),
    );
    protected readonly canSubmit = computed(
        () =>
            this.acceptedTerms() &&
            this.acceptedDigitalWaiver() &&
            this.submitState() === 'idle' &&
            this.retryCountdown() === 0,
    );
    protected readonly formDisabled = computed(() => this.submitState() !== 'idle');
    protected readonly submitting = computed(
        () => this.submitState() === 'submitting' || this.submitState() === 'redirecting',
    );
    protected readonly highlightMissingConsents = computed(
        () => this.error()?.code === 'VALIDATION_ERROR',
    );
    protected readonly summary = computed<OrderSummaryViewModel>(() => {
        const planId = this.planId();
        const autoRenew = this.paymentMethod() === 'card';

        return {
            planLabel: planId === 'premium_yearly' ? 'Premium (roczny)' : 'Premium (miesięczny)',
            amountGross: getPremiumPlanPrice(planId),
            dateKind: autoRenew ? 'nextPayment' : 'activeUntil',
            periodEnd: calculatePeriodEnd(planId, new Date()),
            autoRenew,
        };
    });

    public constructor() {
        this.destroyRef.onDestroy(() => this.clearRetryInterval());
    }

    public ngOnInit(): void {
        void this.loadSubscription();
    }

    @HostListener('window:pageshow', ['$event'])
    public handlePageShow(event: PageTransitionEvent): void {
        if (event.persisted) {
            this.submitState.set('idle');
        }
    }

    protected async submit(): Promise<void> {
        if (!this.canSubmit()) {
            return;
        }

        this.error.set(null);
        this.submitState.set('submitting');
        this.checkoutService.saveDraft({
            planId: this.planId(),
            paymentMethod: this.paymentMethod(),
        });

        const command: CreateCheckoutSessionCommand = {
            plan_id: this.planId(),
            payment_method: this.paymentMethod(),
            accepted_terms: true,
            accepted_digital_content_waiver: true,
        };

        try {
            const session = await firstValueFrom(this.checkoutService.createSession(command));
            this.submitState.set('redirecting');
            this.checkoutService.redirectToProvider(session.checkout_url);
        } catch (error) {
            this.handleSubmitError(error);
        }
    }

    protected retry(): void {
        if (this.retryCountdown() > 0) {
            return;
        }

        this.error.set(null);
        this.submitState.set('idle');
        void this.submit();
    }

    private async loadSubscription(): Promise<void> {
        await this.subscriptionState.ensureLoaded();
        this.initialSubscriptionLoad.set(false);
    }

    private handleSubmitError(error: unknown): void {
        const checkoutError = this.normalizeCheckoutError(error);
        console.error('[CheckoutPageComponent] Nie udało się rozpocząć płatności:', error);

        this.submitState.set('idle');

        if (checkoutError.code === 'UNAUTHORIZED') {
            void this.router.navigate(['/login'], {
                queryParams: { next: '/checkout' },
            });
            return;
        }

        if (
            checkoutError.code === 'FORBIDDEN_ROLE' ||
            checkoutError.code === 'SUBSCRIPTION_ALREADY_ACTIVE'
        ) {
            this.snackBar.open(checkoutError.message, 'OK', {
                duration: 5_000,
            });
            void this.router.navigate(['/pricing']);
            return;
        }

        this.error.set(checkoutError);

        if (checkoutError.code === 'RATE_LIMITED') {
            this.startRetryCountdown(checkoutError.retryAfterSeconds ?? 60);
        }
    }

    private normalizeCheckoutError(error: unknown): CheckoutErrorViewModel {
        if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            'message' in error &&
            'status' in error
        ) {
            return error as CheckoutErrorViewModel;
        }

        return {
            code: 'UNKNOWN',
            message:
                'Nie udało się rozpocząć płatności. Nic nie zostało pobrane. Spróbuj ponownie.',
            status: 500,
        };
    }

    private startRetryCountdown(seconds: number): void {
        this.clearRetryInterval();
        this.retryCountdown.set(Math.max(1, Math.ceil(seconds)));

        this.retryIntervalId = setInterval(() => {
            this.retryCountdown.update((current) => {
                if (current <= 1) {
                    this.clearRetryInterval();
                    return 0;
                }

                return current - 1;
            });
        }, 1_000);
    }

    private clearRetryInterval(): void {
        if (this.retryIntervalId === null) {
            return;
        }

        clearInterval(this.retryIntervalId);
        this.retryIntervalId = null;
    }

    private parsePlanId(value: string | null): SubscriptionPlanId {
        return value === 'premium_monthly' || value === 'premium_yearly' ? value : 'premium_yearly';
    }

    private parsePaymentMethod(value: string | null): SubscriptionPaymentMethod {
        return value === 'card' || value === 'blik' ? value : 'card';
    }
}
