import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoginFormViewModel, SignInRequestDto } from '../../../../../../shared/contracts/types';

@Component({
    selector: 'pych-login-form',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        RouterLink,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './login-form.component.html',
    styleUrl: './login-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginFormComponent {
    @Input() isLoading = false;
    @Input() apiError: string | null = null;

    @Output() login = new EventEmitter<SignInRequestDto>();

    form = new FormGroup<LoginFormViewModel>({
        email: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.email],
        }),
        password: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
    });

    submitForm(): void {
        if (this.form.valid) {
            const { email, password } = this.form.getRawValue();
            this.login.emit({ email, password });
        } else {
            this.form.markAllAsTouched();
        }
    }

    getEmailErrorMessage(): string {
        const control = this.form.controls.email;
        if (control.hasError('required')) {
            return 'To pole jest wymagane';
        }
        if (control.hasError('email')) {
            return 'Proszę podać poprawny adres e-mail';
        }
        return '';
    }

    getPasswordErrorMessage(): string {
        const control = this.form.controls.password;
        if (control.hasError('required')) {
            return 'To pole jest wymagane';
        }
        return '';
    }
}

