import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import {
    BillingPeriod,
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
export class PricingPageComponent {
    private readonly authService = inject(AuthService);

    readonly billingPeriod = signal<BillingPeriod>('yearly');
    readonly isAuthenticated = this.authService.isAuthenticated;
    readonly appRole = this.authService.appRole;

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

    readonly showFreeCta = computed(() => !this.isAuthenticated() || this.appRole() === 'user');

    readonly showPremiumCta = computed(() => this.appRole() !== 'admin');

    setBillingPeriod(period: BillingPeriod): void {
        this.billingPeriod.set(period);
    }
}
