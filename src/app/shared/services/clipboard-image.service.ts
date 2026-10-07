import { Injectable } from '@angular/core';
import {
    CLIPBOARD_IMAGE_ACCEPTED_MIME_TYPES,
    CLIPBOARD_IMAGE_MAX_BYTES,
    ClipboardAcceptedMimeType,
    ClipboardImageError,
} from './clipboard-image.types';
import {
    CLIPBOARD_IMAGE_UI_MESSAGES,
    messageForClipboardImageErrorCode,
} from './clipboard-image.messages';

@Injectable({
    providedIn: 'root',
})
export class ClipboardImageService {
    private readonly acceptedMimeSet = new Set<string>(CLIPBOARD_IMAGE_ACCEPTED_MIME_TYPES);

    isClipboardReadSupported(): boolean {
        return (
            typeof navigator !== 'undefined'
            && typeof window !== 'undefined'
            && window.isSecureContext
            && !!navigator.clipboard?.read
        );
    }

    async readImageFile(): Promise<File> {
        if (!this.isClipboardReadSupported()) {
            throw new ClipboardImageError(
                'READ_FAILED',
                CLIPBOARD_IMAGE_UI_MESSAGES.readFailed,
            );
        }

        try {
            const items = await navigator.clipboard.read();
            return await this.extractAcceptedImageFile(items);
        } catch (error) {
            if (error instanceof ClipboardImageError) {
                throw error;
            }

            if (this.isNotAllowedError(error)) {
                throw new ClipboardImageError(
                    'PERMISSION_DENIED',
                    CLIPBOARD_IMAGE_UI_MESSAGES.permissionDenied,
                );
            }

            throw new ClipboardImageError(
                'READ_FAILED',
                CLIPBOARD_IMAGE_UI_MESSAGES.readFailed,
            );
        }
    }

    messageForError(error: unknown): string {
        if (error instanceof ClipboardImageError) {
            return messageForClipboardImageErrorCode(error.code);
        }

        return CLIPBOARD_IMAGE_UI_MESSAGES.readFailed;
    }

    private async extractAcceptedImageFile(items: ClipboardItem[]): Promise<File> {
        if (!items.length) {
            throw new ClipboardImageError(
                'NO_IMAGE',
                CLIPBOARD_IMAGE_UI_MESSAGES.noImage,
            );
        }

        let sawUnsupportedImage = false;

        for (const item of items) {
            for (const type of item.types) {
                if (!type.startsWith('image/')) {
                    continue;
                }

                if (!this.acceptedMimeSet.has(type)) {
                    sawUnsupportedImage = true;
                    continue;
                }

                const mime = type as ClipboardAcceptedMimeType;
                const blob = await item.getType(mime);

                if (blob.size > CLIPBOARD_IMAGE_MAX_BYTES) {
                    throw new ClipboardImageError(
                        'FILE_TOO_LARGE',
                        CLIPBOARD_IMAGE_UI_MESSAGES.fileTooLarge,
                    );
                }

                return new File([blob], this.fileNameForMime(mime), { type: mime });
            }
        }

        if (sawUnsupportedImage) {
            throw new ClipboardImageError(
                'UNSUPPORTED_FORMAT',
                CLIPBOARD_IMAGE_UI_MESSAGES.unsupportedFormat,
            );
        }

        throw new ClipboardImageError(
            'NO_IMAGE',
            CLIPBOARD_IMAGE_UI_MESSAGES.noImage,
        );
    }

    private fileNameForMime(mime: ClipboardAcceptedMimeType): string {
        switch (mime) {
            case 'image/png':
                return 'clipboard-paste.png';
            case 'image/jpeg':
                return 'clipboard-paste.jpg';
            case 'image/webp':
                return 'clipboard-paste.webp';
            default:
                return 'clipboard-paste.bin';
        }
    }

    private isNotAllowedError(error: unknown): boolean {
        return (
            error instanceof DOMException
            && (error.name === 'NotAllowedError' || error.code === 18)
        );
    }
}
