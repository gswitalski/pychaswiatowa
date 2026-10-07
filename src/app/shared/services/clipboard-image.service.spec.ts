import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClipboardImageService } from './clipboard-image.service';
import { ClipboardImageError } from './clipboard-image.types';
import { CLIPBOARD_IMAGE_UI_MESSAGES } from './clipboard-image.messages';

describe('ClipboardImageService', () => {
    let service: ClipboardImageService;
    let clipboardRead: ReturnType<typeof vi.fn>;
    let originalNavigator: Navigator;
    let originalIsSecureContext: boolean;

    beforeEach(() => {
        service = new ClipboardImageService();
        clipboardRead = vi.fn();
        originalNavigator = globalThis.navigator;
        originalIsSecureContext = window.isSecureContext;

        Object.defineProperty(window, 'isSecureContext', {
            value: true,
            configurable: true,
        });

        Object.defineProperty(globalThis, 'navigator', {
            value: {
                ...originalNavigator,
                clipboard: { read: clipboardRead },
            },
            configurable: true,
        });
    });

    afterEach(() => {
        Object.defineProperty(globalThis, 'navigator', {
            value: originalNavigator,
            configurable: true,
        });
        Object.defineProperty(window, 'isSecureContext', {
            value: originalIsSecureContext,
            configurable: true,
        });
        vi.restoreAllMocks();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('isClipboardReadSupported', () => {
        it('zwraca true gdy secure context i clipboard.read istnieje', () => {
            expect(service.isClipboardReadSupported()).toBe(true);
        });

        it('zwraca false gdy brak clipboard.read', () => {
            Object.defineProperty(globalThis, 'navigator', {
                value: { clipboard: {} },
                configurable: true,
            });

            expect(service.isClipboardReadSupported()).toBe(false);
        });

        it('zwraca false poza secure context', () => {
            Object.defineProperty(window, 'isSecureContext', {
                value: false,
                configurable: true,
            });

            expect(service.isClipboardReadSupported()).toBe(false);
        });
    });

    describe('readImageFile', () => {
        it('zwraca File dla PNG ze schowka', async () => {
            const pngBlob = new Blob(['png-bytes'], { type: 'image/png' });
            const item: ClipboardItem = {
                types: ['image/png'],
                getType: vi.fn().mockResolvedValue(pngBlob),
            };
            clipboardRead.mockResolvedValue([item]);

            const file = await service.readImageFile();

            expect(file.type).toBe('image/png');
            expect(file.name).toBe('clipboard-paste.png');
            expect(file.size).toBe(pngBlob.size);
        });

        it('rzuca NO_IMAGE gdy schowek pusty', async () => {
            clipboardRead.mockResolvedValue([]);

            await expect(service.readImageFile()).rejects.toMatchObject({
                code: 'NO_IMAGE',
            });
        });

        it('rzuca NO_IMAGE gdy brak obrazu w elementach', async () => {
            const item: ClipboardItem = {
                types: ['text/plain'],
                getType: vi.fn(),
            };
            clipboardRead.mockResolvedValue([item]);

            await expect(service.readImageFile()).rejects.toMatchObject({
                code: 'NO_IMAGE',
            });
        });

        it('rzuca UNSUPPORTED_FORMAT dla GIF', async () => {
            const gifBlob = new Blob(['gif'], { type: 'image/gif' });
            const item: ClipboardItem = {
                types: ['image/gif'],
                getType: vi.fn().mockResolvedValue(gifBlob),
            };
            clipboardRead.mockResolvedValue([item]);

            await expect(service.readImageFile()).rejects.toMatchObject({
                code: 'UNSUPPORTED_FORMAT',
            });
        });

        it('rzuca FILE_TOO_LARGE gdy blob przekracza 10 MB', async () => {
            const largeBlob = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], {
                type: 'image/png',
            });
            const item: ClipboardItem = {
                types: ['image/png'],
                getType: vi.fn().mockResolvedValue(largeBlob),
            };
            clipboardRead.mockResolvedValue([item]);

            await expect(service.readImageFile()).rejects.toMatchObject({
                code: 'FILE_TOO_LARGE',
            });
        });

        it('mapuje NotAllowedError na PERMISSION_DENIED', async () => {
            const denied = new DOMException('denied', 'NotAllowedError');
            clipboardRead.mockRejectedValue(denied);

            await expect(service.readImageFile()).rejects.toMatchObject({
                code: 'PERMISSION_DENIED',
            });
        });

        it('mapuje inny błąd odczytu na READ_FAILED', async () => {
            clipboardRead.mockRejectedValue(new Error('unexpected'));

            await expect(service.readImageFile()).rejects.toMatchObject({
                code: 'READ_FAILED',
            });
        });
    });

    describe('messageForError', () => {
        it('zwraca komunikat dla ClipboardImageError', () => {
            const err = new ClipboardImageError('NO_IMAGE', CLIPBOARD_IMAGE_UI_MESSAGES.noImage);

            expect(service.messageForError(err)).toBe(CLIPBOARD_IMAGE_UI_MESSAGES.noImage);
        });

        it('zwraca generyczny komunikat dla nieznanego błędu', () => {
            expect(service.messageForError(new Error('x'))).toBe(
                CLIPBOARD_IMAGE_UI_MESSAGES.readFailed,
            );
        });
    });
});
