import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import type { ProfileSettingsDto } from '../../../../../shared/contracts/types';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileSettingsApiService } from '../../../core/services/profile-settings-api.service';
import { AuthCallbackPageComponent } from './auth-callback-page.component';

interface CallbackComponentAccess {
    processCallback(): Promise<void>;
}

describe('AuthCallbackPageComponent', () => {
    let component: AuthCallbackPageComponent;
    let queryParams: Record<string, string> = {};
    let router: { navigate: ReturnType<typeof vi.fn> };
    let authService: {
        exchangeCodeForSession: ReturnType<typeof vi.fn>;
        getSession: ReturnType<typeof vi.fn>;
        signOut: ReturnType<typeof vi.fn>;
    };
    let profileSettingsApi: {
        getProfileSettings: ReturnType<typeof vi.fn>;
    };

    const profileWithoutUsername: ProfileSettingsDto = {
        id: 'user-1',
        email: 'test@example.com',
        username: '',
        marketing_consent: false,
        marketing_consent_updated_at: null,
        marketing_consent_text_version: null,
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        queryParams = {};
        router = { navigate: vi.fn() };
        authService = {
            exchangeCodeForSession: vi.fn(),
            getSession: vi.fn(),
            signOut: vi.fn(),
        };
        profileSettingsApi = { getProfileSettings: vi.fn() };

        await TestBed.configureTestingModule({
            imports: [AuthCallbackPageComponent],
            providers: [
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: {
                                get: (name: string) =>
                                    convertToParamMap(queryParams).get(name),
                            },
                        },
                    },
                },
                { provide: Router, useValue: router },
                { provide: AuthService, useValue: authService },
                {
                    provide: ProfileSettingsApiService,
                    useValue: profileSettingsApi,
                },
            ],
        }).compileComponents();

        component = TestBed.createComponent(AuthCallbackPageComponent).componentInstance;
    });

    it('powinien przekierować nowego użytkownika OAuth do uzupełnienia profilu', async () => {
        queryParams = { code: 'oauth-code' };
        authService.exchangeCodeForSession.mockResolvedValue({ success: true });
        profileSettingsApi.getProfileSettings.mockReturnValue(of(profileWithoutUsername));

        await (component as unknown as CallbackComponentAccess).processCallback();

        expect(router.navigate).toHaveBeenCalledWith(['/auth/complete-profile']);
    });

    it('powinien przekierować użytkownika z username do dashboardu', async () => {
        queryParams = { code: 'oauth-code' };
        authService.exchangeCodeForSession.mockResolvedValue({ success: true });
        profileSettingsApi.getProfileSettings.mockReturnValue(
            of({ ...profileWithoutUsername, username: 'test-user' })
        );

        await (component as unknown as CallbackComponentAccess).processCallback();

        expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('powinien obsłużyć odmowę dostępu Google', async () => {
        queryParams = { error: 'access_denied' };

        await (component as unknown as CallbackComponentAccess).processCallback();

        expect(router.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: { error: 'access_denied' },
        });
    });

    it('powinien przekierować na błąd profilu, gdy GET /profile się nie powiedzie', async () => {
        queryParams = { code: 'oauth-code' };
        authService.exchangeCodeForSession.mockResolvedValue({ success: true });
        profileSettingsApi.getProfileSettings.mockReturnValue(
            throwError(() => new Error('Profile unavailable'))
        );

        await (component as unknown as CallbackComponentAccess).processCallback();

        expect(router.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: { error: 'profile_error' },
        });
    });

    it('powinien zachować flow potwierdzania e-maila', async () => {
        queryParams = { type: 'email', code: 'email-code' };
        authService.exchangeCodeForSession.mockResolvedValue({ success: true });
        authService.signOut.mockResolvedValue(undefined);

        await (component as unknown as CallbackComponentAccess).processCallback();

        expect(authService.signOut).toHaveBeenCalledOnce();
        expect(router.navigate).toHaveBeenCalledWith(['/email-confirmed']);
    });
});
