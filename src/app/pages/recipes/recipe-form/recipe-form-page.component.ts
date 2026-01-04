import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    inject,
    signal,
    computed,
    ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    FormBuilder,
    FormGroup,
    FormArray,
    FormControl,
    ReactiveFormsModule,
    Validators,
    AbstractControl,
    ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { RecipeBasicInfoFormComponent } from './components/recipe-basic-info-form/recipe-basic-info-form.component';
import { RecipeImageUploadComponent, RecipeImageEvent } from './components/recipe-image-upload/recipe-image-upload.component';
import { RecipeCategorizationFormComponent } from './components/recipe-categorization-form/recipe-categorization-form.component';
import { EditableListComponent } from '../../../shared/components/editable-list/editable-list.component';
import {
    AiRecipeImagePreviewDialogComponent,
    AiRecipeImageDialogData,
    AiRecipeImageDialogResult
} from './components/ai-recipe-image-preview-dialog/ai-recipe-image-preview-dialog.component';

import { CategoriesService } from '../../../core/services/categories.service';
import { AuthService } from '../../../core/services/auth.service';
import { RecipesService } from '../services/recipes.service';
import { RecipeDraftStateService } from '../services/recipe-draft-state.service';
import { SlugService } from '../../../shared/services/slug.service';
import {
    AiRecipeImageService,
    AiImageValidationError,
    AiImageRateLimitError,
    AiImagePremiumRequiredError
} from '../services/ai-recipe-image.service';
import {
    RecipeDetailDto,
    CreateRecipeCommand,
    UpdateRecipeCommand,
    RecipeVisibility,
    AiRecipeDraftDto,
    CategoryDto,
    AiRecipeImageRequestDto,
    AiRecipeImageContentItem,
    RecipeDietType,
    RecipeCuisine,
    RecipeDifficulty,
} from '../../../../../shared/contracts/types';

export interface RecipeFormViewModel {
    name: FormControl<string>;
    description: FormControl<string>;
    categoryId: FormControl<number | null>;
    visibility: FormControl<RecipeVisibility>;
    tags: FormArray<FormControl<string>>;
    ingredients: FormArray<FormControl<string>>;
    steps: FormArray<FormControl<string>>;
    servings: FormControl<number | null>;
    isTermorobot: FormControl<boolean>;
    isGrill: FormControl<boolean>;
    prepTimeMinutes: FormControl<number | null>;
    totalTimeMinutes: FormControl<number | null>;
    dietType: FormControl<RecipeDietType | null>;
    cuisine: FormControl<RecipeCuisine | null>;
    difficulty: FormControl<RecipeDifficulty | null>;
}

@Component({
    selector: 'pych-recipe-form-page',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatIconModule,
        MatTooltipModule,
        PageHeaderComponent,
        RecipeBasicInfoFormComponent,
        RecipeImageUploadComponent,
        RecipeCategorizationFormComponent,
        EditableListComponent,
    ],
    templateUrl: './recipe-form-page.component.html',
    styleUrl: './recipe-form-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeFormPageComponent implements OnInit {
    private readonly fb = inject(FormBuilder);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly dialog = inject(MatDialog);
    private readonly snackBar = inject(MatSnackBar);
    private readonly categoriesService = inject(CategoriesService);
    private readonly authService = inject(AuthService);
    private readonly recipesService = inject(RecipesService);
    private readonly draftStateService = inject(RecipeDraftStateService);
    private readonly aiRecipeImageService = inject(AiRecipeImageService);
    private readonly slugService = inject(SlugService);

    /** Reference to RecipeImageUploadComponent for applying AI-generated images */
    @ViewChild(RecipeImageUploadComponent)
    private imageUploadComponent!: RecipeImageUploadComponent;

    /** Signal indicating edit mode vs create mode */
    readonly isEditMode = signal<boolean>(false);

    /** Flag indicating if form was prefilled from AI draft */
    readonly isPrefilledFromDraft = signal<boolean>(false);

    /** Pending draft to apply after categories are loaded */
    private pendingDraft: AiRecipeDraftDto | null = null;

    /** Recipe ID when in edit mode */
    readonly recipeId = signal<number | null>(null);

    /** Loading state for fetching recipe data */
    readonly loading = signal<boolean>(false);

    /** Saving state for form submission */
    readonly saving = signal<boolean>(false);

    /** Image uploading state (for blocking save button) */
    readonly imageUploading = signal<boolean>(false);

    /** AI image generation in progress */
    readonly aiGenerating = signal<boolean>(false);

    /** Error message */
    readonly error = signal<string | null>(null);

    /** Categories from service */
    readonly categories = this.categoriesService.categories;

    /** Current image URL (for edit mode) */
    readonly currentImageUrl = signal<string | null>(null);

    /** Pending image file (for create mode) */
    private pendingImageFile: File | null = null;

    /** Page title computed based on mode */
    readonly pageTitle = computed(() =>
        this.isEditMode() ? 'Edytuj przepis' : 'Nowy przepis'
    );

    /** Signal: track form validity manually */
    private readonly formValid = signal<boolean>(false);

    /** Computed: should save button be disabled */
    readonly isSaveDisabled = computed(() => {
        const formInvalid = !this.formValid();
        const saving = this.saving();
        const imageUploading = this.imageUploading();
        const aiGenerating = this.aiGenerating();

        return formInvalid || saving || imageUploading || aiGenerating;
    });

    /** Computed: is AI image button visible (premium/admin only) */
    readonly isAiImageButtonVisible = computed(() => {
        const role = this.authService.appRole();
        return role === 'premium' || role === 'admin';
    });

    /** Computed: is AI image button disabled */
    readonly isAiImageButtonDisabled = computed(() => {
        // Only available in edit mode
        if (!this.recipeId()) {
            return true;
        }
        // Disabled during saving, image uploading, or AI generation
        return this.saving() || this.imageUploading() || this.aiGenerating();
    });

    /** Main form group */
    form!: FormGroup<RecipeFormViewModel>;

    /** Quick access to ingredients FormArray */
    get ingredientsArray(): FormArray<FormControl<string>> {
        return this.form.controls.ingredients;
    }

    /** Quick access to steps FormArray */
    get stepsArray(): FormArray<FormControl<string>> {
        return this.form.controls.steps;
    }

    /** Quick access to tags FormArray */
    get tagsArray(): FormArray<FormControl<string>> {
        return this.form.controls.tags;
    }

    /** Quick access to servings FormControl */
    get servingsControl(): FormControl<number | null> {
        return this.form.controls.servings;
    }

    /** Quick access to isTermorobot FormControl */
    get isTermorobotControl(): FormControl<boolean> {
        return this.form.controls.isTermorobot;
    }

    /** Quick access to isGrill FormControl */
    get isGrillControl(): FormControl<boolean> {
        return this.form.controls.isGrill;
    }

    /** Quick access to prepTimeMinutes FormControl */
    get prepTimeMinutesControl(): FormControl<number | null> {
        return this.form.controls.prepTimeMinutes;
    }

    /** Quick access to totalTimeMinutes FormControl */
    get totalTimeMinutesControl(): FormControl<number | null> {
        return this.form.controls.totalTimeMinutes;
    }

    /** Quick access to dietType FormControl */
    get dietTypeControl(): FormControl<RecipeDietType | null> {
        return this.form.controls.dietType;
    }

    /** Quick access to cuisine FormControl */
    get cuisineControl(): FormControl<RecipeCuisine | null> {
        return this.form.controls.cuisine;
    }

    /** Quick access to difficulty FormControl */
    get difficultyControl(): FormControl<RecipeDifficulty | null> {
        return this.form.controls.difficulty;
    }

    ngOnInit(): void {
        this.initForm();
        this.loadCategories();
        this.checkEditMode();

        // In create mode, check for AI draft to prefill
        if (!this.isEditMode()) {
            this.checkAndApplyDraft();
        }

        // Subscribe to form status changes to update formValid signal
        this.form.statusChanges.subscribe(() => {
            this.formValid.set(this.form.valid);
        });

        // Set initial form validity
        this.formValid.set(this.form.valid);
    }

    private initForm(): void {
        this.form = this.fb.group<RecipeFormViewModel>({
            name: this.fb.control('', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(150)],
            }),
            description: this.fb.control('', { nonNullable: true }),
            categoryId: this.fb.control<number | null>(null),
            visibility: this.fb.control<RecipeVisibility>('PRIVATE', {
                nonNullable: true,
                validators: [Validators.required],
            }),
            tags: this.fb.array<FormControl<string>>([]),
            ingredients: this.fb.array<FormControl<string>>([], {
                validators: [Validators.required, this.minArrayLength(1)],
            }),
            steps: this.fb.array<FormControl<string>>([], {
                validators: [Validators.required, this.minArrayLength(1)],
            }),
            servings: this.fb.control<number | null>(null, {
                validators: [Validators.min(1), Validators.max(99), this.integerValidator()],
            }),
            isTermorobot: this.fb.control<boolean>(false, { nonNullable: true }),
            isGrill: this.fb.control<boolean>(false, { nonNullable: true }),
            prepTimeMinutes: this.fb.control<number | null>(null, {
                validators: [Validators.min(0), Validators.max(999), this.integerValidator()],
            }),
            totalTimeMinutes: this.fb.control<number | null>(null, {
                validators: [Validators.min(0), Validators.max(999), this.integerValidator()],
            }),
            dietType: this.fb.control<RecipeDietType | null>(null),
            cuisine: this.fb.control<RecipeCuisine | null>(null),
            difficulty: this.fb.control<RecipeDifficulty | null>(null),
        }, {
            validators: [this.timeRelationValidator()],
        });
    }

    private loadCategories(): void {
        this.categoriesService.loadCategories().subscribe({
            next: () => {
                // If there's a pending draft waiting for categories, apply it now
                if (this.pendingDraft) {
                    this.applyDraftCategoryMapping(this.pendingDraft);
                    this.pendingDraft = null;
                }
            },
        });
    }

    private checkEditMode(): void {
        const idParam = this.route.snapshot.paramMap.get('id');

        if (idParam) {
            const id = parseInt(idParam, 10);
            if (!isNaN(id)) {
                this.isEditMode.set(true);
                this.recipeId.set(id);
                this.loadRecipe(id);
            }
        }
    }

    /**
     * Check if there's an AI draft available and apply it to the form.
     * Only called in create mode.
     */
    private checkAndApplyDraft(): void {
        const draftData = this.draftStateService.consumeDraft();

        if (!draftData) {
            return;
        }

        this.populateFormFromDraft(draftData.draft);
        this.isPrefilledFromDraft.set(true);
    }

    /**
     * Populate form fields from AI draft data.
     * Category mapping is deferred until categories are loaded.
     */
    private populateFormFromDraft(draft: AiRecipeDraftDto): void {
        // Set basic fields
        this.form.patchValue({
            name: draft.name || '',
            description: draft.description || '',
        });

        // Parse and populate ingredients (split by newline)
        this.ingredientsArray.clear();
        if (draft.ingredients_raw && draft.ingredients_raw.trim().length > 0) {
            const ingredients = draft.ingredients_raw
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0);

            ingredients.forEach((ingredient) => {
                this.ingredientsArray.push(
                    this.fb.control(ingredient, { nonNullable: true })
                );
            });
        }

        // Parse and populate steps (split by newline)
        this.stepsArray.clear();
        if (draft.steps_raw && draft.steps_raw.trim().length > 0) {
            const steps = draft.steps_raw
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0);

            steps.forEach((step) => {
                this.stepsArray.push(
                    this.fb.control(step, { nonNullable: true })
                );
            });
        }

        // Populate tags (deduplicated)
        this.tagsArray.clear();
        if (draft.tags && draft.tags.length > 0) {
            const uniqueTags = [...new Set(draft.tags)];
            uniqueTags.forEach((tag) => {
                this.tagsArray.push(
                    this.fb.control(tag, { nonNullable: true })
                );
            });
        }

        // Category mapping - defer if categories not yet loaded
        if (draft.category_name) {
            const loadedCategories = this.categories();
            if (loadedCategories && loadedCategories.length > 0) {
                this.applyDraftCategoryMapping(draft);
            } else {
                // Store draft to apply category after categories load
                this.pendingDraft = draft;
            }
        }
    }

    /**
     * Map category_name from draft to category_id.
     * Uses case-insensitive matching.
     */
    private applyDraftCategoryMapping(draft: AiRecipeDraftDto): void {
        if (!draft.category_name) {
            return;
        }

        const categoryName = draft.category_name.trim().toLowerCase();
        const loadedCategories = this.categories();

        if (!loadedCategories || loadedCategories.length === 0) {
            return;
        }

        const matchedCategory = loadedCategories.find(
            (cat: CategoryDto) => cat.name.trim().toLowerCase() === categoryName
        );

        if (matchedCategory) {
            this.form.patchValue({
                categoryId: matchedCategory.id,
            });
        }
        // If no match found, categoryId remains null - user can select manually
    }

    private loadRecipe(id: number): void {
        this.loading.set(true);
        this.error.set(null);

        this.recipesService.getRecipeById(id).subscribe({
            next: (recipe) => {
                this.populateForm(recipe);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set(err.message || 'Nie udało się pobrać przepisu');
                this.loading.set(false);
            },
        });
    }

    private populateForm(recipe: RecipeDetailDto): void {
        this.form.patchValue({
            name: recipe.name ?? '',
            description: recipe.description ?? '',
            categoryId: recipe.category_id,
            visibility: recipe.visibility ?? 'PRIVATE',
            servings: recipe.servings ?? null,
            isTermorobot: recipe.is_termorobot ?? false,
            isGrill: recipe.is_grill ?? false,
            prepTimeMinutes: recipe.prep_time_minutes ?? null,
            totalTimeMinutes: recipe.total_time_minutes ?? null,
            dietType: recipe.diet_type ?? null,
            cuisine: recipe.cuisine ?? null,
            difficulty: recipe.difficulty ?? null,
        });

        // Set current image URL
        if (recipe.image_path) {
            this.currentImageUrl.set(recipe.image_path);
        }

        // Clear and populate tags
        this.tagsArray.clear();
        if (recipe.tags) {
            recipe.tags.forEach((tag) => {
                this.tagsArray.push(
                    this.fb.control(tag.name, { nonNullable: true })
                );
            });
        }

        // Clear and populate ingredients
        this.ingredientsArray.clear();
        if (recipe.ingredients && recipe.ingredients.length > 0) {
            recipe.ingredients.forEach((item) => {
                const value = item.type === 'header'
                    ? `# ${item.content}`
                    : item.content;
                this.ingredientsArray.push(
                    this.fb.control(value, { nonNullable: true })
                );
            });
        }

        // Clear and populate steps
        this.stepsArray.clear();
        if (recipe.steps && recipe.steps.length > 0) {
            recipe.steps.forEach((item) => {
                const value = item.type === 'header'
                    ? `# ${item.content}`
                    : item.content;
                this.stepsArray.push(
                    this.fb.control(value, { nonNullable: true })
                );
            });
        }
    }

    /**
     * Handles image events from RecipeImageUploadComponent
     */
    onImageEvent(event: RecipeImageEvent): void {
        switch (event.type) {
            case 'pendingFileChanged':
                // Create mode - store pending file
                this.pendingImageFile = event.file;
                break;

            case 'uploaded':
                // Edit mode - update current image URL
                this.currentImageUrl.set(event.imageUrl || event.imagePath);
                break;

            case 'deleted':
                // Edit mode - clear current image URL
                this.currentImageUrl.set(null);
                break;

            case 'uploadingChanged':
                // Update uploading state to block/unblock save button
                this.imageUploading.set(event.uploading);
                break;
        }
    }

    onSubmit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        // Don't allow submit while image is uploading
        if (this.imageUploading()) {
            return;
        }

        this.saving.set(true);
        this.error.set(null);

        const formValue = this.form.getRawValue();
        const command = this.mapFormToCommand(formValue);

        if (this.isEditMode() && this.recipeId()) {
            this.updateRecipe(this.recipeId()!, command);
        } else {
            this.createRecipe(command);
        }
    }

    private mapFormToCommand(
        formValue: ReturnType<FormGroup<RecipeFormViewModel>['getRawValue']>
    ): CreateRecipeCommand {
        // Normalizacja servings: puste wartości → null, wartości liczbowe → liczba całkowita
        const servings = formValue.servings !== null && formValue.servings !== undefined
            ? Math.round(formValue.servings)
            : null;

        // Normalizacja czasów: puste wartości → null, wartości liczbowe → liczba całkowita
        const prepTimeMinutes = formValue.prepTimeMinutes !== null && formValue.prepTimeMinutes !== undefined
            ? Math.round(formValue.prepTimeMinutes)
            : null;

        const totalTimeMinutes = formValue.totalTimeMinutes !== null && formValue.totalTimeMinutes !== undefined
            ? Math.round(formValue.totalTimeMinutes)
            : null;

        return {
            name: formValue.name,
            description: formValue.description || null,
            category_id: formValue.categoryId,
            visibility: formValue.visibility,
            ingredients_raw: formValue.ingredients.join('\n'),
            steps_raw: formValue.steps.join('\n'),
            tags: formValue.tags,
            servings: servings,
            is_termorobot: formValue.isTermorobot,
            is_grill: formValue.isGrill,
            prep_time_minutes: prepTimeMinutes,
            total_time_minutes: totalTimeMinutes,
            diet_type: formValue.dietType ?? null,
            cuisine: formValue.cuisine ?? null,
            difficulty: formValue.difficulty ?? null,
        };
    }

    /**
     * Creates a new recipe
     * If there's a pending image file, uploads it after recipe creation
     */
    private createRecipe(command: CreateRecipeCommand): void {
        this.recipesService.createRecipe(command, null).subscribe({
            next: (recipe) => {
                // If there's a pending image, upload it now
                if (this.pendingImageFile) {
                    this.uploadPendingImage(recipe.id, command.name);
                } else {
                    // No pending image, navigate immediately
                    this.saving.set(false);
                    this.navigateToRecipe(recipe.id, command.name);
                }
            },
            error: (err) => {
                this.error.set(err.message || 'Nie udało się utworzyć przepisu');
                this.saving.set(false);
            },
        });
    }

    /**
     * Uploads pending image after recipe creation
     */
    private uploadPendingImage(recipeId: number, recipeName: string): void {
        if (!this.pendingImageFile) {
            this.saving.set(false);
            this.navigateToRecipe(recipeId, recipeName);
            return;
        }

        this.recipesService.uploadRecipeImage(recipeId, this.pendingImageFile).subscribe({
            next: () => {
                this.saving.set(false);
                this.navigateToRecipe(recipeId, recipeName);
            },
            error: (err) => {
                // Recipe was created, but image upload failed
                // Still navigate to the recipe, but show error
                console.error('Failed to upload image:', err);
                this.saving.set(false);
                this.navigateToRecipe(recipeId, recipeName);
            },
        });
    }

    /**
     * Updates an existing recipe
     * Note: Image is handled separately through RecipeImageUploadComponent's auto-upload
     */
    private updateRecipe(id: number, command: UpdateRecipeCommand): void {
        this.recipesService.updateRecipe(id, command, null).subscribe({
            next: () => {
                this.saving.set(false);
                // Use name from command, fallback to current form value
                const recipeName = command.name ?? this.form.get('name')?.value ?? 'przepis';
                this.navigateToRecipe(id, recipeName);
            },
            error: (err) => {
                this.error.set(err.message || 'Nie udało się zaktualizować przepisu');
                this.saving.set(false);
            },
        });
    }

    /**
     * Handle AI image generation button click.
     * Opens dialog and starts image generation.
     * Supports regeneration loop - user can request new image without closing dialog.
     */
    async onGenerateAiImage(): Promise<void> {
        // Precondition: must be in edit mode
        if (!this.recipeId()) {
            return;
        }

        // Validate minimum form data for AI generation
        const validationError = this.validateFormForAiImage();
        if (validationError) {
            this.snackBar.open(validationError, undefined, { duration: 4000 });
            return;
        }

        // Dialog configuration
        const dialogConfig = {
            data: { recipeName: this.form.controls.name.value } as AiRecipeImageDialogData,
            disableClose: true,
            width: '560px',
            maxWidth: '95vw',
        };

        // Start generation loop - supports regeneration requests
        let shouldRegenerate = true;

        while (shouldRegenerate) {
            shouldRegenerate = false;

            // Open dialog in loading state
            const dialogRef = this.dialog.open(AiRecipeImagePreviewDialogComponent, dialogConfig);
            this.aiGenerating.set(true);

            try {
                // Build request from current form data (may have changed since last generation)
                const request = this.buildAiImageRequest();

                // Call AI service
                const response = await this.aiRecipeImageService.generateImage(request);

                // Build data URL for preview
                const dataUrl = `data:${response.image.mime_type};base64,${response.image.data_base64}`;

                // Update dialog with success
                dialogRef.componentInstance.setSuccess(dataUrl);

                // Generation complete - unblock upload to allow applying image
                this.aiGenerating.set(false);

                // Wait for dialog result
                const result = await dialogRef.afterClosed().toPromise() as AiRecipeImageDialogResult | undefined;

                if (result?.action === 'applied') {
                    // Convert base64 to File and apply
                    this.applyAiGeneratedImage(response.image.data_base64, response.image.mime_type);
                } else if (result?.action === 'regenerate') {
                    // User requested regeneration - loop will reopen dialog
                    shouldRegenerate = true;
                }
            } catch (error) {
                // Handle specific error types
                const { message, reasons } = this.mapAiImageError(error);
                dialogRef.componentInstance.setError(message, reasons);

                // Generation failed - unblock UI
                this.aiGenerating.set(false);

                // Wait for dialog result
                const result = await dialogRef.afterClosed().toPromise() as AiRecipeImageDialogResult | undefined;

                if (result?.action === 'regenerate') {
                    // User requested regeneration after error - loop will reopen dialog
                    shouldRegenerate = true;
                }
            }
        }

        // Ensure aiGenerating is false when exiting
        this.aiGenerating.set(false);
    }

    /**
     * Validate form has minimum data required for AI image generation.
     * Returns error message if invalid, null if valid.
     */
    private validateFormForAiImage(): string | null {
        const formValue = this.form.getRawValue();

        if (!formValue.name || formValue.name.trim().length === 0) {
            return 'Uzupełnij nazwę przepisu przed wygenerowaniem zdjęcia.';
        }

        if (!formValue.ingredients || formValue.ingredients.length === 0) {
            return 'Dodaj przynajmniej jeden składnik przed wygenerowaniem zdjęcia.';
        }

        if (!formValue.steps || formValue.steps.length === 0) {
            return 'Dodaj przynajmniej jeden krok przed wygenerowaniem zdjęcia.';
        }

        return null;
    }

    /**
     * Build AI image request DTO from current form values.
     */
    private buildAiImageRequest(): AiRecipeImageRequestDto {
        const formValue = this.form.getRawValue();
        const recipeId = this.recipeId()!;

        // Map category ID to category name
        let categoryName: string | null = null;
        if (formValue.categoryId) {
            const category = this.categories()?.find(c => c.id === formValue.categoryId);
            categoryName = category?.name ?? null;
        }

        // Map ingredients to content items
        const ingredients: AiRecipeImageContentItem[] = formValue.ingredients.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
                return { type: 'header' as const, content: trimmed.replace(/^#+\s*/, '') };
            }
            return { type: 'item' as const, content: trimmed };
        });

        // Map steps to content items
        const steps: AiRecipeImageContentItem[] = formValue.steps.map(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
                return { type: 'header' as const, content: trimmed.replace(/^#+\s*/, '') };
            }
            return { type: 'item' as const, content: trimmed };
        });

        return {
            recipe: {
                id: recipeId,
                name: formValue.name,
                description: formValue.description || null,
                servings: formValue.servings ?? null,
                is_termorobot: formValue.isTermorobot,
                is_grill: formValue.isGrill,
                category_name: categoryName,
                ingredients,
                steps,
                tags: formValue.tags,
            },
            output: {
                mime_type: 'image/webp',
                width: 1024,
                height: 1024,
            },
            language: 'pl',
            output_format: 'pycha_recipe_image_v1',
        };
    }

    /**
     * Convert base64 image to File and apply to image upload component.
     */
    private applyAiGeneratedImage(base64Data: string, mimeType: string): void {
        // Decode base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Determine file extension based on MIME type
        let extension: string;
        switch (mimeType) {
            case 'image/webp':
                extension = 'webp';
                break;
            case 'image/png':
                extension = 'png';
                break;
            case 'image/jpeg':
                extension = 'jpg';
                break;
            default:
                extension = 'webp';
        }

        // Create Blob and File
        const blob = new Blob([bytes], { type: mimeType });
        const file = new File([blob], `ai-recipe-image.${extension}`, { type: mimeType });

        // Apply to image upload component
        this.imageUploadComponent.applyExternalFile(file);
    }

    /**
     * Map AI image generation error to user-friendly message.
     */
    private mapAiImageError(error: unknown): { message: string; reasons: string[] } {
        if (error instanceof AiImageValidationError) {
            return {
                message: error.message,
                reasons: error.reasons,
            };
        }

        if (error instanceof AiImageRateLimitError) {
            return {
                message: error.message,
                reasons: [],
            };
        }

        if (error instanceof AiImagePremiumRequiredError) {
            return {
                message: error.message,
                reasons: [],
            };
        }

        if (error instanceof Error) {
            return {
                message: error.message,
                reasons: [],
            };
        }

        return {
            message: 'Nie udało się wygenerować zdjęcia. Spróbuj ponownie.',
            reasons: [],
        };
    }

    onCancel(): void {
        if (this.isEditMode() && this.recipeId()) {
            const recipeName = this.form.get('name')?.value ?? 'przepis';
            this.navigateToRecipe(this.recipeId()!, recipeName);
        } else {
            this.router.navigate(['/my-recipies']);
        }
    }

    /**
     * Nawiguje do szczegółów przepisu w formacie kanonicznym :id-:slug
     */
    private navigateToRecipe(id: number, recipeName: string): void {
        const slug = this.slugService.slugify(recipeName);
        const recipeSegment = `${id}-${slug}`;
        this.router.navigate(['/recipes', recipeSegment]);
    }

    /** Custom validator to check minimum array length */
    private minArrayLength(min: number) {
        return (control: AbstractControl): ValidationErrors | null => {
            const arrayControl = control as FormArray;
            if (arrayControl.length < min) {
                return { minArrayLength: true };
            }
            return null;
        };
    }

    /** Custom validator to check if value is an integer */
    private integerValidator() {
        return (control: AbstractControl): ValidationErrors | null => {
            const value = control.value;

            // Wartość null jest dozwolona (pole opcjonalne)
            if (value === null || value === undefined) {
                return null;
            }

            // Sprawdź czy wartość jest liczbą całkowitą
            if (!Number.isInteger(value)) {
                return { notInteger: true };
            }

            return null;
        };
    }

    /**
     * Cross-field validator for time relation: total_time_minutes >= prep_time_minutes
     * Only validates when both fields are set (not null).
     * Sets error on totalTimeMinutes control for better UX.
     */
    private timeRelationValidator() {
        return (formGroup: AbstractControl): ValidationErrors | null => {
            const prepControl = (formGroup as FormGroup).get('prepTimeMinutes');
            const totalControl = (formGroup as FormGroup).get('totalTimeMinutes');

            if (!prepControl || !totalControl) {
                return null;
            }

            const prepTime = prepControl.value;
            const totalTime = totalControl.value;

            // Jeśli którakolwiek wartość jest null - brak walidacji relacji
            if (prepTime === null || prepTime === undefined || totalTime === null || totalTime === undefined) {
                // Usuń błąd relacji jeśli był ustawiony
                const currentErrors = totalControl.errors;
                if (currentErrors && currentErrors['totalLessThanPrep']) {
                const remainingErrors = { ...currentErrors };
                delete remainingErrors['totalLessThanPrep'];
                totalControl.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
                }
                return null;
            }

            // Sprawdź relację: total >= prep
            if (totalTime < prepTime) {
                // Ustaw błąd na kontrolce totalTimeMinutes
                totalControl.setErrors({
                    ...totalControl.errors,
                    totalLessThanPrep: true,
                });
                return { timeRelationInvalid: true };
            }

            // Relacja OK - usuń błąd totalLessThanPrep jeśli istnieje
            const currentErrors = totalControl.errors;
            if (currentErrors && currentErrors['totalLessThanPrep']) {
            const remainingErrors = { ...currentErrors };
            delete remainingErrors['totalLessThanPrep'];
            totalControl.setErrors(Object.keys(remainingErrors).length > 0 ? remainingErrors : null);
            }

            return null;
        };
    }
}
