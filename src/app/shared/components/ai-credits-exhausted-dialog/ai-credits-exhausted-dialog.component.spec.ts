import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiCreditsExhaustedDialogComponent } from './ai-credits-exhausted-dialog.component';

describe('AiCreditsExhaustedDialogComponent', () => {
    const close = vi.fn();
    const navigate = vi.fn();

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        close.mockReset();
        navigate.mockReset();
        navigate.mockResolvedValue(true);

        TestBed.configureTestingModule({
            imports: [AiCreditsExhaustedDialogComponent, NoopAnimationsModule],
            providers: [
                { provide: MatDialogRef, useValue: { close } },
                { provide: Router, useValue: { navigate } },
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {
                        creditType: 'draft',
                        limitType: 'lifetime',
                        nextResetAt: null,
                    },
                },
            ],
        });
    });

    it('pokazuje CTA Premium dla limitu dożywotniego', () => {
        const fixture = TestBed.createComponent(AiCreditsExhaustedDialogComponent);
        fixture.detectChanges();

        const buttons = Array.from(
            fixture.nativeElement.querySelectorAll('button')
        ) as HTMLButtonElement[];
        const premiumButton = buttons.find((button) =>
            button.textContent?.includes('Przejdź na Premium')
        );
        premiumButton?.click();

        expect(premiumButton).toBeTruthy();
        expect(close).toHaveBeenCalledOnce();
        expect(navigate).toHaveBeenCalledWith(['/pricing']);
    });

    it('pokazuje datę resetu dla limitu miesięcznego', () => {
        TestBed.overrideProvider(MAT_DIALOG_DATA, {
            useValue: {
                creditType: 'image',
                limitType: 'monthly',
                nextResetAt: new Date('2026-10-15T00:00:00.000Z'),
            },
        });
        const fixture = TestBed.createComponent(AiCreditsExhaustedDialogComponent);
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain(
            'Nowe kredyty będą dostępne'
        );
        expect(fixture.nativeElement.textContent).not.toContain(
            'Przejdź na Premium'
        );
    });
});
