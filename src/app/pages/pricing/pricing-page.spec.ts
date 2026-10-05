import 'zone.js';
import 'zone.js/testing';
import { Signal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SubscriptionPlanId } from '../../../../shared/contracts/types';
import { AuthService } from '../../core/services/auth.service';
import { SubscriptionStateService } from '../../core/services/subscription-state.service';
import type { BillingPeriod } from './pricing.config';
import { PricingPageComponent } from './pricing-page';

interface PricingPageAccess {
    selectedPlanId: Signal<SubscriptionPlanId>;
    guestCheckoutNext: Signal<string>;
    setBillingPeriod(period: BillingPeriod): void;
    ngOnInit(): void;
}

describe('PricingPageComponent', () => {
    const appRole = signal<'user' | 'premium' | 'admin'>('user');
    const isAuthenticated = signal(false);
    const isTrialing = signal(false);
    const ensureLoaded = vi.fn().mockResolvedValue(undefined);
    let component: PricingPageAccess;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        appRole.set('user');
        isAuthenticated.set(false);
        isTrialing.set(false);

        await TestBed.configureTestingModule({
            imports: [PricingPageComponent],
            providers: [
                provideNoopAnimations(),
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: { appRole, isAuthenticated },
                },
                {
                    provide: SubscriptionStateService,
                    useValue: { isTrialing, ensureLoaded },
                },
            ],
        }).compileComponents();

        component = TestBed.createComponent(PricingPageComponent)
            .componentInstance as unknown as PricingPageAccess;
    });

    it('powinien przekazywać wybrany okres do checkoutu', () => {
        expect(component.selectedPlanId()).toBe('premium_yearly');
        expect(component.guestCheckoutNext()).toBe('/checkout?plan=premium_yearly');

        component.setBillingPeriod('monthly');

        expect(component.selectedPlanId()).toBe('premium_monthly');
        expect(component.guestCheckoutNext()).toBe('/checkout?plan=premium_monthly');
    });

    it('powinien załadować subskrypcję użytkownika Premium', () => {
        appRole.set('premium');

        component.ngOnInit();

        expect(ensureLoaded).toHaveBeenCalledOnce();
    });
});
