import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import {
    RecipeDietType,
    RecipeCuisine,
    RecipeDifficulty,
} from '../../../../../../../shared/contracts/types';
import {
    RECIPE_DIET_TYPE_LABELS,
    RECIPE_CUISINE_LABELS,
    RECIPE_DIFFICULTY_LABELS,
    RECIPE_DIET_TYPE_OPTIONS,
    RECIPE_CUISINE_OPTIONS,
    RECIPE_DIFFICULTY_OPTIONS,
} from '../../../../../shared/models/recipe-classification.model';

@Component({
    selector: 'pych-recipe-basic-info-form',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatSlideToggleModule,
        MatSelectModule,
    ],
    templateUrl: './recipe-basic-info-form.component.html',
    styleUrl: './recipe-basic-info-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeBasicInfoFormComponent {
    @Input({ required: true }) nameControl!: FormControl<string>;
    @Input({ required: true }) descriptionControl!: FormControl<string>;
    @Input({ required: true }) servingsControl!: FormControl<number | null>;
    @Input({ required: true }) isTermorobotControl!: FormControl<boolean>;
    @Input({ required: true }) prepTimeMinutesControl!: FormControl<number | null>;
    @Input({ required: true }) totalTimeMinutesControl!: FormControl<number | null>;
    @Input({ required: true }) dietTypeControl!: FormControl<RecipeDietType | null>;
    @Input({ required: true }) cuisineControl!: FormControl<RecipeCuisine | null>;
    @Input({ required: true }) difficultyControl!: FormControl<RecipeDifficulty | null>;

    // Mapy etykiet dla pól klasyfikacyjnych
    readonly dietTypeLabels = RECIPE_DIET_TYPE_LABELS;
    readonly cuisineLabels = RECIPE_CUISINE_LABELS;
    readonly difficultyLabels = RECIPE_DIFFICULTY_LABELS;

    // Opcje dla pól klasyfikacyjnych
    readonly dietTypeOptions = RECIPE_DIET_TYPE_OPTIONS;
    readonly cuisineOptions = RECIPE_CUISINE_OPTIONS;
    readonly difficultyOptions = RECIPE_DIFFICULTY_OPTIONS;

    /**
     * Czyści pole liczby porcji (ustawia wartość na null)
     */
    clearServings(): void {
        this.servingsControl.setValue(null);
        this.servingsControl.markAsTouched();
    }

    /**
     * Czyści pole czasu przygotowania (ustawia wartość na null)
     */
    clearPrepTime(): void {
        this.prepTimeMinutesControl.setValue(null);
        this.prepTimeMinutesControl.markAsTouched();
    }

    /**
     * Czyści pole czasu całkowitego (ustawia wartość na null)
     */
    clearTotalTime(): void {
        this.totalTimeMinutesControl.setValue(null);
        this.totalTimeMinutesControl.markAsTouched();
    }

    /**
     * Czyści pole typu diety (ustawia wartość na null)
     */
    clearDietType(): void {
        this.dietTypeControl.setValue(null);
        this.dietTypeControl.markAsTouched();
    }

    /**
     * Czyści pole kuchni (ustawia wartość na null)
     */
    clearCuisine(): void {
        this.cuisineControl.setValue(null);
        this.cuisineControl.markAsTouched();
    }

    /**
     * Czyści pole trudności (ustawia wartość na null)
     */
    clearDifficulty(): void {
        this.difficultyControl.setValue(null);
        this.difficultyControl.markAsTouched();
    }
}

