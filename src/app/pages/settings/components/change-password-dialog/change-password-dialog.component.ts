import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
    AbstractControl,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, finalize, take } from 'rxjs';
import {
    ApiError,
    ChangePasswordCommand,
    ChangePasswordResponseDto,
} from '../../../../../../shared/contracts/types';

export interface ChangePasswordDialogData {
    changePassword: (
        command: ChangePasswordCommand
    ) => Observable<ChangePasswordResponseDto>;
}

interface ChangePasswordFormModel {
    currentPassword: FormControl<string>;
    newPassword: FormControl<string>;
    confirmNewPassword: FormControl<string>;
}

@Component({
    selector: 'pych-change-password-dialog',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
    ],
    templateUrl: './change-password-dialog.component.html',
    styleUrl: './change-password-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordDialogComponent {
    private readonly dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent>);
    private readonly data = inject<ChangePasswordDialogData>(MAT_DIALOG_DATA);

    isSubmitting = false;
    submitError: string | null = null;

    readonly form = new FormGroup<ChangePasswordFormModel>(
        {
            currentPassword: new FormControl('', {
                nonNullable: true,
                validators: [Validators.required],
            }),
            newPassword: new FormControl('', {
                nonNullable: true,
                validators: [Validators.required, Validators.minLength(6)],
            }),
            confirmNewPassword: new FormControl('', {
                nonNullable: true,
                validators: [Validators.required],
            }),
        },
        { validators: [this.passwordsMatchValidator, this.passwordsDifferValidator] }
    );

    onCancel(): void {
        if (this.isSubmitting) {
            return;
        }

        this.dialogRef.close(false);
    }

    onSubmit(): void {
        if (this.isSubmitting || this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { currentPassword, newPassword } = this.form.getRawValue();
        this.submitError = null;
        this.isSubmitting = true;

        this.buildSubmitObservable({
            current_password: currentPassword,
            new_password: newPassword,
        })
            .pipe(
                take(1),
                finalize(() => (this.isSubmitting = false))
            )
            .subscribe({
                next: () => {
                    this.dialogRef.close(true);
                },
                error: (error: ApiError) => {
                    this.applyApiError(error);
                },
            });
    }

    getCurrentPasswordErrorMessage(): string {
        const control = this.form.controls.currentPassword;
        if (control.hasError('required')) {
            return 'Podaj aktualne hasło.';
        }

        if (control.hasError('incorrectCurrentPassword')) {
            return 'Podane stare hasło jest niepoprawne.';
        }

        return '';
    }

    getNewPasswordErrorMessage(): string {
        const control = this.form.controls.newPassword;
        if (control.hasError('required')) {
            return 'Podaj nowe hasło.';
        }

        if (control.hasError('minlength')) {
            return 'Nowe hasło musi mieć co najmniej 6 znaków.';
        }

        if (this.form.hasError('sameAsCurrent')) {
            return 'Nowe hasło nie może być takie samo jak obecne.';
        }

        return '';
    }

    getConfirmPasswordErrorMessage(): string {
        const control = this.form.controls.confirmNewPassword;
        if (control.hasError('required')) {
            return 'Potwierdź nowe hasło.';
        }

        if (this.form.hasError('passwordMismatch')) {
            return 'Hasła muszą być identyczne.';
        }

        return '';
    }

    private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
        const newPassword = control.get('newPassword')?.value;
        const confirm = control.get('confirmNewPassword')?.value;

        if (typeof newPassword !== 'string' || typeof confirm !== 'string') {
            return null;
        }

        return newPassword === confirm ? null : { passwordMismatch: true };
    }

    private passwordsDifferValidator(control: AbstractControl): ValidationErrors | null {
        const current = control.get('currentPassword')?.value;
        const next = control.get('newPassword')?.value;

        if (typeof current !== 'string' || typeof next !== 'string') {
            return null;
        }

        return current !== next ? null : { sameAsCurrent: true };
    }

    private applyApiError(error: ApiError): void {
        if (error.status === 422) {
            this.form.controls.currentPassword.setErrors({
                ...(this.form.controls.currentPassword.errors ?? {}),
                incorrectCurrentPassword: true,
            });
        }

        this.submitError = error.message;
    }

    private buildSubmitObservable(command: ChangePasswordCommand) {
        return this.data.changePassword(command);
    }
}
