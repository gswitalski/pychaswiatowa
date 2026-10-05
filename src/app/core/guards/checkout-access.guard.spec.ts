import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppRole } from '../../../../shared/contracts/types';
import { AuthService } from '../services/auth.service';
import { SubscriptionStateService } from '../services/subscription-state.service';
import { checkoutAccessGuard } from './checkout-access.guard';

describe('checkoutAccessGuard', () => {
    const isAuthenticated = vi.fn<() => boolean>();
    const appRole = vi.fn<() => AppRole>();
    const ensureLoaded = vi.fn<() => Promise<void>>();
    const loaded = vi.fn<() => boolean>();
    const isTrialing = vi.fn<() => boolean>();
    const snackBarOpen = vi.fn();
    let router: Router;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        ensureLoaded.mockResolvedValue();
        loaded.mockReturnValue(true);
        isTrialing.mockReturnValue(false);

        await TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                {
                    provide: AuthService,
                    useValue: { isAuthenticated, appRole },
                },
                {
                    provide: SubscriptionStateService,
                    useValue: { ensureLoaded, loaded, isTrialing },
                },
                {
                    provide: MatSnackBar,
                    useValue: { open: snackBarOpen },
                },
            ],
        }).compileComponents();

        router = TestBed.inject(Router);
    });

    async function runGuard(): Promise<boolean | UrlTree> {
        return TestBed.runInInjectionContext(() =>
            checkoutAccessGuard({} as never, {} as never),
        ) as Promise<boolean | UrlTree>;
    }

    it('powinien przekierować gościa do logowania z next=/checkout', async () => {
        isAuthenticated.mockReturnValue(false);

        const result = await runGuard();

        expect(router.serializeUrl(result as UrlTree)).toBe('/login?next=%2Fcheckout');
    });

    it('powinien przepuścić użytkownika Free', async () => {
        isAuthenticated.mockReturnValue(true);
        appRole.mockReturnValue('user');

        await expect(runGuard()).resolves.toBe(true);
        expect(ensureLoaded).not.toHaveBeenCalled();
    });

    it('powinien przepuścić użytkownika Premium w trialu', async () => {
        isAuthenticated.mockReturnValue(true);
        appRole.mockReturnValue('premium');
        isTrialing.mockReturnValue(true);

        await expect(runGuard()).resolves.toBe(true);
        expect(ensureLoaded).toHaveBeenCalledOnce();
    });

    it('powinien przekierować aktywnego użytkownika Premium do cennika', async () => {
        isAuthenticated.mockReturnValue(true);
        appRole.mockReturnValue('premium');

        const result = await runGuard();

        expect(router.serializeUrl(result as UrlTree)).toBe('/pricing');
        expect(snackBarOpen).toHaveBeenCalledWith('Masz już aktywne konto Premium.', 'OK', {
            duration: 5_000,
        });
    });

    it('powinien przekierować administratora do cennika', async () => {
        isAuthenticated.mockReturnValue(true);
        appRole.mockReturnValue('admin');

        const result = await runGuard();

        expect(router.serializeUrl(result as UrlTree)).toBe('/pricing');
        expect(ensureLoaded).not.toHaveBeenCalled();
        expect(snackBarOpen).not.toHaveBeenCalled();
    });

    it('powinien zastosować fail-open po błędzie GET /me', async () => {
        isAuthenticated.mockReturnValue(true);
        appRole.mockReturnValue('premium');
        loaded.mockReturnValue(false);

        await expect(runGuard()).resolves.toBe(true);
    });
});
