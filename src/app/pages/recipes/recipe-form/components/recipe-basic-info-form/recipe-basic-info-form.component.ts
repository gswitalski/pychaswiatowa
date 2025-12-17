import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'pych-recipe-basic-info-form',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
    ],
    templateUrl: './recipe-basic-info-form.component.html',
    styleUrl: './recipe-basic-info-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeBasicInfoFormComponent {
    @Input({ required: true }) nameControl!: FormControl<string>;
    @Input({ required: true }) descriptionControl!: FormControl<string>;
    @Input({ required: true }) servingsControl!: FormControl<number | null>;

    /**
     * Czyści pole liczby porcji (ustawia wartość na null)
     */
    clearServings(): void {
        this.servingsControl.setValue(null);
        this.servingsControl.markAsTouched();
    }
}

