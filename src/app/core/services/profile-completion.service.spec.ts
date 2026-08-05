import 'zone.js';
import 'zone.js/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import type { ProfileSettingsDto } from '../../../../shared/contracts/types';
import { AuthService } from './auth.service';
import { ProfileCompletionService } from './profile-completion.service';
import { ProfileSettingsApiService } from './profile-settings-api.service';

describe('ProfileCompletionService', () => {
    let service: ProfileCompletionService;
    let getProfileSettings: ReturnType<typeof vi.fn>;
    const userId = signal<string | null>('user-1');

    const completeProfile: ProfileSettingsDto = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'test-user',
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
        userId.set('user-1');
        getProfileSettings = vi.fn();

        await TestBed.configureTestingModule({
            providers: [
                ProfileCompletionService,
                {
                    provide: AuthService,
                    useValue: { userId },
                },
                {
                    provide: ProfileSettingsApiService,
                    useValue: { getProfileSettings },
                },
            ],
        }).compileComponents();

        service = TestBed.inject(ProfileCompletionService);
        TestBed.tick();
    });

    it('powinien cache’ować wynik po pierwszym sprawdzeniu', async () => {
        getProfileSettings.mockReturnValue(of(completeProfile));

        await expect(service.ensureChecked()).resolves.toBe(true);
        await expect(service.ensureChecked()).resolves.toBe(true);

        expect(getProfileSettings).toHaveBeenCalledOnce();
        expect(service.status()).toBe('complete');
    });

    it('powinien resetować cache po zmianie zalogowanego użytkownika', async () => {
        getProfileSettings.mockReturnValue(of(completeProfile));
        await service.ensureChecked();

        userId.set('user-2');
        TestBed.tick();

        expect(service.status()).toBe('unknown');
    });

    it('powinien oznaczyć profil jako kompletny po ręcznym zapisie', () => {
        service.markComplete();

        expect(service.status()).toBe('complete');
    });

    it('powinien traktować błąd pobrania profilu jako profil niekompletny', async () => {
        getProfileSettings.mockReturnValue(
            throwError(() => new Error('Network error'))
        );

        await expect(service.ensureChecked()).resolves.toBe(false);

        expect(service.status()).toBe('incomplete');
    });
});
