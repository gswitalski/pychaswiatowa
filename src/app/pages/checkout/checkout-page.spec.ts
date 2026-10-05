import 'zone.js';
import 'zone.js/testing';
import '@angular/compiler';
import localePl from '@angular/common/locales/pl';
import { registerLocaleData } from '@angular/common';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
    CheckoutSessionResponseDto,
    SubscriptionPaymentMethod,
    SubscriptionPlanId,
} from '../../../../shared/contracts/types';
import { SubscriptionStateService } from '../../core/services/subscription-state.service';
import type {
    CheckoutErrorViewModel,
    CheckoutSubmitState,
    OrderSummaryViewModel,
} from './models/checkout.model';
import { CheckoutService } from './services/checkout.service';
import { CheckoutPageComponent } from './checkout-page';

interface CheckoutPageAccess {
    planId: WritableSignal<SubscriptionPlanId>;
    paymentMethod: WritableSignal<SubscriptionPaymentMethod>;
    acceptedTerms: WritableSignal<boolean>;
    acceptedDigitalWaiver: WritableSignal<boolean>;
    submitState: WritableSignal<CheckoutSubmitState>;
    error: WritableSignal<CheckoutErrorViewModel | null>;
    canSubmit(): boolean;
    summary(): OrderSummaryViewModel;
    submit(): Promise<void>;
    handlePageShow(event: PageTransitionEvent): void;
}

describe('CheckoutPageComponent', () => {
    const createSession = vi.fn();
    const redirectToProvider = vi.fn();
    const saveDraft = vi.fn();
    const navigate = vi.fn();
    let queryParams: Record<string, string>;
    let component: CheckoutPageAccess;

    beforeAll(() => {
        registerLocaleData(localePl);
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        queryParams = {};

        await TestBed.configureTestingModule({
            imports: [CheckoutPageComponent],
            providers: [
                provideNoopAnimations(),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: {
                                get: (name: string) => convertToParamMap(queryParams).get(name),
                            },
                        },
                    },
                },
                {
                    provide: Router,
                    useValue: { navigate },
                },
                {
                    provide: CheckoutService,
                    useValue: {
                        createSession,
                        redirectToProvider,
                        saveDraft,
                    },
                },
                {
                    provide: SubscriptionStateService,
                    useValue: {
                        loaded: signal(true),
                        isTrialing: signal(false),
                        ensureLoaded: vi.fn().mockResolvedValue(undefined),
                    },
                },
                {
                    provide: MatSnackBar,
                    useValue: { open: vi.fn() },
                },
            ],
        }).compileComponents();

        const fixture = TestBed.createComponent(CheckoutPageComponent);
        component = fixture.componentInstance as unknown as CheckoutPageAccess;
        fixture.detectChanges();
    });

    it('powinien domyślnie wybrać plan roczny i kartę', () => {
        expect(component.planId()).toBe('premium_yearly');
        expect(component.paymentMethod()).toBe('card');
        expect(component.summary().amountGross).toBe(16900);
        expect(component.canSubmit()).toBe(false);
    });

    it('powinien aktywować płatność dopiero po obu zgodach', () => {
        component.acceptedTerms.set(true);
        expect(component.canSubmit()).toBe(false);

        component.acceptedDigitalWaiver.set(true);
        expect(component.canSubmit()).toBe(true);
    });

    it('powinien zablokować wielokrotne wysłanie formularza', async () => {
        const response = new Subject<CheckoutSessionResponseDto>();
        createSession.mockReturnValue(response);
        component.acceptedTerms.set(true);
        component.acceptedDigitalWaiver.set(true);

        const firstSubmit = component.submit();
        await component.submit();

        expect(createSession).toHaveBeenCalledOnce();

        response.next({
            checkout_url: 'https://checkout.stripe.com/c/pay/test',
            session_id: 'cs_test',
            expires_at: '2026-10-01T00:00:00Z',
        });
        response.complete();
        await firstSubmit;
        expect(redirectToProvider).toHaveBeenCalledOnce();
    });

    it('powinien pokazać błąd walidacji API i odblokować formularz', async () => {
        createSession.mockReturnValue(
            throwError(() => ({
                code: 'VALIDATION_ERROR',
                message: 'Sprawdź wybrane opcje i zgody.',
                status: 400,
            })),
        );
        component.acceptedTerms.set(true);
        component.acceptedDigitalWaiver.set(true);

        await component.submit();

        expect(component.error()?.code).toBe('VALIDATION_ERROR');
        expect(component.submitState()).toBe('idle');
    });

    it('powinien resetować stan przekierowania po powrocie z bfcache', () => {
        component.submitState.set('redirecting');

        component.handlePageShow({ persisted: true } as PageTransitionEvent);

        expect(component.submitState()).toBe('idle');
    });

    it('powinien przekierować do operatora po sukcesie API', async () => {
        createSession.mockReturnValue(
            of({
                checkout_url: 'https://checkout.stripe.com/c/pay/test',
                session_id: 'cs_test',
                expires_at: '2026-10-01T00:00:00Z',
            }),
        );
        component.acceptedTerms.set(true);
        component.acceptedDigitalWaiver.set(true);

        await component.submit();

        expect(saveDraft).toHaveBeenCalledWith({
            planId: 'premium_yearly',
            paymentMethod: 'card',
        });
        expect(redirectToProvider).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/test');
    });
});
