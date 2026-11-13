import {
    ChangeDetectionStrategy,
    Component,
    effect,
    inject,
    input,
    output,
} from '@angular/core';
import {
    AbstractControl,
    FormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { CategoryDto } from '../../../../../shared/contracts/types';
import {
    AdminRecipesFiltersVm,
    EMPTY_ADMIN_RECIPES_FILTERS,
} from './admin-recipes.models';

function orderedRangeValidator(minKey: string, maxKey: string) {
    return (control: AbstractControl): ValidationErrors | null => {
        const min = control.get(minKey)?.value;
        const max = control.get(maxKey)?.value;
        return min !== null && min !== '' && max !== null && max !== '' && Number(min) > Number(max)
            ? { orderedRange: true }
            : null;
    };
}

@Component({
    selector: 'pych-admin-recipes-filters',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSelectModule,
    ],
    templateUrl: './admin-recipes-filters.component.html',
    styleUrl: './admin-recipes-filters.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRecipesFiltersComponent {
    private readonly fb = inject(FormBuilder);

    readonly categories = input.required<readonly CategoryDto[]>();
    readonly categoriesLoading = input.required<boolean>();
    readonly categoriesError = input.required<string | null>();
    readonly appliedFilters = input.required<AdminRecipesFiltersVm>();
    readonly apply = output<AdminRecipesFiltersVm>();
    readonly clear = output<void>();
    readonly retryCategories = output<void>();

    readonly form = this.fb.group(
        {
            id: this.fb.control<number | null>(null, [Validators.min(1), Validators.pattern(/^\d+$/)]),
            name: this.fb.nonNullable.control('', [Validators.maxLength(100)]),
            author: this.fb.nonNullable.control('', [Validators.maxLength(100)]),
            categoryIds: this.fb.control<readonly number[]>([]),
            includeUncategorized: this.fb.control(false, { nonNullable: true }),
            createdFrom: this.fb.nonNullable.control(''),
            createdTo: this.fb.nonNullable.control(''),
            ratingMin: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(5)]),
            ratingMax: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(5)]),
            ratingsCountMin: this.fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)]),
            ratingsCountMax: this.fb.control<number | null>(null, [Validators.min(0), Validators.pattern(/^\d+$/)]),
            isGrill: this.fb.control(false, { nonNullable: true }),
            isTermorobot: this.fb.control(false, { nonNullable: true }),
        },
        {
            validators: [
                orderedRangeValidator('createdFrom', 'createdTo'),
                orderedRangeValidator('ratingMin', 'ratingMax'),
                orderedRangeValidator('ratingsCountMin', 'ratingsCountMax'),
            ],
        }
    );

    constructor() {
        effect(() => this.form.reset(this.appliedFilters(), { emitEvent: false }));
    }

    onSubmit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const value = this.form.getRawValue();
        this.apply.emit({
            id: value.id,
            name: value.name.trim(),
            author: value.author.trim(),
            categoryIds: value.categoryIds ?? [],
            includeUncategorized: value.includeUncategorized,
            createdFrom: value.createdFrom,
            createdTo: value.createdTo,
            ratingMin: value.ratingMin,
            ratingMax: value.ratingMax,
            ratingsCountMin: value.ratingsCountMin,
            ratingsCountMax: value.ratingsCountMax,
            isGrill: value.isGrill,
            isTermorobot: value.isTermorobot,
        });
    }

    onClear(): void {
        this.form.reset(EMPTY_ADMIN_RECIPES_FILTERS);
        this.clear.emit();
    }

    onRetryCategories(): void {
        this.retryCategories.emit();
    }

    onEnter(event: Event): void {
        event.preventDefault();
        this.onSubmit();
    }
}
