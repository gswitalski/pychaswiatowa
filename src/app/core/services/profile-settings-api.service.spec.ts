import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { ProfileSettingsApiService } from './profile-settings-api.service';
import { SupabaseService } from './supabase.service';
import type {
    ChangePasswordCommand,
    ChangePasswordResponseDto,
    ProfileSettingsDto,
    UpdateProfileSettingsCommand,
} from '../../../../shared/contracts/types';

interface MockSupabaseService {
    functions: {
        invoke: ReturnType<typeof vi.fn>;
    };
}

describe('ProfileSettingsApiService', () => {
    let service: ProfileSettingsApiService;
    let mockSupabaseService: MockSupabaseService;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        mockSupabaseService = {
            functions: {
                invoke: vi.fn(),
            },
        };

        await TestBed.configureTestingModule({
            providers: [
                ProfileSettingsApiService,
                { provide: SupabaseService, useValue: mockSupabaseService },
            ],
        }).compileComponents();

        service = TestBed.inject(ProfileSettingsApiService);
        vi.clearAllMocks();
    });

    it('powinien pobrać ustawienia profilu (GET /profile)', async () => {
        const data: ProfileSettingsDto = {
            id: 'user-1',
            email: 'test@example.com',
            username: 'test-user',
            marketing_consent: true,
            marketing_consent_updated_at: '2026-03-28T10:00:00Z',
            marketing_consent_text_version: 'marketing-consent-pl-v1',
        };

        mockSupabaseService.functions.invoke.mockResolvedValue({
            data,
            error: null,
        });

        const result = await firstValueFrom(service.getProfileSettings());

        expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith('profile', {
            method: 'GET',
        });
        expect(result).toEqual(data);
    });

    it('powinien zapisać ustawienia profilu (PUT /profile)', async () => {
        const command: UpdateProfileSettingsCommand = {
            username: 'new-user',
            marketing_consent: false,
            marketing_consent_text_version: 'marketing-consent-pl-v1',
        };

        const responseData: ProfileSettingsDto = {
            id: 'user-1',
            email: 'test@example.com',
            username: 'new-user',
            marketing_consent: false,
            marketing_consent_updated_at: '2026-03-28T12:00:00Z',
            marketing_consent_text_version: 'marketing-consent-pl-v1',
        };

        mockSupabaseService.functions.invoke.mockResolvedValue({
            data: responseData,
            error: null,
        });

        const result = await firstValueFrom(service.updateProfileSettings(command));

        expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith('profile', {
            method: 'PUT',
            body: command,
        });
        expect(result).toEqual(responseData);
    });

    it('powinien zmienić hasło (POST /profile/change-password)', async () => {
        const command: ChangePasswordCommand = {
            current_password: 'OldSecret123!',
            new_password: 'NewSecret123!',
        };

        const responseData: ChangePasswordResponseDto = {
            status: 'ok',
            message: 'Password updated successfully.',
        };

        mockSupabaseService.functions.invoke.mockResolvedValue({
            data: responseData,
            error: null,
        });

        const result = await firstValueFrom(service.changePassword(command));

        expect(mockSupabaseService.functions.invoke).toHaveBeenCalledWith(
            'profile/change-password',
            {
                method: 'POST',
                body: command,
            }
        );
        expect(result).toEqual(responseData);
    });
});
