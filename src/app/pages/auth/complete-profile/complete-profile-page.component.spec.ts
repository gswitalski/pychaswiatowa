import 'zone.js';
import 'zone.js/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileSettingsDto } from '../../../../../shared/contracts/types';
import { CurrentUserStateService } from '../../../core/services/current-user-state.service';
import { PostAuthRedirectService } from '../../../core/services/post-auth-redirect.service';
import { ProfileCompletionService } from '../../../core/services/profile-completion.service';
import { ProfileSettingsApiService } from '../../../core/services/profile-settings-api.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CompleteProfilePageComponent } from './complete-profile-page.component';

describe('CompleteProfilePageComponent', () => {
    let fixture: ComponentFixture<CompleteProfilePageComponent>;
    let api: { updateProfileSettings: ReturnType<typeof vi.fn> };
    let markComplete: ReturnType<typeof vi.fn>;
    let navigateByUrl: ReturnType<typeof vi.fn>;

    const profile: ProfileSettingsDto = {
        id: 'u1',
        email: 'test@example.com',
        username: 'Jan',
        marketing_consent: false,
        marketing_consent_updated_at: null,
        marketing_consent_text_version: null,
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        api = { updateProfileSettings: vi.fn().mockReturnValue(of(profile)) };
        markComplete = vi.fn();
        navigateByUrl = vi.fn().mockResolvedValue(true);

        await TestBed.configureTestingModule({
            imports: [CompleteProfilePageComponent],
            providers: [
                { provide: ProfileSettingsApiService, useValue: api },
                {
                    provide: ProfileCompletionService,
                    useValue: { ensureChecked: vi.fn().mockResolvedValue(false), markComplete },
                },
                {
                    provide: SupabaseService,
                    useValue: { auth: { getUser: vi.fn() } },
                },
                { provide: PostAuthRedirectService, useValue: { consume: vi.fn().mockReturnValue(null) } },
                { provide: Router, useValue: { navigate: vi.fn(), navigateByUrl } },
                { provide: MatSnackBar, useValue: { open: vi.fn() } },
            ],
        })
            .overrideComponent(CompleteProfilePageComponent, {
                set: { imports: [], template: '' },
            })
            .compileComponents();

        fixture = TestBed.createComponent(CompleteProfilePageComponent);
        TestBed.inject(CurrentUserStateService).switchUser('u1');
        fixture.detectChanges();
    });

    it('aktualizuje nazwę przed oznaczeniem profilu i nawigacją', async () => {
        const applyProfile = vi.spyOn(
            TestBed.inject(CurrentUserStateService),
            'applyProfile',
        );
        await fixture.componentInstance.handleSave('  Jan  ');

        expect(api.updateProfileSettings).toHaveBeenCalledWith({
            username: 'Jan',
            marketing_consent: false,
            marketing_consent_text_version: 'marketing-consent-pl-v1',
        });
        expect(TestBed.inject(CurrentUserStateService).displayName()).toBe('Jan');
        expect(applyProfile.mock.invocationCallOrder[0]).toBeLessThan(
            markComplete.mock.invocationCallOrder[0],
        );
        expect(markComplete.mock.invocationCallOrder[0]).toBeLessThan(
            navigateByUrl.mock.invocationCallOrder[0],
        );
        expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });

    it('nie wysyła pustej nazwy', async () => {
        await fixture.componentInstance.handleSave('   ');

        expect(api.updateProfileSettings).not.toHaveBeenCalled();
        expect(markComplete).not.toHaveBeenCalled();
    });

    it('nie zmienia stanu ani nie nawiguje po błędzie zapisu', async () => {
        const applyProfile = vi.spyOn(
            TestBed.inject(CurrentUserStateService),
            'applyProfile',
        );
        api.updateProfileSettings.mockReturnValue(
            throwError(() => ({ status: 500, message: 'Błąd serwera' })),
        );

        await fixture.componentInstance.handleSave('Jan');

        expect(applyProfile).not.toHaveBeenCalled();
        expect(markComplete).not.toHaveBeenCalled();
        expect(navigateByUrl).not.toHaveBeenCalled();
        expect(fixture.componentInstance.state().serverError).toBe('Błąd serwera');
        expect(fixture.componentInstance.state().isSaving).toBe(false);
    });
});
