import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    ElementRef,
    HostListener,
    inject,
    Injector,
    signal,
    ViewChild,
    afterNextRender,
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
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CameraCaptureButtonComponent } from '../../../shared/components/camera-capture-button/camera-capture-button.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { AiCreditsIndicatorComponent } from '../../../shared/components/ai-credits-indicator/ai-credits-indicator.component';
import {
    AiCreditsExhaustedDialogComponent,
    AiCreditsExhaustedDialogData,
} from '../../../shared/components/ai-credits-exhausted-dialog/ai-credits-exhausted-dialog.component';
import { AiCreditsExhaustedApiError } from '../../../core/models/ai-credits.model';
import { AiCreditsService } from '../../../core/services/ai-credits.service';
import { AiRecipeDraftService, AiDraftValidationError } from '../services/ai-recipe-draft.service';
import { RecipeDraftStateService } from '../services/recipe-draft-state.service';
import {
    AiRecipeDraftRequestDto,
    AiRecipeDraftImageMimeType,
} from '../../../../../shared/contracts/types';
import { ClipboardImageService } from '../../../shared/services/clipboard-image.service';
import { CLIPBOARD_IMAGE_UI_MESSAGES } from '../../../shared/services/clipboard-image.messages';
import { CLIPBOARD_IMAGE_ACCEPTED_MIME_TYPES } from '../../../shared/services/clipboard-image.types';
import { ImageCompressionService } from '../../../shared/services/image-compression.service';
import { RecipeAssistUrlInputComponent } from './components/recipe-assist-url-input/recipe-assist-url-input.component';
import {
    AI_DRAFT_ANALYZING_HINT_MIN_IMAGES,
    AI_DRAFT_MAX_IMAGE_BYTES,
    AI_DRAFT_MAX_IMAGES,
    AI_DRAFT_MAX_TOTAL_IMAGES_BYTES,
} from './ai-draft-images.constants';
import { AI_DRAFT_IMAGES_UI_MESSAGES } from './ai-draft-images.messages';

/** Source type for AI input */
type AiInputSource = 'text' | 'image' | 'url';

/** Allowed MIME types for image paste */
const ALLOWED_IMAGE_TYPES: AiRecipeDraftImageMimeType[] = [...CLIPBOARD_IMAGE_ACCEPTED_MIME_TYPES];

interface AssistImageItem {
    id: string;
    file: File | null;
    previewUrl: string | null;
    status: 'processing' | 'ready';
}

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
        MatTooltipModule,
        PageHeaderComponent,
        AiCreditsIndicatorComponent,
        CameraCaptureButtonComponent,
        RecipeAssistUrlInputComponent,
    ],
    templateUrl: './recipe-new-assist-page.component.html',
    styleUrl: './recipe-new-assist-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeNewAssistPageComponent {
    private readonly router = inject(Router);
    private readonly aiDraftService = inject(AiRecipeDraftService);
    private readonly draftStateService = inject(RecipeDraftStateService);
    private readonly creditsService = inject(AiCreditsService);
    private readonly dialog = inject(MatDialog);
    private readonly clipboardImageService = inject(ClipboardImageService);
    private readonly imageCompression = inject(ImageCompressionService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly injector = inject(Injector);

    readonly clipboardSupported = this.clipboardImageService.isClipboardReadSupported();

    readonly clipboardUnsupportedTooltip = CLIPBOARD_IMAGE_UI_MESSAGES.clipboardUnsupportedTooltip;
    readonly addImagesLabel = AI_DRAFT_IMAGES_UI_MESSAGES.addImages;
    readonly imageHint = AI_DRAFT_IMAGES_UI_MESSAGES.hint;
    readonly imageLimitInfo = AI_DRAFT_IMAGES_UI_MESSAGES.limitInfo;
    readonly analyzingHint = AI_DRAFT_IMAGES_UI_MESSAGES.analyzing;

    @ViewChild('imagePasteArea') imagePasteArea!: ElementRef<HTMLDivElement>;
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    /** Current input source mode */
    readonly source = signal<AiInputSource>('text');

    /** Text input value */
    readonly text = signal<string>('');

    /** Zdjęcia przepisu, zachowujące kolejność wysyłki do AI. */
    readonly images = signal<AssistImageItem[]>([]);
    readonly imageMessages = signal<string[]>([]);
    readonly imageCount = computed(() => this.images().length);
    readonly readyImages = computed(() =>
        this.images().filter((item) => item.status === 'ready' && item.file !== null),
    );
    readonly isProcessingImages = computed(() =>
        this.images().some((item) => item.status === 'processing'),
    );
    readonly isImageLimitReached = computed(() => this.imageCount() >= AI_DRAFT_MAX_IMAGES);
    readonly canAddImages = computed(() => !this.isLoading() && !this.isImageLimitReached());
    readonly imageCounterLabel = computed(() => `${this.imageCount()} / ${AI_DRAFT_MAX_IMAGES}`);
    readonly showAnalyzingHint = computed(
        () =>
            this.isLoading() &&
            this.source() === 'image' &&
            this.readyImages().length >= AI_DRAFT_ANALYZING_HINT_MIN_IMAGES,
    );

    /** Current valid URL from the URL input component */
    readonly urlValue = signal<string | null>(null);

    /** Loading state during API call */
    readonly isLoading = signal<boolean>(false);

    /** Error message for display */
    readonly errorMessage = signal<string | null>(null);

    /** Unprocessable entity reasons (422 response) */
    readonly unprocessableReasons = signal<string[]>([]);

    readonly hasAiInput = computed(
        () =>
            (this.source() === 'text' && this.text().trim().length > 0) ||
            (this.source() === 'image' && this.readyImages().length > 0) ||
            (this.source() === 'url' && this.urlValue() !== null),
    );

    readonly isCreditsExhausted = computed(() => this.creditsService.isExhausted('draft'));

    readonly isNextDisabled = computed(
        () =>
            this.isLoading() ||
            (this.source() === 'url' && this.urlValue() === null) ||
            this.isProcessingImages() ||
            (this.source() === 'image' && this.readyImages().length === 0) ||
            (this.hasAiInput() && this.isCreditsExhausted()),
    );

    readonly nextButtonTooltip = computed(() =>
        this.hasAiInput() && this.isCreditsExhausted()
            ? 'Brak kredytów AI — przejdź na Premium'
            : '',
    );

    readonly isClipboardPasteDisabled = computed(
        () => !this.canAddImages() || !this.clipboardSupported,
    );

    constructor() {
        this.destroyRef.onDestroy(() => this.clearAllImages());
    }

    /**
     * Handle source toggle change.
     * Clears opposite input when switching modes.
     */
    onSourceChange(newSource: AiInputSource): void {
        this.source.set(newSource);
        this.clearError();
        this.urlValue.set(null);

        if (newSource === 'text') {
            // Clear image when switching to text mode
            this.clearAllImages();
        } else if (newSource === 'image') {
            // Clear text when switching to image mode
            this.text.set('');
        } else {
            this.text.set('');
            this.clearAllImages();
        }
    }

    onUrlChange(url: string | null): void {
        this.urlValue.set(url);
        this.clearError();
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
        if (this.source() !== 'image' || this.isLoading()) {
            return;
        }

        const items = event.clipboardData?.items;
        if (!items) {
            return;
        }

        let sawUnsupportedImage = false;
        const files: File[] = [];

        for (const item of Array.from(items)) {
            if (!item.type.startsWith('image/')) {
                continue;
            }

            if (!ALLOWED_IMAGE_TYPES.includes(item.type as AiRecipeDraftImageMimeType)) {
                sawUnsupportedImage = true;
                continue;
            }

            const file = item.getAsFile();
            if (file) {
                files.push(file);
            }
        }

        if (files.length > 0) {
            event.preventDefault();
            void this.addFiles(files);
            return;
        }

        this.errorMessage.set(
            sawUnsupportedImage
                ? CLIPBOARD_IMAGE_UI_MESSAGES.unsupportedFormat
                : CLIPBOARD_IMAGE_UI_MESSAGES.noImage,
        );
    }

    /**
     * Wkleja obraz ze schowka przez Clipboard API (PS-92).
     */
    async onPasteFromClipboardClick(event: MouseEvent): Promise<void> {
        event.stopPropagation();

        if (this.source() !== 'image' || this.isLoading() || !this.clipboardSupported) {
            return;
        }

        this.clearError();

        try {
            const file = await this.clipboardImageService.readImageFile();
            await this.addFiles([file]);
        } catch (err) {
            this.errorMessage.set(this.clipboardImageService.messageForError(err));
        }
    }

    /**
     * Plik z aparatu (PS-93) — ta sama walidacja co wklejanie / schowek.
     */
    async onCameraFileSelected(file: File): Promise<void> {
        await this.addFiles([file]);
    }

    onAddImagesClick(event: MouseEvent): void {
        event.stopPropagation();
        if (this.canAddImages()) {
            this.fileInput?.nativeElement.click();
        }
    }

    onFilesSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        void this.addFiles(Array.from(input.files ?? []));
        input.value = '';
    }

    async addFiles(files: File[]): Promise<void> {
        if (this.isLoading() || files.length === 0) {
            return;
        }

        this.clearError();
        this.imageMessages.set([]);
        const messages = new Set<string>();
        const placeholders: { id: string; file: File }[] = [];
        let skippedOverLimit = 0;

        for (const file of files) {
            if (this.imageCount() + placeholders.length >= AI_DRAFT_MAX_IMAGES) {
                skippedOverLimit++;
                continue;
            }

            if (!ALLOWED_IMAGE_TYPES.includes(file.type as AiRecipeDraftImageMimeType)) {
                messages.add(CLIPBOARD_IMAGE_UI_MESSAGES.unsupportedFormat);
                continue;
            }

            placeholders.push({ id: crypto.randomUUID(), file });
        }

        if (placeholders.length > 0) {
            this.images.update((items) => [
                ...items,
                ...placeholders.map(({ id }) => ({
                    id,
                    file: null,
                    previewUrl: null,
                    status: 'processing' as const,
                })),
            ]);
        }

        if (skippedOverLimit > 0) {
            messages.add(AI_DRAFT_IMAGES_UI_MESSAGES.limitReached);
        }

        const results = await Promise.all(
            placeholders.map(({ id, file }) => this.processImage(id, file)),
        );
        results
            .filter((message): message is string => message !== null)
            .forEach((message) => messages.add(message));
        this.imageMessages.set([...messages]);
    }

    private async processImage(id: string, file: File): Promise<string | null> {
        const compressed = await this.imageCompression.compressForAiDraft(file);
        const placeholder = this.images().find((item) => item.id === id);
        if (!placeholder) {
            return null;
        }

        if (compressed.size > AI_DRAFT_MAX_IMAGE_BYTES) {
            this.removeImageItem(id);
            return CLIPBOARD_IMAGE_UI_MESSAGES.fileTooLarge;
        }

        const previewUrl = URL.createObjectURL(compressed);
        this.images.update((items) =>
            items.map((item) =>
                item.id === id
                    ? { ...item, file: compressed, previewUrl, status: 'ready' as const }
                    : item,
            ),
        );
        return null;
    }

    removeImage(id: string): void {
        if (this.isLoading()) {
            return;
        }

        const index = this.images().findIndex((item) => item.id === id);
        if (index === -1) {
            return;
        }

        const nextItem = this.images()[index + 1] ?? this.images()[index - 1];
        this.removeImageItem(id);
        this.clearError();
        this.imageMessages.set([]);
        afterNextRender(
            () => {
                const selector = nextItem
                    ? `[data-remove-for="${nextItem.id}"]`
                    : '[data-add-images]';
                (document.querySelector(selector) as HTMLElement | null)?.focus();
            },
            { injector: this.injector },
        );
    }

    moveImage(index: number, direction: -1 | 1): void {
        const target = index + direction;
        if (
            this.isLoading() ||
            this.isProcessingImages() ||
            target < 0 ||
            target >= this.images().length
        ) {
            return;
        }

        const item = this.images()[index];
        this.images.update((items) => {
            const reordered = [...items];
            [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
            return reordered;
        });
        afterNextRender(
            () => {
                const directionName = direction === -1 ? 'left' : 'right';
                (
                    document.querySelector(
                        `[data-move-for="${item.id}"][data-dir="${directionName}"]`,
                    ) as HTMLElement | null
                )?.focus();
            },
            { injector: this.injector },
        );
    }

    private removeImageItem(id: string): void {
        const item = this.images().find((current) => current.id === id);
        if (item?.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
        }
        this.images.update((items) => items.filter((current) => current.id !== id));
    }

    private clearAllImages(): void {
        this.images().forEach((item) => {
            if (item.previewUrl) {
                URL.revokeObjectURL(item.previewUrl);
            }
        });
        this.images.set([]);
        this.imageMessages.set([]);
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
        const hasImage = currentSource === 'image' && this.readyImages().length > 0;
        const hasUrl = currentSource === 'url' && this.urlValue() !== null;

        if (currentSource === 'image' && (!hasImage || this.isProcessingImages())) {
            return;
        }

        if (!hasText && !hasImage && !hasUrl) {
            this.draftStateService.clearDraft();
            this.router.navigate(['/recipes/new']);
            return;
        }

        if (
            currentSource === 'image' &&
            this.readyImages().reduce((total, item) => total + item.file!.size, 0) >
                AI_DRAFT_MAX_TOTAL_IMAGES_BYTES
        ) {
            this.errorMessage.set(AI_DRAFT_IMAGES_UI_MESSAGES.totalTooLarge);
            return;
        }

        // Build request and call API
        try {
            this.isLoading.set(true);
            this.clearError();

            const request = await this.buildRequest();
            const response = await this.aiDraftService.generateDraft(request);
            this.creditsService.refreshCredits();

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
        } else if (this.source() === 'image') {
            const images = await Promise.all(
                this.readyImages().map(async (item) => ({
                    mime_type: item.file!.type as AiRecipeDraftImageMimeType,
                    data_base64: await this.fileToBase64(item.file!),
                })),
            );

            return {
                source: 'image',
                images,
                output_format: 'pycha_recipe_draft_v1',
                language: 'pl',
            };
        } else {
            const url = this.urlValue();

            if (!url) {
                throw new Error('Wklej poprawny adres strony z przepisem.');
            }

            return {
                source: 'url',
                url,
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
        if (error instanceof AiCreditsExhaustedApiError) {
            const details = error.response.details;
            const dialogData: AiCreditsExhaustedDialogData = {
                creditType: details.credit_type,
                limitType: details.limit_type === 'monthly' ? 'monthly' : 'lifetime',
                nextResetAt: details.next_reset_at ? new Date(details.next_reset_at) : null,
            };

            this.dialog.open(AiCreditsExhaustedDialogComponent, {
                data: dialogData,
                width: '480px',
                maxWidth: 'calc(100vw - 32px)',
                panelClass: 'mobile-fullscreen-dialog',
            });
            this.creditsService.refreshCredits();
        } else if (error instanceof AiDraftValidationError) {
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

    onUpgrade(): void {
        void this.router.navigate(['/pricing']);
    }

    /**
     * Focus image paste area (for accessibility)
     */
    focusImageArea(): void {
        this.imagePasteArea?.nativeElement?.focus();
    }
}
