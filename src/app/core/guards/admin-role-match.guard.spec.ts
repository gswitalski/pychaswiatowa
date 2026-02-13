import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { AppRole } from '../../../../shared/contracts/types';
import { adminRoleMatchGuard } from './admin-role-match.guard';

describe('adminRoleMatchGuard', () => {
    const appRoleMock = vi.fn<() => AppRole>();
    const navigateMock = vi.fn();

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        vi.clearAllMocks();

        await TestBed.configureTestingModule({
            providers: [
                {
                    provide: AuthService,
                    useValue: {
                        appRole: appRoleMock,
                    } satisfies Partial<AuthService>,
                },
                {
                    provide: Router,
                    useValue: {
                        navigate: navigateMock,
                    } satisfies Partial<Router>,
                },
            ],
        }).compileComponents();
    });

    it('powinien przepuścić użytkownika z rolą admin', () => {
        appRoleMock.mockReturnValue('admin');

        const result = TestBed.runInInjectionContext(() =>
            adminRoleMatchGuard({} as never, [] as never)
        );

        expect(result).toBe(true);
        expect(navigateMock).not.toHaveBeenCalled();
    });

    it('powinien przekierować na /forbidden dla roli innej niż admin', () => {
        appRoleMock.mockReturnValue('user');

        const result = TestBed.runInInjectionContext(() =>
            adminRoleMatchGuard({} as never, [] as never)
        );

        expect(result).toBe(false);
        expect(navigateMock).toHaveBeenCalledWith(['/forbidden']);
    });
});
