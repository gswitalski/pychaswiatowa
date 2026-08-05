import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    inject,
    Input,
    Output,
    signal,
} from '@angular/core';
import {
    AsyncValidatorFn,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, map, of, switchMap, timer } from 'rxjs';
import { ProfileSettingsApiService } from '../../../../../core/services/profile-settings-api.service';

interface CompleteProfileFormViewModel {
    username: FormControl<string>;
}

@Component({
    selector: 'pych-complete-profile-form',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './complete-profile-form.component.html',
    styleUrl: './complete-profile-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompleteProfileFormComponent {
    private readonly profileSettingsApi = inject(ProfileSettingsApiService);
    private _serverError: string | null = null;

    @Input() public isSaving = false;
    @Input()
    public set serverError(error: string | null) {
        this._serverError = error;
        if (error !== 'Ta nazwa użytkownika jest już zajęta.') {
            return;
        }

        const control = this.form.controls.username;
        control.setErrors({ ...control.errors, usernameTaken: true });
        control.markAsTouched();
    }

    public get serverError(): string | null {
        return this._serverError;
    }

    @Output() public save = new EventEmitter<string>();

    public readonly usernameCheckWarning = signal(false);
    public readonly form = new FormGroup<CompleteProfileFormViewModel>({
        username: new FormControl('', {
            nonNullable: true,
            validators: [
                Validators.required,
                Validators.minLength(3),
                Validators.maxLength(50),
                Validators.pattern(/^\S+$/),
            ],
            asyncValidators: [this.usernameAvailabilityValidator()],
        }),
    });

    public submitForm(): void {
        if (this.form.valid) {
            this.save.emit(this.form.controls.username.value);
            return;
        }

        this.form.markAllAsTouched();
    }

    public getUsernameErrorMessage(): string {
        const control = this.form.controls.username;
        if (control.hasError('required')) {
            return 'To pole jest wymagane';
        }
        if (control.hasError('minlength') || control.hasError('maxlength')) {
            return 'Nazwa użytkownika musi mieć od 3 do 50 znaków';
        }
        if (control.hasError('pattern')) {
            return 'Nazwa nie może zawierać spacji';
        }
        if (control.hasError('usernameTaken')) {
            return 'Ta nazwa użytkownika jest już zajęta.';
        }
        return '';
    }

    private usernameAvailabilityValidator(): AsyncValidatorFn {
        return (control) => {
            if (!control.value || control.invalid) {
                return of(null);
            }

            this.usernameCheckWarning.set(false);
            return timer(400).pipe(
                switchMap(() =>
                    this.profileSettingsApi.checkUsernameAvailable(
                        control.value.trim()
                    )
                ),
                map((response) => (response.available ? null : { usernameTaken: true })),
                catchError(() => {
                    this.usernameCheckWarning.set(true);
                    return of(null);
                })
            );
        };
    }
}
