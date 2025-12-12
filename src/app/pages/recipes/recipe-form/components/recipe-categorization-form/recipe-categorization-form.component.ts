import {
    ChangeDetectionStrategy,
    Component,
    Input,
    inject,
} from '@angular/core';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { FormArray, FormControl, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule, MatChipInputEvent } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { CategoryDto, RecipeVisibility } from '../../../../../../../shared/contracts/types';

@Component({
    selector: 'pych-recipe-categorization-form',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatChipsModule,
        MatIconModule,
        MatInputModule,
        MatRadioModule,
    ],
    templateUrl: './recipe-categorization-form.component.html',
    styleUrl: './recipe-categorization-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeCategorizationFormComponent {
    private readonly fb = inject(FormBuilder);

    @Input({ required: true }) categoryControl!: FormControl<number | null>;
    @Input({ required: true }) tagsArray!: FormArray<FormControl<string>>;
    @Input({ required: true }) visibilityControl!: FormControl<RecipeVisibility>;
    @Input() categories: CategoryDto[] = [];

    readonly separatorKeyCodes = [ENTER, COMMA] as const;

    addTag(event: MatChipInputEvent): void {
        const value = (event.value || '').trim();

        if (value && !this.tagExists(value)) {
            this.tagsArray.push(this.fb.control(value, { nonNullable: true }));
        }

        event.chipInput.clear();
    }

    removeTag(index: number): void {
        this.tagsArray.removeAt(index);
    }

    private tagExists(tag: string): boolean {
        const normalizedTag = tag.toLowerCase();
        return this.tagsArray.controls.some(
            (control) => control.value.toLowerCase() === normalizedTag
        );
    }
}

