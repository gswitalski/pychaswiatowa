import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CheckoutService } from '../services/checkout.service';
import { CheckoutCancelPageComponent } from './checkout-cancel-page';

interface CancelPageAccess {
    retryCheckout(): void;
}

describe('CheckoutCancelPageComponent', () => {
    const readDraft = vi.fn();
    let router: Router;
    let component: CancelPageAccess;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        await TestBed.configureTestingModule({
            imports: [CheckoutCancelPageComponent],
            providers: [
                provideNoopAnimations(),
                provideRouter([]),
                {
                    provide: CheckoutService,
                    useValue: { readDraft },
                },
            ],
        }).compileComponents();

        router = TestBed.inject(Router);
        vi.spyOn(router, 'navigate').mockResolvedValue(true);
        component = TestBed.createComponent(CheckoutCancelPageComponent)
            .componentInstance as unknown as CancelPageAccess;
    });

    it('powinien odtworzyć plan i metodę z draftu', () => {
        readDraft.mockReturnValue({
            planId: 'premium_monthly',
            paymentMethod: 'blik',
        });

        component.retryCheckout();

        expect(router.navigate).toHaveBeenCalledWith(['/checkout'], {
            queryParams: {
                plan: 'premium_monthly',
                method: 'blik',
            },
        });
    });

    it('powinien wrócić do checkoutu bez parametrów dla braku draftu', () => {
        readDraft.mockReturnValue(null);

        component.retryCheckout();

        expect(router.navigate).toHaveBeenCalledWith(['/checkout']);
    });
});
