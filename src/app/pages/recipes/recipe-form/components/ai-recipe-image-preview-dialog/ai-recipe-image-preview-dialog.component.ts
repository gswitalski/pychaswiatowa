import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

/**
 * Input data for the AI Image Preview Dialog.
 */
export interface AiRecipeImageDialogData {
    recipeName: string;
}

/**
 * Result returned when dialog closes.
 */
export interface AiRecipeImageDialogResult {
    action: 'applied' | 'rejected' | 'cancelled' | 'regenerate';
}

/**
 * UI state for image generation.
 */
export type AiImageDialogState = 'loading' | 'error' | 'success';

/**
 * Dialog component for previewing AI-generated recipe images.
 * 
 * Displays three states:
 * - loading: generation in progress
 * - error: generation failed with optional reasons
 * - success: preview image with Apply/Reject actions
 */
@Component({
    selector: 'pych-ai-recipe-image-preview-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatIconModule,
    ],
    templateUrl: './ai-recipe-image-preview-dialog.component.html',
    styleUrl: './ai-recipe-image-preview-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiRecipeImagePreviewDialogComponent {
    private readonly dialogRef = inject(MatDialogRef<AiRecipeImagePreviewDialogComponent>);
    readonly data = inject<AiRecipeImageDialogData>(MAT_DIALOG_DATA);

    /** Current dialog state */
    readonly state = signal<AiImageDialogState>('loading');

    /** Generated image data URL (data:image/png;base64,...) */
    readonly imageDataUrl = signal<string | null>(null);

    /** Error message for display */
    readonly errorMessage = signal<string | null>(null);

    /** Error reasons (from 422 responses) */
    readonly errorReasons = signal<string[]>([]);

    /** Flag indicating if apply action is in progress */
    readonly applying = signal<boolean>(false);

    /** Computed: are actions disabled */
    readonly actionsDisabled = computed(() => 
        this.state() === 'loading' || this.applying()
    );

    /** Computed: is loading state */
    readonly isLoading = computed(() => this.state() === 'loading');

    /** Computed: is error state */
    readonly isError = computed(() => this.state() === 'error');

    /** Computed: is success state */
    readonly isSuccess = computed(() => this.state() === 'success');

    /**
     * Update dialog with successful generation result.
     */
    setSuccess(imageDataUrl: string): void {
        this.imageDataUrl.set(imageDataUrl);
        this.errorMessage.set(null);
        this.errorReasons.set([]);
        this.state.set('success');
    }

    /**
     * Update dialog with error state.
     */
    setError(message: string, reasons: string[] = []): void {
        this.imageDataUrl.set(null);
        this.errorMessage.set(message);
        this.errorReasons.set(reasons);
        this.state.set('error');
    }

    /**
     * Reset dialog to loading state for regeneration.
     */
    setLoading(): void {
        this.imageDataUrl.set(null);
        this.errorMessage.set(null);
        this.errorReasons.set([]);
        this.state.set('loading');
    }

    /**
     * Handle "Odrzuć" (Reject) button click.
     */
    onReject(): void {
        const result: AiRecipeImageDialogResult = { action: 'rejected' };
        this.dialogRef.close(result);
    }

    /**
     * Handle "Zastosuj" (Apply) button click.
     */
    onApply(): void {
        const result: AiRecipeImageDialogResult = { action: 'applied' };
        this.dialogRef.close(result);
    }

    /**
     * Handle dialog close (backdrop click, ESC key).
     */
    onCancel(): void {
        const result: AiRecipeImageDialogResult = { action: 'cancelled' };
        this.dialogRef.close(result);
    }

    /**
     * Handle "Wygeneruj ponownie" (Regenerate) button click.
     * Closes dialog with regenerate action, parent will handle re-calling the API.
     */
    onRegenerate(): void {
        const result: AiRecipeImageDialogResult = { action: 'regenerate' };
        this.dialogRef.close(result);
    }
}

