import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    afterNextRender,
    computed,
    inject,
    signal,
} from '@angular/core';
import { CurrencyPipe, ViewportScroller } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { skip } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { SubscriptionStateService } from '../../core/services/subscription-state.service';
import {
    BillingPeriod,
    PLAN_ID_BY_PERIOD,
    PLAN_BENEFITS,
    PRICING_CONFIG,
    PRICING_FAQ,
    PRICING_FEATURE_CATEGORIES,
} from './pricing.config';

@Component({
    selector: 'pych-pricing-page',
    imports: [
        CurrencyPipe,
        RouterLink,
        MatButtonModule,
        MatButtonToggleModule,
        MatCardModule,
        MatChipsModule,
        MatExpansionModule,
        MatIconModule,
    ],
    templateUrl: './pricing-page.html',
    styleUrl: './pricing-page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingPageComponent implements OnInit {
    private readonly authService = inject(AuthService);
    private readonly subscriptionState = inject(SubscriptionStateService);
    private readonly route = inject(ActivatedRoute);
    private readonly viewportScroller = inject(ViewportScroller);

    readonly billingPeriod = signal<BillingPeriod>('yearly');
    readonly isAuthenticated = this.authService.isAuthenticated;
    readonly appRole = this.authService.appRole;
    readonly isTrialing = this.subscriptionState.isTrialing;

    readonly config = PRICING_CONFIG;
    readonly benefits = PLAN_BENEFITS;
    readonly featureCategories = PRICING_FEATURE_CATEGORIES;
    readonly faqItems = PRICING_FAQ;

    readonly premiumPrice = computed(() =>
        this.billingPeriod() === 'yearly'
            ? PRICING_CONFIG.plans.premium.priceYearly
            : PRICING_CONFIG.plans.premium.priceMonthly,
    );

    readonly premiumPriceSuffix = computed(() =>
        this.billingPeriod() === 'yearly' ? '/ rok' : '/ mies.',
    );
    readonly selectedPlanId = computed(() => PLAN_ID_BY_PERIOD[this.billingPeriod()]);
    readonly guestCheckoutNext = computed(() => `/checkout?plan=${this.selectedPlanId()}`);

    readonly showFreeCta = computed(() => !this.isAuthenticated() || this.appRole() === 'user');

    readonly showPremiumCta = computed(() => this.appRole() !== 'admin');

    constructor() {
        afterNextRender(() => this.scrollToFragment());

        this.route.fragment.pipe(skip(1), takeUntilDestroyed()).subscribe(() => {
            requestAnimationFrame(() => this.scrollToFragment());
        });
    }

    ngOnInit(): void {
        if (this.appRole() === 'premium') {
            void this.subscriptionState.ensureLoaded();
        }
    }

    setBillingPeriod(period: BillingPeriod): void {
        this.billingPeriod.set(period);
    }

    private scrollToFragment(): void {
        const fragment = this.route.snapshot.fragment;
        if (!fragment || !document.getElementById(fragment)) {
            return;
        }

        this.viewportScroller.scrollToAnchor(fragment);
    }
}
