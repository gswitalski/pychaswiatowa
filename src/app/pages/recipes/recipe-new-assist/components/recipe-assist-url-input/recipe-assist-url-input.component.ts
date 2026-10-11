import {
    ChangeDetectionStrategy,
    Component,
    computed,
    EventEmitter,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
    signal,
} from '@angular/core';
import {
    AbstractControl,
    FormControl,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export const urlValidator: ValidatorFn = (
    control: AbstractControl<string | null>,
): ValidationErrors | null => {
    const value = control.value?.trim() ?? '';

    if (!value) {
        return null;
    }

    if (value.length > 2048) {
        return { urlTooLong: true };
    }

    if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return { urlNoProtocol: true };
    }

    try {
        new URL(value);
        return null;
    } catch {
        return { urlInvalid: true };
    }
};

@Component({
    selector: 'pych-recipe-assist-url-input',
    standalone: true,
    imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
    templateUrl: './recipe-assist-url-input.component.html',
    styleUrl: './recipe-assist-url-input.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeAssistUrlInputComponent implements OnChanges {
    @Input() disabled = false;
    @Output() readonly urlChange = new EventEmitter<string | null>();

    readonly urlControl = new FormControl('', {
        nonNullable: true,
        validators: [urlValidator],
    });
    private readonly validationVersion = signal(0);

    readonly errorMessage = computed(() => {
        this.validationVersion();
        if (!this.urlControl.touched) {
            return null;
        }

        if (!this.urlControl.value.trim()) {
            return 'Wklej adres strony z przepisem.';
        }

        if (this.urlControl.hasError('urlTooLong')) {
            return 'Adres jest zbyt długi (max 2048 znaków).';
        }

        if (this.urlControl.hasError('urlNoProtocol')) {
            return 'Adres musi zaczynać się od https:// lub http://.';
        }

        if (this.urlControl.hasError('urlInvalid')) {
            return 'To nie wygląda na poprawny adres strony.';
        }

        return null;
    });

    constructor() {
        this.urlControl.valueChanges.subscribe((value) => {
            this.validationVersion.update((version) => version + 1);
            this.urlChange.emit(this.urlControl.valid && value.trim() ? value.trim() : null);
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (!changes['disabled']) {
            return;
        }

        if (this.disabled) {
            this.urlControl.disable({ emitEvent: false });
            return;
        }

        this.urlControl.enable({ emitEvent: false });
    }

    onBlur(): void {
        this.urlControl.markAsTouched();
        this.urlControl.updateValueAndValidity();
        this.validationVersion.update((version) => version + 1);
    }
}
