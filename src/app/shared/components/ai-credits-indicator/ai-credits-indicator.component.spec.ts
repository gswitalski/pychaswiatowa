import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { AiCreditsIndicatorComponent } from './ai-credits-indicator.component';
import { AiCreditsService } from '../../../core/services/ai-credits.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { AiCreditsResponseDto } from '../../../../../shared/contracts/types';

describe('AiCreditsIndicatorComponent', () => {
    const invoke = vi.fn();
    const dialogOpen = vi.fn();
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
        dialogOpen.mockReset();
        TestBed.configureTestingModule({
            imports: [AiCreditsIndicatorComponent, NoopAnimationsModule],
            providers: [
                AiCreditsService,
                {
                    provide: SupabaseService,
                    useValue: { functions: { invoke } },
                },
                { provide: MatDialog, useValue: { open: dialogOpen } },
            ],
        });
        creditsService = TestBed.inject(AiCreditsService);
    });

    async function renderWithCredits(response: AiCreditsResponseDto) {
        invoke.mockResolvedValue({ data: response, error: null });
        await firstValueFrom(creditsService.loadCredits());

        const fixture = TestBed.createComponent(AiCreditsIndicatorComponent);
        fixture.componentRef.setInput('type', 'draft');
        fixture.detectChanges();
        return fixture;
    }

    it('wyświetla wariant normalny', async () => {
        const fixture = await renderWithCredits({
            limit_type: 'lifetime',
            draft: { total: 10, used: 2, remaining: 8 },
            image: { total: 4, used: 0, remaining: 4 },
            next_reset_at: null,
        });

        expect(fixture.nativeElement.querySelector('.normal')).toBeTruthy();
        expect(fixture.nativeElement.textContent).toContain('Kredyty AI: 8 / 10');
    });

    it('wyświetla ostrzeżenie dla maksymalnie 25% pozostałej puli', async () => {
        const fixture = await renderWithCredits({
            limit_type: 'monthly',
            draft: { total: 8, used: 6, remaining: 2 },
            image: { total: 4, used: 0, remaining: 4 },
            next_reset_at: '2026-10-15T00:00:00.000Z',
        });

        expect(fixture.nativeElement.querySelector('.warning')).toBeTruthy();
    });

    it('otwiera dialog po kliknięciu wyczerpanego wskaźnika', async () => {
        const fixture = await renderWithCredits({
            limit_type: 'lifetime',
            draft: { total: 3, used: 3, remaining: 0 },
            image: { total: 0, used: 0, remaining: 0 },
            next_reset_at: null,
        });

        const indicator = fixture.nativeElement.querySelector(
            '.exhausted'
        ) as HTMLElement;
        indicator.click();

        expect(dialogOpen).toHaveBeenCalledOnce();
        expect(dialogOpen).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                data: {
                    creditType: 'draft',
                    limitType: 'lifetime',
                    nextResetAt: null,
                },
            })
        );
    });

    it('ukrywa wskaźnik dla nielimitowanego konta', () => {
        creditsService.bootstrapFromMeResponse({
            draft_remaining: null,
            image_remaining: null,
            limit_type: 'unlimited',
            next_reset_at: null,
        });

        const fixture = TestBed.createComponent(AiCreditsIndicatorComponent);
        fixture.componentRef.setInput('type', 'draft');
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent.trim()).toBe('');
        expect(fixture.nativeElement.querySelector('mat-spinner')).toBeNull();
    });
});
