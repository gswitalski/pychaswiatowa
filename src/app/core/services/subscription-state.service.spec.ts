import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MeDto } from '../../../../shared/contracts/types';
import { MeApiService } from './me-api.service';
import { SubscriptionStateService } from './subscription-state.service';

describe('SubscriptionStateService', () => {
    const getMe = vi.fn();
    let service: SubscriptionStateService;

    const me: MeDto = {
        id: 'user-1',
        username: 'user',
        app_role: 'premium',
        ai_credits: null,
        subscription_status: 'trialing',
        subscription_plan_id: 'premium_yearly',
        current_period_end: '2027-09-30T00:00:00Z',
        auto_renew: true,
        trial_ends_at: '2026-10-07T00:00:00Z',
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(() => {
        vi.clearAllMocks();
        TestBed.configureTestingModule({
            providers: [SubscriptionStateService, { provide: MeApiService, useValue: { getMe } }],
        });
        service = TestBed.inject(SubscriptionStateService);
    });

    it('powinien zmapować odpowiedź /me na sygnały subskrypcji', () => {
        service.applyMe(me);

        expect(service.loaded()).toBe(true);
        expect(service.status()).toBe('trialing');
        expect(service.planId()).toBe('premium_yearly');
        expect(service.isTrialing()).toBe(true);
        expect(service.currentPeriodEnd()).toEqual(new Date('2027-09-30T00:00:00Z'));
    });

    it('powinien deduplikować równoległe ensureLoaded', async () => {
        const response = new Subject<MeDto>();
        getMe.mockReturnValue(response);

        const first = service.ensureLoaded();
        const second = service.ensureLoaded();
        response.next(me);
        response.complete();
        await Promise.all([first, second]);

        expect(getMe).toHaveBeenCalledOnce();
        expect(service.loaded()).toBe(true);
    });

    it('powinien zwrócić null i zapisać status błędu odświeżenia', async () => {
        getMe.mockReturnValue(throwError(() => ({ message: 'Unauthorized', status: 401 })));

        await expect(service.refresh()).resolves.toBeNull();
        expect(service.refreshErrorStatus()).toBe(401);
    });

    it('powinien wyczyścić stan', () => {
        service.applyMe(me);

        service.reset();

        expect(service.snapshot()).toBeNull();
        expect(service.loaded()).toBe(false);
        expect(service.refreshErrorStatus()).toBeNull();
    });

    it('powinien zwrócić surowe /me po udanym refresh', async () => {
        getMe.mockReturnValue(of(me));

        await expect(service.refresh()).resolves.toEqual(me);
        expect(service.hasActiveSubscription()).toBe(false);
    });
});
