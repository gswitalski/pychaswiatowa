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
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { RecipeBasicInfoFormComponent } from './components/recipe-basic-info-form/recipe-basic-info-form.component';
import { RecipeImageUploadComponent } from './components/recipe-image-upload/recipe-image-upload.component';
import { RecipeCategorizationFormComponent } from './components/recipe-categorization-form/recipe-categorization-form.component';
import { EditableListComponent } from '../../../shared/components/editable-list/editable-list.component';

import { CategoriesService } from '../../../core/services/categories.service';
import { RecipesService } from '../services/recipes.service';
import {
    RecipeDetailDto,
    CreateRecipeCommand,
    UpdateRecipeCommand,
} from '../../../../../shared/contracts/types';

export interface RecipeFormViewModel {
    name: FormControl<string>;
    description: FormControl<string>;
    categoryId: FormControl<number | null>;
    tags: FormArray<FormControl<string>>;
    ingredients: FormArray<FormControl<string>>;
    steps: FormArray<FormControl<string>>;
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

    /** Error message */
    readonly error = signal<string | null>(null);

    /** Categories from service */
    readonly categories = this.categoriesService.categories;

    /** Current image URL (for edit mode) */
    readonly currentImageUrl = signal<string | null>(null);

    /** Selected image file */
    private selectedImageFile: File | null = null;

    /** Page title computed based on mode */
    readonly pageTitle = computed(() =>
        this.isEditMode() ? 'Edytuj przepis' : 'Nowy przepis'
    );

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

    ngOnInit(): void {
        this.initForm();
        this.loadCategories();
        this.checkEditMode();
    }

    private initForm(): void {
        this.form = this.fb.group<RecipeFormViewModel>({
            name: this.fb.control('', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(150)],
            }),
            description: this.fb.control('', { nonNullable: true }),
            categoryId: this.fb.control<number | null>(null),
            tags: this.fb.array<FormControl<string>>([]),
            ingredients: this.fb.array<FormControl<string>>([], {
                validators: [Validators.required, this.minArrayLength(1)],
            }),
            steps: this.fb.array<FormControl<string>>([], {
                validators: [Validators.required, this.minArrayLength(1)],
            }),
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
        if (recipe.ingredients) {
            recipe.ingredients.forEach((item) => {
                this.ingredientsArray.push(
                    this.fb.control(
                        item.type === 'header'
                            ? `# ${item.content}`
                            : item.content,
                        { nonNullable: true }
                    )
                );
            });
        }

        // Clear and populate steps
        this.stepsArray.clear();
        if (recipe.steps) {
            recipe.steps.forEach((item) => {
                this.stepsArray.push(
                    this.fb.control(
                        item.type === 'header'
                            ? `# ${item.content}`
                            : item.content,
                        { nonNullable: true }
                    )
                );
            });
        }
    }

    onImageChange(file: File | null): void {
        this.selectedImageFile = file;
    }

    onSubmit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
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
        return {
            name: formValue.name,
            description: formValue.description || null,
            category_id: formValue.categoryId,
            ingredients_raw: formValue.ingredients.join('\n'),
            steps_raw: formValue.steps.join('\n'),
            tags: formValue.tags,
        };
    }

    private createRecipe(command: CreateRecipeCommand): void {
        this.recipesService.createRecipe(command, this.selectedImageFile).subscribe({
            next: (recipe) => {
                this.saving.set(false);
                this.router.navigate(['/recipes', recipe.id]);
            },
            error: (err) => {
                this.error.set(err.message || 'Nie udało się utworzyć przepisu');
                this.saving.set(false);
            },
        });
    }

    private updateRecipe(id: number, command: UpdateRecipeCommand): void {
        this.recipesService.updateRecipe(id, command, this.selectedImageFile).subscribe({
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
            this.router.navigate(['/recipes']);
        }
    }

    /** Custom validator to check minimum array length */
    private minArrayLength(min: number) {
        return (control: FormArray): Record<string, boolean> | null => {
            if (control.length < min) {
                return { minArrayLength: true };
            }
            return null;
        };
    }
}

