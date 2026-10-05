import 'zone.js';
import 'zone.js/testing';
import '@angular/compiler';
import localePl from '@angular/common/locales/pl';
import { registerLocaleData } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { CheckoutConsentsComponent } from './checkout-consents/checkout-consents.component';
import { OrderSummaryComponent } from './order-summary/order-summary.component';
import { PaymentMethodSelectorComponent } from './payment-method-selector/payment-method-selector.component';
import { PlanSelectorComponent } from './plan-selector/plan-selector.component';

describe('Komponenty prezentacyjne checkoutu', () => {
    beforeAll(() => {
        registerLocaleData(localePl);
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
        TestBed.configureTestingModule({
            imports: [
                CheckoutConsentsComponent,
                OrderSummaryComponent,
                PaymentMethodSelectorComponent,
                PlanSelectorComponent,
            ],
            providers: [provideNoopAnimations()],
        });
    });

    it('powinien wyświetlić oba plany', () => {
        const fixture = TestBed.createComponent(PlanSelectorComponent);
        fixture.componentRef.setInput('selectedPlanId', 'premium_yearly');
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain('Roczny');
        expect(fixture.nativeElement.textContent).toContain('Miesięczny');
        expect(fixture.nativeElement.textContent).toContain('Oszczędzasz ~17%');
    });

    it('powinien wyświetlić kartę i BLIK', () => {
        const fixture = TestBed.createComponent(PaymentMethodSelectorComponent);
        fixture.componentRef.setInput('selectedMethod', 'card');
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain('Karta płatnicza');
        expect(fixture.nativeElement.textContent).toContain('BLIK');
        expect(fixture.nativeElement.textContent).toContain('bez automatycznego odnowienia');
    });

    it('powinien wskazać brakujące zgody', () => {
        const fixture = TestBed.createComponent(CheckoutConsentsComponent);
        fixture.componentRef.setInput('acceptedTerms', false);
        fixture.componentRef.setInput('acceptedDigitalWaiver', false);
        fixture.componentRef.setInput('highlightMissing', true);
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain('Zaznacz obie wymagane zgody.');
    });

    it('powinien emitować żądanie płatności tylko dla aktywnego przycisku', () => {
        const fixture = TestBed.createComponent(OrderSummaryComponent);
        const pay = vi.fn();
        fixture.componentInstance.pay.subscribe(pay);
        fixture.componentRef.setInput('summary', {
            planLabel: 'Premium (roczny)',
            amountGross: 16900,
            dateKind: 'nextPayment',
            periodEnd: new Date(2027, 8, 30),
            autoRenew: true,
        });
        fixture.componentRef.setInput('canSubmit', true);
        fixture.detectChanges();

        (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

        expect(pay).toHaveBeenCalledOnce();
    });
});
