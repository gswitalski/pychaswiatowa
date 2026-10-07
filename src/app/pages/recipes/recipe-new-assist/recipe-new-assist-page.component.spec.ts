import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeNewAssistPageComponent } from './recipe-new-assist-page.component';
import { AiRecipeDraftService } from '../services/ai-recipe-draft.service';
import { RecipeDraftStateService } from '../services/recipe-draft-state.service';
import { AiCreditsService } from '../../../core/services/ai-credits.service';
import { ClipboardImageService } from '../../../shared/services/clipboard-image.service';

describe('RecipeNewAssistPageComponent (PS-92 schowek)', () => {
    let readImageFile: ReturnType<typeof vi.fn>;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting(),
        );
    });

    beforeEach(() => {
        readImageFile = vi.fn();

        TestBed.configureTestingModule({
            providers: [
                {
                    provide: Router,
                    useValue: { navigate: vi.fn() },
                },
                {
                    provide: AiRecipeDraftService,
                    useValue: { generateDraft: vi.fn() },
                },
                {
                    provide: RecipeDraftStateService,
                    useValue: { setDraft: vi.fn(), clearDraft: vi.fn() },
                },
                {
                    provide: AiCreditsService,
                    useValue: {
                        credits: signal(null),
                        isExhausted: vi.fn(() => false),
                        refreshCredits: vi.fn(),
                    },
                },
                {
                    provide: MatDialog,
                    useValue: { open: vi.fn() },
                },
                {
                    provide: ClipboardImageService,
                    useValue: {
                        isClipboardReadSupported: vi.fn(() => true),
                        readImageFile,
                        messageForError: vi.fn(() => 'błąd schowka'),
                    },
                },
            ],
        });
    });

    function createComponent(): RecipeNewAssistPageComponent {
        return TestBed.runInInjectionContext(() => new RecipeNewAssistPageComponent());
    }

    it('ustawia imageFile po kliknięciu schowka w trybie obrazu', async () => {
        const file = new File(['img'], 'clipboard-paste.png', { type: 'image/png' });
        readImageFile.mockResolvedValue(file);

        const component = createComponent();
        component.onSourceChange('image');

        await component.onPasteFromClipboardClick({
            stopPropagation: vi.fn(),
        } as unknown as MouseEvent);

        expect(readImageFile).toHaveBeenCalledOnce();
        expect(component.imageFile()).toBe(file);
    });

    it('ignoruje klik schowka w trybie tekstowym', async () => {
        const component = createComponent();
        component.onSourceChange('text');

        await component.onPasteFromClipboardClick({
            stopPropagation: vi.fn(),
        } as unknown as MouseEvent);

        expect(readImageFile).not.toHaveBeenCalled();
    });
});
