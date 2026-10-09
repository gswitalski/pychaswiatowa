import 'zone.js';
import 'zone.js/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';
import { NEVER } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { MyPlanService } from '../../core/services/my-plan.service';
import { MainLayoutComponent } from './main-layout.component';

describe('MainLayoutComponent', () => {
    const isAuthenticated = signal(false);
    const planState = signal(0);
    const prefetchPlan = vi.fn(() => {
        planState();
    });
    const resetPlanState = vi.fn();

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        isAuthenticated.set(false);
        planState.set(0);
        prefetchPlan.mockClear();
        resetPlanState.mockClear();

        TestBed.configureTestingModule({
            providers: [
                {
                    provide: AuthService,
                    useValue: { isAuthenticated },
                },
                {
                    provide: MyPlanService,
                    useValue: {
                        isDrawerOpen: signal(false),
                        hasItems: signal(false),
                        prefetchPlan,
                        resetPlanState,
                        loadPlanIfNeeded: vi.fn(),
                        closeDrawer: vi.fn(),
                    },
                },
                {
                    provide: LayoutService,
                    useValue: {
                        isSidebarOpen: signal(false),
                        isMobile: signal(false),
                        isMobileOrTablet: signal(false),
                        shouldShowSidebar: signal(false),
                        setShouldShowSidebar: vi.fn(),
                        closeSidebar: vi.fn(),
                    },
                },
                {
                    provide: Router,
                    useValue: {
                        url: '/',
                        events: NEVER,
                    },
                },
            ],
        });
    });

    it('ładuje plan dopiero po zalogowaniu i nie śledzi stanu planu', () => {
        TestBed.runInInjectionContext(() => new MainLayoutComponent());
        TestBed.tick();

        expect(resetPlanState).toHaveBeenCalledOnce();
        expect(prefetchPlan).not.toHaveBeenCalled();

        isAuthenticated.set(true);
        TestBed.tick();

        expect(prefetchPlan).toHaveBeenCalledOnce();

        planState.set(1);
        TestBed.tick();

        expect(prefetchPlan).toHaveBeenCalledOnce();
    });
});
