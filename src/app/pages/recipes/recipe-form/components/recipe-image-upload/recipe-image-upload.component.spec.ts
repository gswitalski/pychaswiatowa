import '@angular/compiler';
import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeImageUploadComponent } from './recipe-image-upload.component';
import { RecipesService } from '../../../services/recipes.service';
import { SupabaseService } from '../../../../../core/services/supabase.service';
import { ClipboardImageService } from '../../../../../shared/services/clipboard-image.service';
import { ClipboardImageError } from '../../../../../shared/services/clipboard-image.types';
import { CLIPBOARD_IMAGE_UI_MESSAGES } from '../../../../../shared/services/clipboard-image.messages';

describe('RecipeImageUploadComponent (PS-92 schowek)', () => {
    let readImageFile: ReturnType<typeof vi.fn>;
    let isClipboardReadSupported: ReturnType<typeof vi.fn>;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting(),
        );
    });

    beforeEach(() => {
        readImageFile = vi.fn();
        isClipboardReadSupported = vi.fn(() => true);

        TestBed.configureTestingModule({
            imports: [RecipeImageUploadComponent],
            providers: [
                {
                    provide: ClipboardImageService,
                    useValue: {
                        isClipboardReadSupported,
                        readImageFile,
                        messageForError: (error: unknown) => {
                            if (error instanceof ClipboardImageError) {
                                return CLIPBOARD_IMAGE_UI_MESSAGES.noImage;
                            }
                            return CLIPBOARD_IMAGE_UI_MESSAGES.readFailed;
                        },
                    },
                },
                {
                    provide: RecipesService,
                    useValue: {
                        uploadRecipeImage: vi.fn(),
                        deleteRecipeImage: vi.fn(),
                    },
                },
                {
                    provide: SupabaseService,
                    useValue: {
                        storage: {
                            from: () => ({
                                getPublicUrl: (path: string) => ({
                                    data: { publicUrl: `https://cdn.test/${path}` },
                                }),
                            }),
                        },
                    },
                },
                {
                    provide: MatSnackBar,
                    useValue: {
                        open: vi.fn(() => ({
                            onAction: () => ({ subscribe: vi.fn() }),
                        })),
                    },
                },
            ],
        });
    });

    function createFixture(options?: { disabled?: boolean; clipboardSupported?: boolean }) {
        isClipboardReadSupported.mockReturnValue(options?.clipboardSupported ?? true);

        const fixture = TestBed.createComponent(RecipeImageUploadComponent);
        fixture.componentInstance.disabled = options?.disabled ?? false;
        fixture.detectChanges();
        return fixture;
    }

    function getClipboardButton(fixture: ReturnType<typeof TestBed.createComponent>): HTMLButtonElement {
        return fixture.nativeElement.querySelector(
            '[aria-label="Wklej zdjęcie ze schowka"]',
        ) as HTMLButtonElement;
    }

    it('po kliknięciu schowka emituje pendingFileChanged z plikiem z serwisu', async () => {
        const file = new File(['png'], 'clipboard-paste.png', { type: 'image/png' });
        readImageFile.mockResolvedValue(file);

        const fixture = createFixture();
        const component = fixture.componentInstance;
        const emitSpy = vi.spyOn(component.imageEvent, 'emit');

        await component.onPasteFromClipboardClick({
            stopPropagation: vi.fn(),
        } as unknown as MouseEvent);

        expect(readImageFile).toHaveBeenCalledOnce();
        expect(emitSpy).toHaveBeenCalledWith({ type: 'pendingFileChanged', file });
    });

    it('wyświetla komunikat błędu gdy readImageFile rzuca wyjątek', async () => {
        readImageFile.mockRejectedValue(
            new ClipboardImageError('NO_IMAGE', CLIPBOARD_IMAGE_UI_MESSAGES.noImage),
        );

        const fixture = createFixture();
        const component = fixture.componentInstance;

        await component.onPasteFromClipboardClick({
            stopPropagation: vi.fn(),
        } as unknown as MouseEvent);

        expect(component.error()).toBe(CLIPBOARD_IMAGE_UI_MESSAGES.noImage);
    });

    it('dezaktywuje przycisk schowka gdy brak wsparcia Clipboard API', () => {
        const fixture = createFixture({ clipboardSupported: false });
        fixture.detectChanges();

        expect(getClipboardButton(fixture).disabled).toBe(true);
    });

    it('dezaktywuje przycisk schowka gdy komponent jest disabled', () => {
        const fixture = createFixture({ disabled: true });
        fixture.detectChanges();

        expect(getClipboardButton(fixture).disabled).toBe(true);
    });

    it('blokuje wklejanie ze schowka podczas uploadu', () => {
        const fixture = createFixture();
        const component = fixture.componentInstance;
        component.uiState.set('uploading');

        expect(component.isClipboardPasteDisabled).toBe(true);
    });
});
