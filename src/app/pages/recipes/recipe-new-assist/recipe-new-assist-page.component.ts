import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
    inject,
    signal,
    ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AiRecipeDraftService, AiDraftValidationError } from '../services/ai-recipe-draft.service';
import { RecipeDraftStateService } from '../services/recipe-draft-state.service';
import {
    AiRecipeDraftRequestDto,
    AiRecipeDraftImageMimeType,
} from '../../../../../shared/contracts/types';

/** Source type for AI input */
type AiInputSource = 'text' | 'image';

/** Allowed MIME types for image paste */
const ALLOWED_IMAGE_TYPES: AiRecipeDraftImageMimeType[] = [
    'image/png',
    'image/jpeg',
    'image/webp',
];

/** Maximum image size in bytes (10 MB) */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/**
 * Recipe creation wizard - AI Assist page component.
 * Allows user to paste text or image for AI-assisted recipe creation.
 */
@Component({
    selector: 'pych-recipe-new-assist-page',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        PageHeaderComponent,
    ],
    templateUrl: './recipe-new-assist-page.component.html',
    styleUrl: './recipe-new-assist-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeNewAssistPageComponent {
    private readonly router = inject(Router);
    private readonly aiDraftService = inject(AiRecipeDraftService);
    private readonly draftStateService = inject(RecipeDraftStateService);

    @ViewChild('imagePasteArea') imagePasteArea!: ElementRef<HTMLDivElement>;

    /** Current input source mode */
    readonly source = signal<AiInputSource>('text');

    /** Text input value */
    readonly text = signal<string>('');

    /** Current image file (if any) */
    readonly imageFile = signal<File | null>(null);

    /** Image preview URL (data URL) */
    readonly imagePreviewUrl = signal<string | null>(null);

    /** Loading state during API call */
    readonly isLoading = signal<boolean>(false);

    /** Error message for display */
    readonly errorMessage = signal<string | null>(null);

    /** Unprocessable entity reasons (422 response) */
    readonly unprocessableReasons = signal<string[]>([]);

    /**
     * Handle source toggle change.
     * Clears opposite input when switching modes.
     */
    onSourceChange(newSource: AiInputSource): void {
        this.source.set(newSource);
        this.clearError();

        if (newSource === 'text') {
            // Clear image when switching to text mode
            this.clearImage();
        } else {
            // Clear text when switching to image mode
            this.text.set('');
        }
    }

    /**
     * Handle text input change
     */
    onTextChange(value: string): void {
        this.text.set(value);
        this.clearError();
    }

    /**
     * Handle paste event for image
     */
    @HostListener('paste', ['$event'])
    onPaste(event: ClipboardEvent): void {
        // Only handle paste in image mode
        if (this.source() !== 'image') {
            return;
        }

        const items = event.clipboardData?.items;
        if (!items) {
            return;
        }

        // Find image in clipboard
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();

                if (file) {
                    this.handleImageFile(file);
                }
                return;
            }
        }

        // No image found in clipboard
        this.errorMessage.set('W schowku nie ma obrazu. Skopiuj zdjęcie przepisu i spróbuj ponownie.');
    }

    /**
     * Validate and set image file
     */
    private handleImageFile(file: File): void {
        this.clearError();

        // Validate MIME type
        if (!ALLOWED_IMAGE_TYPES.includes(file.type as AiRecipeDraftImageMimeType)) {
            this.errorMessage.set(
                `Nieprawidłowy format obrazu. Obsługiwane formaty: PNG, JPEG, WebP.`
            );
            return;
        }

        // Validate file size
        if (file.size > MAX_IMAGE_SIZE) {
            this.errorMessage.set(
                `Obraz jest zbyt duży. Maksymalny rozmiar to 10 MB.`
            );
            return;
        }

        // Set file and create preview
        this.imageFile.set(file);
        this.createImagePreview(file);
    }

    /**
     * Create image preview URL from file
     */
    private createImagePreview(file: File): void {
        const reader = new FileReader();
        reader.onload = () => {
            this.imagePreviewUrl.set(reader.result as string);
        };
        reader.readAsDataURL(file);
    }

    /**
     * Remove current image
     */
    onRemoveImage(): void {
        this.clearImage();
        this.clearError();
    }

    /**
     * Clear image state
     */
    private clearImage(): void {
        this.imageFile.set(null);
        this.imagePreviewUrl.set(null);
    }

    /**
     * Clear error state
     */
    private clearError(): void {
        this.errorMessage.set(null);
        this.unprocessableReasons.set([]);
    }

    /**
     * Handle "Dalej" (Next) button click.
     * If input is empty, navigates to empty form.
     * If input is provided, calls AI API and navigates with draft.
     */
    async onNext(): Promise<void> {
        const currentSource = this.source();
        const hasText = currentSource === 'text' && this.text().trim().length > 0;
        const hasImage = currentSource === 'image' && this.imageFile() !== null;

        // If no input, navigate to empty form
        if (!hasText && !hasImage) {
            this.draftStateService.clearDraft();
            this.router.navigate(['/recipes/new']);
            return;
        }

        // Build request and call API
        try {
            this.isLoading.set(true);
            this.clearError();

            const request = await this.buildRequest();
            const response = await this.aiDraftService.generateDraft(request);

            // Save draft and navigate to form
            this.draftStateService.setDraft(response.draft, response.meta);
            this.router.navigate(['/recipes/new']);
        } catch (error) {
            this.handleError(error);
        } finally {
            this.isLoading.set(false);
        }
    }

    /**
     * Build API request based on current source
     */
    private async buildRequest(): Promise<AiRecipeDraftRequestDto> {
        if (this.source() === 'text') {
            return {
                source: 'text',
                text: this.text().trim(),
                output_format: 'pycha_recipe_draft_v1',
                language: 'pl',
            };
        } else {
            const file = this.imageFile()!;
            const base64 = await this.fileToBase64(file);

            return {
                source: 'image',
                image: {
                    mime_type: file.type as AiRecipeDraftImageMimeType,
                    data_base64: base64,
                },
                output_format: 'pycha_recipe_draft_v1',
                language: 'pl',
            };
        }
    }

    /**
     * Convert file to base64 string (without data URL prefix)
     */
    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                // Remove "data:image/...;base64," prefix
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Handle API errors
     */
    private handleError(error: unknown): void {
        if (error instanceof AiDraftValidationError) {
            // 422 - content is not a valid recipe
            this.errorMessage.set(error.message);
            this.unprocessableReasons.set(error.reasons);
        } else if (error instanceof Error) {
            this.errorMessage.set(error.message);
        } else {
            this.errorMessage.set('Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
        }
    }

    /**
     * Handle "Wróć" (Back) button click
     */
    onBack(): void {
        this.router.navigate(['/recipes/new/start']);
    }

    /**
     * Focus image paste area (for accessibility)
     */
    focusImageArea(): void {
        this.imagePasteArea?.nativeElement?.focus();
    }
}

