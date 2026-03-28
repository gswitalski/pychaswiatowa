import 'zone.js';
import 'zone.js/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ProfileSettingsApiService } from '../../../core/services/profile-settings-api.service';
import { ProfileSettingsFacade } from './profile-settings.facade';
import {
    ChangePasswordCommand,
    ProfileSettingsDto,
    UpdateProfileSettingsCommand,
} from '../../../../../shared/contracts/types';

describe('ProfileSettingsFacade', () => {
    const profileDto: ProfileSettingsDto = {
        id: 'user-1',
        email: 'test@pychaswiatowa.pl',
        username: 'kucharz',
        marketing_consent: false,
        marketing_consent_updated_at: null,
        marketing_consent_text_version: null,
    };

    const apiMock = {
        getProfileSettings: vi.fn(),
        updateProfileSettings: vi.fn(),
        changePassword: vi.fn(),
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        apiMock.getProfileSettings.mockReset();
        apiMock.updateProfileSettings.mockReset();
        apiMock.changePassword.mockReset();

        TestBed.configureTestingModule({
            providers: [
                ProfileSettingsFacade,
                { provide: ProfileSettingsApiService, useValue: apiMock },
            ],
        });
    });

    it('powinien załadować profil i wyłączyć loading', () => {
        const facade = TestBed.inject(ProfileSettingsFacade);
        apiMock.getProfileSettings.mockReturnValue(of(profileDto));

        facade.loadProfile();

        expect(facade.profile()).toEqual({
            ...profileDto,
            marketing_consent: false,
            marketing_consent_text_version: null,
        });
        expect(facade.isInitialLoading()).toBe(false);
        expect(facade.loadError()).toBe(null);
    });

    it('powinien mapować błąd 409 podczas zapisu', () => {
        const facade = TestBed.inject(ProfileSettingsFacade);
        const command: UpdateProfileSettingsCommand = {
            username: 'taken',
            marketing_consent: true,
            marketing_consent_text_version: 'marketing-consent-pl-v1',
        };
        apiMock.updateProfileSettings.mockReturnValue(
            throwError(() => ({
                message: 'Conflict',
                status: 409,
            }))
        );

        facade.saveProfile(command);

        expect(facade.isSavingProfile()).toBe(false);
        expect(facade.saveError()).toEqual({
            message: 'Ta nazwa użytkownika jest już zajęta.',
            status: 409,
        });
    });

    it('powinien mapować błąd 422 przy zmianie hasła', async () => {
        const facade = TestBed.inject(ProfileSettingsFacade);
        const command: ChangePasswordCommand = {
            current_password: 'BadOldPass',
            new_password: 'NewPass123',
        };
        apiMock.changePassword.mockReturnValue(
            throwError(() => ({
                message: 'Unprocessable',
                status: 422,
            }))
        );

        await expect(firstValueFrom(facade.changePassword(command))).rejects.toEqual({
            message: 'Podane stare hasło jest niepoprawne.',
            status: 422,
        });
    });
});
