import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';
import { signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
import { CLIPBOARD_IMAGE_UI_MESSAGES } from '../../../shared/services/clipboard-image.messages';
import { CameraCaptureButtonComponent } from '../../../shared/components/camera-capture-button/camera-capture-button.component';
import { ImageCompressionService } from '../../../shared/services/image-compression.service';

function assistPageProviders(readImageFile: ReturnType<typeof vi.fn>) {
    return [
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
        {
            provide: ImageCompressionService,
            useValue: {
                compressToMaxSize: vi.fn(async (file: File) => file),
            },
        },
    ];
}

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
            providers: assistPageProviders(readImageFile),
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

describe('RecipeNewAssistPageComponent (PS-93 aparat)', () => {
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
            imports: [RecipeNewAssistPageComponent],
            providers: assistPageProviders(readImageFile),
        });
    });

    function createComponent(): RecipeNewAssistPageComponent {
        return TestBed.runInInjectionContext(() => new RecipeNewAssistPageComponent());
    }

    async function createFixture(): Promise<ComponentFixture<RecipeNewAssistPageComponent>> {
        const fixture = TestBed.createComponent(RecipeNewAssistPageComponent);
        fixture.componentInstance.onSourceChange('image');
        fixture.detectChanges();
        return fixture;
    }

    it('ustawia imageFile po onCameraFileSelected (handleImageFile)', async () => {
        const component = createComponent();
        component.onSourceChange('image');
        const file = new File(['img'], 'camera-shot.jpeg', { type: 'image/jpeg' });

        await component.onCameraFileSelected(file);

        expect(component.imageFile()).toBe(file);
    });

    it('ignoruje plik z aparatu gdy isLoading()', async () => {
        const component = createComponent();
        component.onSourceChange('image');
        component.isLoading.set(true);

        await component.onCameraFileSelected(
            new File(['img'], 'camera-shot.jpeg', { type: 'image/jpeg' }),
        );

        expect(component.imageFile()).toBeNull();
    });

    it('waliduje format pliku z aparatu jak handleImageFile', () => {
        const component = createComponent();
        component.onSourceChange('image');

        component.onCameraFileSelected(
            new File(['gif'], 'anim.gif', { type: 'image/gif' }),
        );

        expect(component.imageFile()).toBeNull();
        expect(component.errorMessage()).toBe(CLIPBOARD_IMAGE_UI_MESSAGES.unsupportedFormat);
    });

    it('ustawia imageFile po fileSelected z pych-camera-capture-button', async () => {
        const fixture = await createFixture();
        const component = fixture.componentInstance;
        const file = new File(['png'], 'camera.png', { type: 'image/png' });

        const cameraDe = fixture.debugElement.query(
            By.directive(CameraCaptureButtonComponent),
        );
        expect(cameraDe).toBeTruthy();

        cameraDe.componentInstance.fileSelected.emit(file);
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.imageFile()).toBe(file);
    });

    it('dezaktywuje przycisk aparatu gdy isLoading()', async () => {
        const fixture = await createFixture();
        fixture.componentInstance.isLoading.set(true);
        fixture.detectChanges();

        const cameraButton = fixture.nativeElement.querySelector(
            '[aria-label="Zrób zdjęcie aparatem urządzenia"]',
        ) as HTMLButtonElement;

        expect(cameraButton.disabled).toBe(true);
    });
});
