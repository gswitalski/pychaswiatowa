import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
    selector: 'pych-recipe-basic-info-form',
    standalone: true,
    imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
    templateUrl: './recipe-basic-info-form.component.html',
    styleUrl: './recipe-basic-info-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeBasicInfoFormComponent {
    @Input({ required: true }) nameControl!: FormControl<string>;
    @Input({ required: true }) descriptionControl!: FormControl<string>;
}

