import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnInit,
    Output,
} from '@angular/core';
import {
    AbstractControl,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { OauthGoogleButtonComponent } from '../../../../shared/components/oauth-google-button/oauth-google-button.component';

interface RegisterFormViewModel {
    email: FormControl<string>;
    displayName: FormControl<string>;
    password: FormControl<string>;
    passwordConfirm: FormControl<string>;
    marketingConsentAccepted: FormControl<boolean>;
}

@Component({
    selector: 'pych-register-form',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        RouterLink,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatCheckboxModule,
        OauthGoogleButtonComponent,
    ],
    templateUrl: './register-form.component.html',
    styleUrl: './register-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterFormComponent implements OnInit {
    @Input() isLoading = false;
    @Input() prefillEmail = '';
    @Input() isGoogleLoading = false;

    @Output() registerSubmit = new EventEmitter<{
        email: string;
        displayName: string;
        password: string;
        marketingConsentAccepted: boolean;
    }>();
    @Output() registerWithGoogle = new EventEmitter<void>();

    form = new FormGroup<RegisterFormViewModel>(
        {
            email: new FormControl('', {
                nonNullable: true,
                validators: [Validators.required, Validators.email],
            }),
            displayName: new FormControl('', {
                nonNullable: true,
                validators: [Validators.required, Validators.minLength(3)],
            }),
            password: new FormControl('', {
                nonNullable: true,
                validators: [Validators.required, Validators.minLength(8)],
            }),
            passwordConfirm: new FormControl('', {
                nonNullable: true,
                validators: [Validators.required],
            }),
            marketingConsentAccepted: new FormControl(false, {
                nonNullable: true,
            }),
        },
        { validators: this.passwordMatchValidator }
    );

    ngOnInit(): void {
        if (this.prefillEmail) {
            this.form.controls.email.setValue(this.prefillEmail);
        }
    }

    private passwordMatchValidator(
        control: AbstractControl
    ): ValidationErrors | null {
        const password = control.get('password');
        const passwordConfirm = control.get('passwordConfirm');

        if (!password || !passwordConfirm) {
            return null;
        }

        if (password.value !== passwordConfirm.value) {
            passwordConfirm.setErrors({ passwordMismatch: true });
            return { passwordMismatch: true };
        }

        // Clear the error if passwords match
        if (passwordConfirm.hasError('passwordMismatch')) {
            passwordConfirm.setErrors(null);
        }

        return null;
    }

    submitForm(): void {
        if (this.form.valid) {
            const { email, displayName, password, marketingConsentAccepted } =
                this.form.getRawValue();
            this.registerSubmit.emit({
                email,
                displayName,
                password,
                marketingConsentAccepted,
            });
        } else {
            this.form.markAllAsTouched();
        }
    }

    handleGoogleRegistration(): void {
        this.registerWithGoogle.emit();
    }

    getEmailErrorMessage(): string {
        const control = this.form.controls.email;
        if (control.hasError('required')) {
            return 'Email jest wymagany';
        }
        if (control.hasError('email')) {
            return 'Niepoprawny format adresu email';
        }
        return '';
    }

    getDisplayNameErrorMessage(): string {
        const control = this.form.controls.displayName;
        if (control.hasError('required')) {
            return 'Nazwa wyświetlana jest wymagana';
        }
        if (control.hasError('minlength')) {
            return 'Nazwa musi mieć minimum 3 znaki';
        }
        return '';
    }

    getPasswordErrorMessage(): string {
        const control = this.form.controls.password;
        if (control.hasError('required')) {
            return 'Hasło jest wymagane';
        }
        if (control.hasError('minlength')) {
            return 'Hasło musi mieć minimum 8 znaków';
        }
        return '';
    }

    getPasswordConfirmErrorMessage(): string {
        const control = this.form.controls.passwordConfirm;
        if (control.hasError('required')) {
            return 'Potwierdzenie hasła jest wymagane';
        }
        if (control.hasError('passwordMismatch')) {
            return 'Hasła muszą być identyczne';
        }
        return '';
    }
}
