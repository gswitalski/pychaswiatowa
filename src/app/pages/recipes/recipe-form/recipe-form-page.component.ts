import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    inject,
    signal,
    computed,
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

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { RecipeBasicInfoFormComponent } from './components/recipe-basic-info-form/recipe-basic-info-form.component';
import { RecipeImageUploadComponent, RecipeImageEvent } from './components/recipe-image-upload/recipe-image-upload.component';
import { RecipeCategorizationFormComponent } from './components/recipe-categorization-form/recipe-categorization-form.component';
import { EditableListComponent } from '../../../shared/components/editable-list/editable-list.component';

import { CategoriesService } from '../../../core/services/categories.service';
import { RecipesService } from '../services/recipes.service';
import {
    RecipeDetailDto,
    CreateRecipeCommand,
    UpdateRecipeCommand,
    RecipeVisibility,
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
    private readonly categoriesService = inject(CategoriesService);
    private readonly recipesService = inject(RecipesService);

    /** Signal indicating edit mode vs create mode */
    readonly isEditMode = signal<boolean>(false);

    /** Recipe ID when in edit mode */
    readonly recipeId = signal<number | null>(null);

    /** Loading state for fetching recipe data */
    readonly loading = signal<boolean>(false);

    /** Saving state for form submission */
    readonly saving = signal<boolean>(false);

    /** Image uploading state (for blocking save button) */
    readonly imageUploading = signal<boolean>(false);

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

        return formInvalid || saving || imageUploading;
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

    ngOnInit(): void {
        this.initForm();
        this.loadCategories();
        this.checkEditMode();

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
        });
    }

    private loadCategories(): void {
        this.categoriesService.loadCategories().subscribe();
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
                    this.uploadPendingImage(recipe.id);
                } else {
                    // No pending image, navigate immediately
                    this.saving.set(false);
                    this.router.navigate(['/recipes', recipe.id]);
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
    private uploadPendingImage(recipeId: number): void {
        if (!this.pendingImageFile) {
            this.saving.set(false);
            this.router.navigate(['/recipes', recipeId]);
            return;
        }

        this.recipesService.uploadRecipeImage(recipeId, this.pendingImageFile).subscribe({
            next: () => {
                this.saving.set(false);
                this.router.navigate(['/recipes', recipeId]);
            },
            error: (err) => {
                // Recipe was created, but image upload failed
                // Still navigate to the recipe, but show error
                console.error('Failed to upload image:', err);
                this.saving.set(false);
                this.router.navigate(['/recipes', recipeId]);
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
                this.router.navigate(['/recipes', id]);
            },
            error: (err) => {
                this.error.set(err.message || 'Nie udało się zaktualizować przepisu');
                this.saving.set(false);
            },
        });
    }

    onCancel(): void {
        if (this.isEditMode() && this.recipeId()) {
            this.router.navigate(['/recipes', this.recipeId()]);
        } else {
            this.router.navigate(['/my-recipies']);
        }
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
}
