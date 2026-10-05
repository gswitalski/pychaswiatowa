import 'zone.js';
import 'zone.js/testing';
import '@angular/compiler';
import localePl from '@angular/common/locales/pl';
import { registerLocaleData } from '@angular/common';
import { signal, Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeDto } from '../../../../../shared/contracts/types';
import { AuthService } from '../../../core/services/auth.service';
import { BillingService } from '../../../core/services/billing.service';
import { SubscriptionStateService } from '../../../core/services/subscription-state.service';
import type { CheckoutSuccessState, CheckoutSuccessViewModel } from '../models/checkout.model';
import { CheckoutService } from '../services/checkout.service';
import { CheckoutSuccessPageComponent } from './checkout-success-page';

interface SuccessPageAccess {
    state: Signal<CheckoutSuccessState>;
    attempt: Signal<number>;
    viewModel: Signal<CheckoutSuccessViewModel | null>;
}

describe('CheckoutSuccessPageComponent', () => {
    const refresh = vi.fn();
    const refreshSession = vi.fn();
    const getPayments = vi.fn();
    const clearDraft = vi.fn();
    const refreshErrorStatus = signal<number | null>(null);
    const appRole = signal<'user' | 'premium' | 'admin'>('premium');
    let sessionId: string | null;
    let fixture: ComponentFixture<CheckoutSuccessPageComponent> | null;
    let router: Router;

    const activeMe: MeDto = {
        id: 'user-1',
        username: 'user',
        app_role: 'user',
        ai_credits: null,
        subscription_status: 'active',
        subscription_plan_id: 'premium_yearly',
        current_period_end: '2027-09-30T00:00:00Z',
        auto_renew: true,
        trial_ends_at: null,
    };

    beforeAll(() => {
        registerLocaleData(localePl);
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        fixture = null;
        sessionId = 'cs_test_123';
        refreshErrorStatus.set(null);
        appRole.set('premium');
        refreshSession.mockResolvedValue(undefined);
        getPayments.mockReturnValue(
            of({
                data: [
                    {
                        id: 1,
                        plan_id: 'premium_yearly',
                        payment_method_type: 'card',
                        amount_gross: 16900,
                        currency: 'PLN',
                        status: 'paid',
                        paid_at: '2026-09-30T20:00:00Z',
                        document_number: 'FV/1',
                        document_url: 'https://example.com/invoice',
                        document_pdf_url: null,
                    },
                ],
            }),
        );

        await TestBed.configureTestingModule({
            imports: [CheckoutSuccessPageComponent],
            providers: [
                provideNoopAnimations(),
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: {
                                get: () =>
                                    convertToParamMap({
                                        session_id: sessionId,
                                    }).get('session_id'),
                            },
                        },
                    },
                },
                {
                    provide: AuthService,
                    useValue: { refreshSession, appRole },
                },
                {
                    provide: BillingService,
                    useValue: { getPayments },
                },
                {
                    provide: SubscriptionStateService,
                    useValue: { refresh, refreshErrorStatus },
                },
                {
                    provide: CheckoutService,
                    useValue: { clearDraft },
                },
                {
                    provide: MatSnackBar,
                    useValue: { open: vi.fn() },
                },
            ],
        }).compileComponents();

        router = TestBed.inject(Router);
        vi.spyOn(router, 'navigate').mockResolvedValue(true);
    });

    afterEach(() => {
        fixture?.destroy();
        vi.useRealTimers();
    });

    it('powinien potwierdzić zakup po aktywacji subskrypcji', async () => {
        refresh.mockResolvedValue(activeMe);
        const access = createComponent();

        await vi.runAllTimersAsync();

        expect(access.state()).toBe('confirmed');
        expect(access.viewModel()?.invoiceUrl).toBe('https://example.com/invoice');
        expect(refreshSession).toHaveBeenCalledOnce();
        expect(clearDraft).toHaveBeenCalledOnce();
    });

    it('powinien przejść do pending po piętnastu próbach', async () => {
        refresh.mockResolvedValue(null);
        const access = createComponent();

        await vi.advanceTimersByTimeAsync(28_000);

        expect(access.attempt()).toBe(15);
        expect(access.state()).toBe('pending');
    });

    it('powinien odrzucić brak session_id', () => {
        sessionId = null;
        createComponent();

        expect(router.navigate).toHaveBeenCalledWith(['/checkout'], {
            replaceUrl: true,
        });
        expect(refresh).not.toHaveBeenCalled();
    });

    function createComponent(): SuccessPageAccess {
        fixture = TestBed.createComponent(CheckoutSuccessPageComponent);
        fixture.detectChanges();
        return fixture.componentInstance as unknown as SuccessPageAccess;
    }
});
