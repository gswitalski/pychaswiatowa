import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { RecipesService } from '../services/recipes.service';
import { ApiError, ImportRecipeCommand } from '../../../../../shared/contracts/types';

/**
 * Defines the structure of the import form.
 */
export interface RecipeImportFormViewModel {
    rawText: FormControl<string | null>;
}

/**
 * Describes the local state of the component.
 */
export interface RecipeImportState {
    pending: boolean;
    error: ApiError | null;
}

@Component({
    selector: 'pych-recipe-import-page',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
    ],
    templateUrl: './recipe-import-page.component.html',
    styleUrl: './recipe-import-page.component.scss',
})
export class RecipeImportPageComponent {
    private readonly recipesService = inject(RecipesService);
    private readonly router = inject(Router);

    /**
     * Form group for recipe import
     */
    readonly form = new FormGroup<RecipeImportFormViewModel>({
        rawText: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
    });

    /**
     * Component state signal
     */
    readonly state = signal<RecipeImportState>({
        pending: false,
        error: null,
    });

    /**
     * Handles form submission
     */
    submit(): void {
        if (this.form.invalid) {
            return;
        }

        // Reset error state
        this.state.update(s => ({ ...s, pending: true, error: null }));

        const rawText = this.form.value.rawText?.trim() || '';

        const command: ImportRecipeCommand = {
            raw_text: rawText,
        };

        this.recipesService.importRecipe(command).subscribe({
            next: (recipe) => {
                this.state.update(s => ({ ...s, pending: false }));
                // Navigate to edit page of newly created recipe
                this.router.navigate(['/recipes', recipe.id, 'edit']);
            },
            error: (error) => {
                this.state.update(s => ({
                    ...s,
                    pending: false,
                    error: {
                        message: error?.message || 'Wystąpił błąd podczas importu przepisu',
                        status: error?.status || 500,
                    },
                }));
            },
        });
    }
}

