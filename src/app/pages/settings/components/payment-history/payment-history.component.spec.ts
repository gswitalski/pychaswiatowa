import 'zone.js';
import 'zone.js/testing';
import '@angular/compiler';
import localePl from '@angular/common/locales/pl';
import { registerLocaleData } from '@angular/common';
import { Signal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GetBillingPaymentsResponseDto } from '../../../../../../shared/contracts/types';
import { BillingService } from '../../../../core/services/billing.service';
import { SubscriptionStateService } from '../../../../core/services/subscription-state.service';
import type { PaymentHistoryRowViewModel } from './payment-history.model';
import { PaymentHistoryComponent } from './payment-history.component';

interface PaymentHistoryAccess {
    payments: Signal<PaymentHistoryRowViewModel[]>;
    loadState: Signal<'loading' | 'loaded' | 'error'>;
    retry(): void;
}

describe('PaymentHistoryComponent', () => {
    const getPayments = vi.fn();
    const ensureLoaded = vi.fn().mockResolvedValue(undefined);

    beforeAll(() => {
        registerLocaleData(localePl);
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        await TestBed.configureTestingModule({
            imports: [PaymentHistoryComponent],
            providers: [
                provideNoopAnimations(),
                {
                    provide: BillingService,
                    useValue: { getPayments },
                },
                {
                    provide: SubscriptionStateService,
                    useValue: {
                        status: signal('active'),
                        planId: signal('premium_yearly'),
                        currentPeriodEnd: signal(new Date('2027-09-30T00:00:00Z')),
                        autoRenew: signal(true),
                        ensureLoaded,
                    },
                },
            ],
        }).compileComponents();
    });

    it('powinien wyświetlić płatność i link do faktury', () => {
        getPayments.mockReturnValue(of(createPaymentsResponse()));

        const { fixture, access } = createComponent();

        expect(access.loadState()).toBe('loaded');
        expect(access.payments()[0]).toMatchObject({
            planLabel: 'Premium — roczny',
            methodLabel: 'Karta',
            statusLabel: 'Opłacona',
        });
        expect(fixture.nativeElement.textContent).toContain('Faktura');
    });

    it('powinien pokazać błąd i umożliwić ponowienie', () => {
        getPayments
            .mockReturnValueOnce(throwError(() => ({ message: 'Network error', status: 500 })))
            .mockReturnValueOnce(of(createPaymentsResponse()));

        const { access } = createComponent();
        expect(access.loadState()).toBe('error');

        access.retry();

        expect(getPayments).toHaveBeenCalledTimes(2);
        expect(access.loadState()).toBe('loaded');
        expect(access.payments()).toHaveLength(1);
    });

    function createComponent(): {
        fixture: ComponentFixture<PaymentHistoryComponent>;
        access: PaymentHistoryAccess;
    } {
        const fixture = TestBed.createComponent(PaymentHistoryComponent);
        fixture.detectChanges();

        return {
            fixture,
            access: fixture.componentInstance as unknown as PaymentHistoryAccess,
        };
    }
});

function createPaymentsResponse(): GetBillingPaymentsResponseDto {
    return {
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
    };
}
