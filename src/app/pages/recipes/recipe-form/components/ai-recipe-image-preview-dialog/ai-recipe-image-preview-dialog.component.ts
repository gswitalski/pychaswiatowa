import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    computed,
    OnDestroy,
    Output,
    EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

const DEFAULT_PROMPT_HINT_MAX_LENGTH = 400;
const DEFAULT_COOLDOWN_SECONDS = 25;

/**
 * Input data for the AI Image Preview Dialog.
 */
export interface AiRecipeImageDialogData {
    recipeName: string;
    modeLabel?: string;
    isPremium?: boolean;
    promptHintMaxLength?: number;
}

/**
 * Result returned when dialog closes.
 */
export interface AiRecipeImageDialogResult {
    action: 'applied' | 'cancelled';
}

/**
 * UI state for image generation.
 */
export type AiImageDialogState = 'initial' | 'loading' | 'error' | 'success';

/**
 * Resolved AI image generation mode (never 'auto').
 */
export type AiRecipeImageResolvedMode = 'recipe_only' | 'with_reference';

/**
 * Dialog component for previewing AI-generated recipe images.
 * 
 * Displays three states:
 * - initial: waiting for user action
 * - loading: generation in progress
 * - error: generation failed with optional reasons
 * - success: preview image with apply option
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
        MatFormFieldModule,
        MatInputModule,
        FormsModule,
    ],
    templateUrl: './ai-recipe-image-preview-dialog.component.html',
    styleUrl: './ai-recipe-image-preview-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiRecipeImagePreviewDialogComponent implements OnDestroy {
    @Output() readonly generateRequested = new EventEmitter<{ promptHint?: string }>();

    private readonly dialogRef = inject(MatDialogRef<AiRecipeImagePreviewDialogComponent>);
    readonly data = inject<AiRecipeImageDialogData>(MAT_DIALOG_DATA);
    private readonly now = signal<number>(Date.now());
    private readonly cooldownUntil = signal<number | null>(null);
    private readonly cooldownTicker = setInterval(() => {
        this.now.set(Date.now());
    }, 1000);

    /** Current dialog state */
    readonly state = signal<AiImageDialogState>('initial');

    /** Generated image data URL (data:image/png;base64,...) */
    readonly imageDataUrl = signal<string | null>(null);

    /** Resolved generation mode from API response */
    readonly resolvedMode = signal<AiRecipeImageResolvedMode | null>(null);

    /** Error message for display */
    readonly errorMessage = signal<string | null>(null);

    /** Error reasons (from 422 responses) */
    readonly errorReasons = signal<string[]>([]);

    /** Prompt hint used to fine tune style details */
    readonly promptHint = signal<string>('');

    /** Max prompt hint length from config */
    readonly promptHintMaxLength = this.data.promptHintMaxLength ?? DEFAULT_PROMPT_HINT_MAX_LENGTH;

    /** Computed: are actions disabled */
    readonly actionsDisabled = computed(() => 
        this.state() === 'loading'
    );

    /** Computed: is loading state */
    readonly isLoading = computed(() => this.state() === 'loading');

    /** Computed: is error state */
    readonly isError = computed(() => this.state() === 'error');

    /** Computed: is success state */
    readonly isSuccess = computed(() => this.state() === 'success');

    /** Computed: is initial state */
    readonly isInitial = computed(() => this.state() === 'initial');

    /** Computed: cooldown time remaining in whole seconds */
    readonly cooldownRemainingSeconds = computed(() => {
        const until = this.cooldownUntil();
        if (!until) {
            return 0;
        }

        const remainingMs = until - this.now();
        if (remainingMs <= 0) {
            return 0;
        }

        return Math.ceil(remainingMs / 1000);
    });

    /** Computed: cooldown active */
    readonly isCooldownActive = computed(() => this.cooldownRemainingSeconds() > 0);

    /** Computed: generate action label depending on state */
    readonly generateButtonLabel = computed(() => {
        if (this.isSuccess() || this.isError()) {
            return 'Wygeneruj ponownie';
        }
        return 'Generuj';
    });

    /** Computed: mode label for short info line */
    readonly modeLabel = computed(() => this.data.modeLabel ?? 'Z przepisu');

    /** Computed: style note text based on resolved mode */
    readonly styleNoteText = computed(() => {
        const mode = this.resolvedMode();
        if (!mode) {
            return 'Realistyczne zdjęcie w stylu rustykalnym';
        }

        if (mode === 'recipe_only') {
            return 'Wygenerowano z przepisu — realistyczne zdjęcie w stylu rustykalnym';
        }

        // mode === 'with_reference'
        return 'Wygenerowano z referencją zdjęcia — nowe ujęcie (nie kopiujemy referencji) w stylu eleganckiej kuchni/jadalni';
    });

    ngOnDestroy(): void {
        clearInterval(this.cooldownTicker);
    }

    /**
     * Update dialog with successful generation result.
     * @param imageDataUrl Data URL of the generated image
     * @param mode Resolved generation mode from API response
     */
    setSuccess(imageDataUrl: string, mode: AiRecipeImageResolvedMode): void {
        this.imageDataUrl.set(imageDataUrl);
        this.resolvedMode.set(mode);
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
        this.resolvedMode.set(null);
        this.errorMessage.set(null);
        this.errorReasons.set([]);
        this.state.set('loading');
    }

    /**
     * Handle "Generuj"/"Wygeneruj ponownie" button click.
     */
    onGenerate(): void {
        if (this.isCooldownActive() || this.actionsDisabled()) {
            return;
        }

        this.setCooldown();
        this.setLoading();
        this.generateRequested.emit({ promptHint: this.normalizedPromptHint() });
    }

    /**
     * Handle "Anuluj" button click.
     */
    onCancel(): void {
        const result: AiRecipeImageDialogResult = { action: 'cancelled' };
        this.dialogRef.close(result);
    }

    /**
     * Handle "Użyj tego zdjęcia" button click.
     */
    onApply(): void {
        const result: AiRecipeImageDialogResult = { action: 'applied' };
        this.dialogRef.close(result);
    }

    /**
     * Clear only local preview state without closing dialog.
     */
    onClearPreview(): void {
        this.imageDataUrl.set(null);
        this.resolvedMode.set(null);
        this.errorMessage.set(null);
        this.errorReasons.set([]);
        this.state.set('initial');
    }

    private normalizedPromptHint(): string | undefined {
        const trimmed = this.promptHint().trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    private setCooldown(seconds: number = DEFAULT_COOLDOWN_SECONDS): void {
        const until = Date.now() + seconds * 1000;
        this.cooldownUntil.set(until);
    }
}

