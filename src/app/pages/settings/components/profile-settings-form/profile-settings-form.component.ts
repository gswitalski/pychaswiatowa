import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
} from '@angular/core';
import {
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ProfileSettingsDto } from '../../../../../../shared/contracts/types';

export interface ProfileSettingsFormValue {
    email: string;
    username: string;
    marketingConsent: boolean;
}

interface ProfileSettingsFormModel {
    email: FormControl<string>;
    username: FormControl<string>;
    marketingConsent: FormControl<boolean>;
}

@Component({
    selector: 'pych-profile-settings-form',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatCheckboxModule,
        MatButtonModule,
    ],
    templateUrl: './profile-settings-form.component.html',
    styleUrl: './profile-settings-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSettingsFormComponent implements OnChanges {
    @Input() profile: ProfileSettingsDto | null = null;
    @Input() isLoading = false;
    @Input() isSaving = false;
    @Input() submitError: string | null = null;
    @Input() submitErrorStatus: number | null = null;
    @Input() saveLabel = 'Zapisz zmiany';

    @Output() saveProfile = new EventEmitter<ProfileSettingsFormValue>();

    readonly form = new FormGroup<ProfileSettingsFormModel>({
        email: new FormControl('', { nonNullable: true }),
        username: new FormControl('', {
            nonNullable: true,
            validators: [
                Validators.required,
                Validators.minLength(3),
                Validators.maxLength(50),
            ],
        }),
        marketingConsent: new FormControl(false, { nonNullable: true }),
    });

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['profile']) {
            this.resetFormFromProfile();
        }

        if (changes['submitErrorStatus']) {
            this.applyServerValidationError();
        }
    }

    submitForm(): void {
        if (this.isLoading || this.isSaving || !this.form.valid || !this.form.dirty) {
            this.form.markAllAsTouched();
            return;
        }

        const { email, username, marketingConsent } = this.form.getRawValue();
        this.saveProfile.emit({
            email,
            username: username.trim(),
            marketingConsent,
        });
    }

    getUsernameErrorMessage(): string {
        const control = this.form.controls.username;
        if (control.hasError('required')) {
            return 'Nazwa użytkownika jest wymagana.';
        }

        if (control.hasError('minlength')) {
            return 'Nazwa użytkownika musi mieć co najmniej 3 znaki.';
        }

        if (control.hasError('maxlength')) {
            return 'Nazwa użytkownika może mieć maksymalnie 50 znaków.';
        }

        if (control.hasError('serverConflict')) {
            return 'Ta nazwa użytkownika jest już zajęta.';
        }

        return '';
    }

    private resetFormFromProfile(): void {
        if (!this.profile) {
            return;
        }

        this.form.reset(
            {
                email: this.profile.email,
                username: this.profile.username,
                marketingConsent: this.profile.marketing_consent,
            },
            { emitEvent: false }
        );
    }

    private applyServerValidationError(): void {
        if (this.submitErrorStatus !== 409) {
            return;
        }

        const usernameControl = this.form.controls.username;
        usernameControl.setErrors({
            ...(usernameControl.errors ?? {}),
            serverConflict: true,
        });
        usernameControl.markAsTouched();
    }
}
