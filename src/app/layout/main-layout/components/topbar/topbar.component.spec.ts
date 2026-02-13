import 'zone.js';
import 'zone.js/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRole } from '../../../../../../../shared/contracts/types';
import { AuthService } from '../../../../core/services/auth.service';
import { LayoutService } from '../../../../core/services/layout.service';
import { TopbarComponent } from './topbar.component';

describe('TopbarComponent', () => {
    const appRoleSignal = signal<AppRole>('user');
    const isMobileSignal = signal(false);
    const isMobileOrTabletSignal = signal(false);

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        appRoleSignal.set('user');
        isMobileSignal.set(false);
        isMobileOrTabletSignal.set(false);

        await TestBed.configureTestingModule({
            providers: [
                {
                    provide: AuthService,
                    useValue: {
                        appRole: appRoleSignal,
                        signOut: vi.fn().mockResolvedValue(undefined),
                    } satisfies Partial<AuthService>,
                },
                {
                    provide: LayoutService,
                    useValue: {
                        isMobile: isMobileSignal,
                        isMobileOrTablet: isMobileOrTabletSignal,
                        toggleSidebar: vi.fn(),
                    } satisfies Partial<LayoutService>,
                },
                {
                    provide: Router,
                    useValue: {
                        navigate: vi.fn(),
                    } satisfies Partial<Router>,
                },
            ],
        }).compileComponents();
    });

    it('powinien zawierać pozycję Admin dla roli admin', () => {
        const component = TestBed.runInInjectionContext(() => new TopbarComponent());
        appRoleSignal.set('admin');

        const routes = component.mainNavItems().map((item) => item.route);

        expect(routes).toContain('/admin/dashboard');
    });

    it('nie powinien zawierać pozycji Admin dla roli nie-admin', () => {
        const component = TestBed.runInInjectionContext(() => new TopbarComponent());
        appRoleSignal.set('user');

        const routes = component.mainNavItems().map((item) => item.route);

        expect(routes).not.toContain('/admin/dashboard');
    });
});
