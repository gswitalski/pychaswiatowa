import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
    signal,
    inject,
    effect,
    OnInit,
    computed,
    input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RecipesService } from '../../../services/recipes.service';
import { UploadRecipeImageResponseDto } from '../../../../../../../shared/contracts/types';
import { SupabaseService } from '../../../../../core/services/supabase.service';

/**
 * UI state for the image upload component
 */
export type RecipeImageUploadUiState = 'idle' | 'dragover' | 'uploading' | 'success' | 'error';

/**
 * Events emitted by the image upload component
 */
export type RecipeImageEvent =
    | { type: 'pendingFileChanged'; file: File | null }
    | { type: 'uploaded'; imagePath: string; imageUrl?: string }
    | { type: 'deleted' }
    | { type: 'uploadingChanged'; uploading: boolean };

/**
 * Snapshot for undo functionality
 */
export interface RecipeImageUndoSnapshot {
    kind: 'none' | 'existing';
    previousUrl: string | null;
    previousFile: File | null;
}

@Component({
    selector: 'pych-recipe-image-upload',
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
    ],
    templateUrl: './recipe-image-upload.component.html',
    styleUrl: './recipe-image-upload.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeImageUploadComponent implements OnInit {
    private readonly recipesService = inject(RecipesService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly supabase = inject(SupabaseService);

    /** Recipe ID - when null, component is in "pending" mode (create mode) */
    @Input() recipeId: number | null = null;

    /** Current image URL to display (can be storage path or full URL) - signal input for reactivity */
    readonly currentImageUrl = input<string | null>(null);

    /** Disable all interactions */
    @Input() disabled = false;

    /** Emits image-related events */
    @Output() imageEvent = new EventEmitter<RecipeImageEvent>();

    /** Current UI state */
    readonly uiState = signal<RecipeImageUploadUiState>('idle');

    /** Preview URL for local file */
    readonly previewUrl = signal<string | null>(null);

    /** File name for display */
    readonly fileName = signal<string | null>(null);

    /** Error message */
    readonly error = signal<string | null>(null);

    /** Undo snapshot for the undo feature */
    private undoSnapshot: RecipeImageUndoSnapshot | null = null;

    private readonly acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    private readonly maxSizeBytes = 10 * 1024 * 1024; // 10MB (zgodnie z PRD/API)

    constructor() {
        // Update UI state based on conditions (but don't override uploading/dragover states)
        effect(() => {
            const currentState = this.uiState();

            // Don't override uploading or dragover states
            if (currentState === 'uploading' || currentState === 'dragover') {
                return;
            }

            if (this.error()) {
                this.uiState.set('error');
            } else if (this.previewUrl() || this.fullCurrentImageUrl()) {
                this.uiState.set('success');
            } else {
                this.uiState.set('idle');
            }
        });
    }

    ngOnInit(): void {
        // Emit initial uploading state
        this.imageEvent.emit({ type: 'uploadingChanged', uploading: false });
    }

    /**
     * Handles file selection from input
     */
    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) {
            return;
        }

        this.processFile(file);
        input.value = ''; // Reset input
    }

    /**
     * Handles paste event
     */
    onPaste(event: ClipboardEvent): void {
        if (this.disabled) {
            return;
        }

        event.preventDefault();

        const items = event.clipboardData?.items;
        if (!items) {
            this.error.set('Schowek nie zawiera obrazu');
            return;
        }

        // Find image in clipboard
        let imageFile: File | null = null;
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                const blob = item.getAsFile();
                if (blob) {
                    imageFile = blob;
                    break;
                }
            }
        }

        if (!imageFile) {
            this.error.set('Schowek nie zawiera obrazu');
            return;
        }

        this.processFile(imageFile);
    }

    /**
     * Handles drag over event
     */
    onDragOver(event: DragEvent): void {
        if (this.disabled) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        this.uiState.set('dragover');
    }

    /**
     * Handles drag leave event
     */
    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();

        // Check if we're really leaving the drop zone
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;

        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
            if (this.previewUrl() || this.fullCurrentImageUrl()) {
                this.uiState.set('success');
            } else {
                this.uiState.set('idle');
            }
        }
    }

    /**
     * Handles drop event
     */
    onDrop(event: DragEvent): void {
        if (this.disabled) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) {
            this.error.set('Upuść plik obrazu z dysku');
            this.uiState.set('error');
            return;
        }

        const file = files[0];
        this.processFile(file);
    }

    /**
     * Processes and validates a file
     */
    private processFile(file: File): void {
        this.error.set(null);

        // Validate file type
        if (!this.acceptedTypes.includes(file.type)) {
            this.error.set('Dozwolone formaty: JPG, PNG, WebP');
            return;
        }

        // Validate file size
        if (file.size > this.maxSizeBytes) {
            this.error.set('Maksymalny rozmiar pliku to 10 MB');
            return;
        }

        // Create preview
        const reader = new FileReader();
        reader.onload = () => {
            this.previewUrl.set(reader.result as string);
            this.fileName.set(file.name);
        };
        reader.readAsDataURL(file);

        // Handle based on mode
        if (this.recipeId) {
            // Edit mode - auto-upload
            this.uploadImage(file);
        } else {
            // Create mode - emit pending file
            this.imageEvent.emit({ type: 'pendingFileChanged', file });
        }
    }

    /**
     * Uploads image to the server (edit mode only)
     */
    private uploadImage(file: File): void {
        if (!this.recipeId) {
            return;
        }

        // Create undo snapshot before upload
        this.createUndoSnapshot();

        this.uiState.set('uploading');
        this.imageEvent.emit({ type: 'uploadingChanged', uploading: true });

        this.recipesService.uploadRecipeImage(this.recipeId, file).subscribe({
            next: (response: UploadRecipeImageResponseDto) => {
                this.uiState.set('success');
                this.imageEvent.emit({ type: 'uploadingChanged', uploading: false });
                this.imageEvent.emit({
                    type: 'uploaded',
                    imagePath: response.image_path,
                    imageUrl: response.image_url,
                });

                // Show undo snackbar
                this.showUndoSnackbar('Zmieniono zdjęcie');
            },
            error: (err) => {
                this.error.set(err.message || 'Nie udało się przesłać zdjęcia');
                this.uiState.set('error');
                this.imageEvent.emit({ type: 'uploadingChanged', uploading: false });

                // Restore preview to previous state
                this.previewUrl.set(null);
                this.fileName.set(null);
            },
        });
    }

    /**
     * Removes/deletes the current image
     */
    removeImage(): void {
        if (this.disabled) {
            return;
        }

        if (this.recipeId && this.fullCurrentImageUrl()) {
            // Edit mode - delete from server
            this.deleteImage();
        } else {
            // Create mode - just clear pending file
            this.previewUrl.set(null);
            this.fileName.set(null);
            this.error.set(null);
            this.imageEvent.emit({ type: 'pendingFileChanged', file: null });
        }
    }

    /**
     * Deletes image from the server (edit mode only)
     */
    private deleteImage(): void {
        if (!this.recipeId) {
            return;
        }

        // Create undo snapshot before delete
        this.createUndoSnapshot();

        this.uiState.set('uploading');
        this.imageEvent.emit({ type: 'uploadingChanged', uploading: true });

        this.recipesService.deleteRecipeImage(this.recipeId).subscribe({
            next: () => {
                this.previewUrl.set(null);
                this.fileName.set(null);
                this.error.set(null);
                this.uiState.set('idle');
                this.imageEvent.emit({ type: 'uploadingChanged', uploading: false });
                this.imageEvent.emit({ type: 'deleted' });

                // Show undo snackbar
                this.showUndoSnackbar('Usunięto zdjęcie');
            },
            error: (err) => {
                this.error.set(err.message || 'Nie udało się usunąć zdjęcia');
                this.uiState.set('error');
                this.imageEvent.emit({ type: 'uploadingChanged', uploading: false });
            },
        });
    }

    /**
     * Creates a snapshot for undo functionality
     */
    private async createUndoSnapshot(): Promise<void> {
        // Use full URL for fetching (not storage path)
        const currentUrl = this.fullCurrentImageUrl();

        if (!currentUrl) {
            this.undoSnapshot = {
                kind: 'none',
                previousUrl: null,
                previousFile: null,
            };
            return;
        }

        try {
            // Try to fetch and convert current image to File for undo
            const response = await fetch(currentUrl);
            const blob = await response.blob();
            const file = new File([blob], 'previous.webp', { type: blob.type });

            this.undoSnapshot = {
                kind: 'existing',
                previousUrl: currentUrl,
                previousFile: file,
            };
        } catch {
            // If fetching fails, still save snapshot without file
            this.undoSnapshot = {
                kind: 'existing',
                previousUrl: currentUrl,
                previousFile: null,
            };
        }
    }

    /**
     * Shows snackbar with undo action
     */
    private showUndoSnackbar(message: string): void {
        const snackBarRef = this.snackBar.open(message, 'Cofnij', {
            duration: 5000,
        });

        snackBarRef.onAction().subscribe(() => {
            this.performUndo();
        });
    }

    /**
     * Performs undo action
     */
    private performUndo(): void {
        if (!this.undoSnapshot || !this.recipeId) {
            return;
        }

        if (this.undoSnapshot.kind === 'none') {
            // Previous state was no image - delete current
            this.deleteImage();
        } else if (this.undoSnapshot.previousFile) {
            // Previous state had image - re-upload it
            this.uploadImage(this.undoSnapshot.previousFile);
        } else {
            this.snackBar.open('Nie można przywrócić poprzedniego zdjęcia', undefined, {
                duration: 3000,
            });
        }

        this.undoSnapshot = null;
    }

    /**
     * Computed: full public URL for currentImageUrl
     * Converts storage path to public URL if needed
     */
    private readonly fullCurrentImageUrl = computed(() => {
        const url = this.currentImageUrl(); // Signal input - call as function

        if (!url) {
            return null;
        }

        // If already a full URL, return as is
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // Otherwise, construct public URL from storage path
        const { data } = this.supabase.storage
            .from('recipe-images')
            .getPublicUrl(url);

        return data?.publicUrl || null;
    });

    /** Get display URL (preview or current with proper URL conversion) */
    get displayImageUrl(): string | null {
        return this.previewUrl() || this.fullCurrentImageUrl();
    }

    /** Check if component has an image */
    get hasImage(): boolean {
        return !!(this.previewUrl() || this.fullCurrentImageUrl());
    }

    /** Check if component is in uploading state */
    get isUploading(): boolean {
        return this.uiState() === 'uploading';
    }

    /** Check if component is in dragover state */
    get isDragover(): boolean {
        return this.uiState() === 'dragover';
    }

    /**
     * Apply an external file (e.g., from AI image generation).
     * Uses the same processing and upload flow as paste/drop.
     *
     * @param file The file to apply (must pass validation)
     */
    public applyExternalFile(file: File): void {
        if (this.disabled) {
            return;
        }

        this.processFile(file);
    }
}
