import { Injectable } from '@angular/core';
import {
    IMAGE_COMPRESS_MAX_DIMENSION_PX,
    IMAGE_COMPRESS_MIN_DIMENSION_PX,
    IMAGE_COMPRESS_MIN_QUALITY,
    REFERENCE_IMAGE_MAX_BYTES,
} from './image-compression.constants';

export class ImageCompressionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ImageCompressionError';
    }
}

@Injectable({
    providedIn: 'root',
})
export class ImageCompressionService {
    /**
     * Zmniejsza plik do maxBytes (domyślnie 2 MB — limit obrazu referencyjnego AI).
     * Pliki już mieszczące się w limicie zwracane są bez zmian.
     */
    public async compressToMaxSize(
        file: File,
        maxBytes: number = REFERENCE_IMAGE_MAX_BYTES,
    ): Promise<File> {
        if (file.size <= maxBytes) {
            return file;
        }

        const image = await this.loadImage(file);
        let width = image.naturalWidth;
        let height = image.naturalHeight;

        const scaleToMaxDimension = Math.min(
            1,
            IMAGE_COMPRESS_MAX_DIMENSION_PX / Math.max(width, height),
        );
        width = Math.max(1, Math.round(width * scaleToMaxDimension));
        height = Math.max(1, Math.round(height * scaleToMaxDimension));

        const outputType = this.pickOutputMimeType(file.type);
        const qualities = [0.85, 0.75, 0.65, 0.55, 0.45, IMAGE_COMPRESS_MIN_QUALITY];

        while (true) {
            for (const quality of qualities) {
                const blob = await this.renderToBlob(image, width, height, outputType, quality);
                if (!blob) {
                    continue;
                }

                if (blob.size <= maxBytes) {
                    return this.blobToFile(blob, file.name, outputType);
                }
            }

            const longestSide = Math.max(width, height);
            if (longestSide <= IMAGE_COMPRESS_MIN_DIMENSION_PX) {
                break;
            }

            width = Math.max(1, Math.round(width * 0.85));
            height = Math.max(1, Math.round(height * 0.85));
        }

        throw new ImageCompressionError(
            'Nie udało się zmniejszyć zdjęcia do dopuszczalnego rozmiaru.',
        );
    }

    private pickOutputMimeType(sourceType: string): string {
        if (sourceType === 'image/png') {
            return 'image/webp';
        }
        if (sourceType === 'image/jpeg' || sourceType === 'image/webp') {
            return sourceType;
        }
        return 'image/webp';
    }

    private loadImage(file: File): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const image = new Image();

            image.onload = () => {
                URL.revokeObjectURL(url);
                resolve(image);
            };

            image.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new ImageCompressionError('Nie udało się wczytać obrazu do kompresji.'));
            };

            image.src = url;
        });
    }

    private renderToBlob(
        image: HTMLImageElement,
        width: number,
        height: number,
        mimeType: string,
        quality: number,
    ): Promise<Blob | null> {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
            return Promise.resolve(null);
        }

        context.drawImage(image, 0, 0, width, height);
        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), mimeType, quality);
        });
    }

    private blobToFile(blob: Blob, originalName: string, mimeType: string): File {
        const baseName = originalName.replace(/\.[^.]+$/, '') || 'photo';
        const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'webp';
        return new File([blob], `${baseName}.${extension}`, { type: mimeType });
    }
}
