import 'zone.js';
import 'zone.js/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { AiCreditsSettingsSectionComponent } from './ai-credits-settings-section.component';
import { AiCreditsService } from '../../../../core/services/ai-credits.service';
import { AuthService } from '../../../../core/services/auth.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { AppRole } from '../../../../../../shared/contracts/types';

describe('AiCreditsSettingsSectionComponent', () => {
    const invoke = vi.fn();
    const appRole = signal<AppRole>('user');
    let creditsService: AiCreditsService;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        invoke.mockReset();
        appRole.set('user');
        TestBed.configureTestingModule({
            imports: [AiCreditsSettingsSectionComponent, NoopAnimationsModule],
            providers: [
                provideRouter([]),
                AiCreditsService,
                {
                    provide: SupabaseService,
                    useValue: { functions: { invoke } },
                },
                {
                    provide: AuthService,
                    useValue: { appRole },
                },
            ],
        });
        creditsService = TestBed.inject(AiCreditsService);
    });

    it('pokazuje wykorzystanie i CTA dla wyczerpanego użytkownika Free', async () => {
        invoke.mockResolvedValue({
            data: {
                limit_type: 'lifetime',
                draft: { total: 3, used: 3, remaining: 0 },
                image: { total: 2, used: 1, remaining: 1 },
                next_reset_at: null,
            },
            error: null,
        });
        await firstValueFrom(creditsService.loadCredits());

        const fixture = TestBed.createComponent(AiCreditsSettingsSectionComponent);
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain(
            'Użyto 3 z 3 kredytów'
        );
        expect(fixture.nativeElement.textContent).toContain(
            'Limit dożywotni wyczerpany'
        );
        expect(fixture.nativeElement.textContent).toContain('Przejdź na Premium');
    });

    it('nie renderuje sekcji dla administratora', () => {
        appRole.set('admin');
        const fixture = TestBed.createComponent(AiCreditsSettingsSectionComponent);
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent.trim()).toBe('');
    });
});
