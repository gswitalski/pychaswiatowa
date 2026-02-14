import 'zone.js';
import 'zone.js/testing';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AiRecipeImagePreviewDialogComponent } from './ai-recipe-image-preview-dialog.component';

describe('AiRecipeImagePreviewDialogComponent', () => {
    const mockDialogRef = {
        close: vi.fn(),
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        vi.useFakeTimers();
        mockDialogRef.close.mockReset();

        TestBed.configureTestingModule({
            imports: [AiRecipeImagePreviewDialogComponent],
            providers: [
                { provide: MatDialogRef, useValue: mockDialogRef },
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: {
                        recipeName: 'Testowy przepis',
                        modeLabel: 'Z przepisu',
                        promptHintMaxLength: 400,
                    },
                },
            ],
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('powinien przejść do loading i emitować prompt_hint po kliknięciu generuj', () => {
        const fixture = TestBed.createComponent(AiRecipeImagePreviewDialogComponent);
        const component = fixture.componentInstance;
        const emitSpy = vi.spyOn(component.generateRequested, 'emit');
        fixture.detectChanges();

        component.promptHint.set('  ciepłe światło  ');
        component.onGenerate();

        expect(component.state()).toBe('loading');
        expect(emitSpy).toHaveBeenCalledWith({ promptHint: 'ciepłe światło' });
    });

    it('powinien aktywować cooldown i odblokować generowanie po czasie', () => {
        const fixture = TestBed.createComponent(AiRecipeImagePreviewDialogComponent);
        const component = fixture.componentInstance;
        fixture.detectChanges();

        component.onGenerate();
        expect(component.isCooldownActive()).toBe(true);
        expect(component.cooldownRemainingSeconds()).toBeGreaterThan(0);

        vi.advanceTimersByTime(26000);
        fixture.detectChanges();

        expect(component.isCooldownActive()).toBe(false);
        expect(component.cooldownRemainingSeconds()).toBe(0);
    });
});
