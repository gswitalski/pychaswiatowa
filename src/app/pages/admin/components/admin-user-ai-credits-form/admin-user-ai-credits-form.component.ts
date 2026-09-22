import {
    ChangeDetectionStrategy,
    Component,
    effect,
    input,
    signal,
} from '@angular/core';
import {
    AbstractControl,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import {
    UpdateAdminUserAiCreditsCommand,
    UpdateAdminUserAiCreditsResponseDto,
} from '../../../../../../shared/contracts/types';

type EditableLimitType = 'lifetime' | 'monthly';

interface AdminUserAiCreditsFormModel {
    limitType: FormControl<EditableLimitType>;
    draftTotal: FormControl<number>;
    draftUsed: FormControl<number>;
    imageTotal: FormControl<number>;
    imageUsed: FormControl<number>;
    nextResetAt: FormControl<string>;
}

function creditsValidator(control: AbstractControl): ValidationErrors | null {
    const draftTotal = control.get('draftTotal')?.value as number | undefined;
    const draftUsed = control.get('draftUsed')?.value as number | undefined;
    const imageTotal = control.get('imageTotal')?.value as number | undefined;
    const imageUsed = control.get('imageUsed')?.value as number | undefined;
    const limitType = control.get('limitType')?.value as EditableLimitType | undefined;
    const nextResetAt = control.get('nextResetAt')?.value as string | undefined;
    const errors: ValidationErrors = {};

    if (
        draftTotal !== undefined &&
        draftUsed !== undefined &&
        draftUsed > draftTotal
    ) {
        errors['draftUsedExceedsTotal'] = true;
    }

    if (
        imageTotal !== undefined &&
        imageUsed !== undefined &&
        imageUsed > imageTotal
    ) {
        errors['imageUsedExceedsTotal'] = true;
    }

    if (limitType === 'monthly') {
        if (!nextResetAt) {
            errors['nextResetRequired'] = true;
        } else {
            const resetDate = new Date(`${nextResetAt}T23:59:59`);
            if (Number.isNaN(resetDate.getTime()) || resetDate <= new Date()) {
                errors['nextResetNotFuture'] = true;
            }
        }
    }

    return Object.keys(errors).length > 0 ? errors : null;
}

@Component({
    selector: 'pych-admin-user-ai-credits-form',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
    ],
    templateUrl: './admin-user-ai-credits-form.component.html',
    styleUrl: './admin-user-ai-credits-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserAiCreditsFormComponent {
    readonly userId = input.required<string>();
    readonly initialCredits = input<UpdateAdminUserAiCreditsResponseDto | null>(null);

    protected readonly apiError = signal<string | null>(null);
    protected readonly isUnlimited = signal(false);

    readonly form = new FormGroup<AdminUserAiCreditsFormModel>(
        {
            limitType: new FormControl<EditableLimitType>('lifetime', {
                nonNullable: true,
                validators: [Validators.required],
            }),
            draftTotal: this.createCreditControl(),
            draftUsed: this.createCreditControl(),
            imageTotal: this.createCreditControl(),
            imageUsed: this.createCreditControl(),
            nextResetAt: new FormControl('', { nonNullable: true }),
        },
        { validators: [creditsValidator] }
    );

    constructor() {
        effect(() => {
            const credits = this.initialCredits();

            if (!credits) {
                this.form.disable({ emitEvent: false });
                return;
            }

            if (credits.limit_type === 'unlimited') {
                this.isUnlimited.set(true);
                this.form.disable({ emitEvent: false });
                return;
            }

            this.isUnlimited.set(false);
            this.applyCredits(credits);
            this.form.enable({ emitEvent: false });
            this.form.markAsPristine();
        });
    }

    validate(): boolean {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return false;
        }

        const userId = this.userId().trim();
        if (!userId) {
            this.apiError.set('Brak identyfikatora użytkownika.');
            return false;
        }

        return true;
    }

    resetCredits(): void {
        if (this.form.disabled) {
            return;
        }

        this.form.patchValue({
            draftUsed: 0,
            imageUsed: 0,
        });
        this.form.markAsDirty();
    }

    createCommand(): UpdateAdminUserAiCreditsCommand {
        const value = this.form.getRawValue();

        return {
            limit_type: value.limitType,
            draft_credits_total: value.draftTotal,
            draft_credits_used: value.draftUsed,
            image_credits_total: value.imageTotal,
            image_credits_used: value.imageUsed,
            next_reset_at:
                value.limitType === 'monthly' && value.nextResetAt
                    ? new Date(`${value.nextResetAt}T00:00:00`).toISOString()
                    : null,
        };
    }

    setSubmitting(isSubmitting: boolean): void {
        if (isSubmitting) {
            this.form.disable({ emitEvent: false });
            return;
        }

        if (!this.isUnlimited()) {
            this.form.enable({ emitEvent: false });
        }
    }

    applySavedCredits(credits: UpdateAdminUserAiCreditsResponseDto): void {
        this.applyCredits(credits);
        this.form.markAsPristine();
        this.apiError.set(null);
    }

    setApiError(message: string): void {
        this.apiError.set(message);
    }

    private applyCredits(credits: UpdateAdminUserAiCreditsResponseDto): void {
        if (credits.limit_type === 'unlimited') {
            return;
        }

        this.form.patchValue(
            {
                limitType: credits.limit_type,
                draftTotal: credits.draft.total ?? 0,
                draftUsed: credits.draft.used ?? 0,
                imageTotal: credits.image.total ?? 0,
                imageUsed: credits.image.used ?? 0,
                nextResetAt: credits.next_reset_at
                    ? credits.next_reset_at.slice(0, 10)
                    : '',
            },
            { emitEvent: false }
        );
        this.form.updateValueAndValidity({ emitEvent: false });
    }

    private createCreditControl(): FormControl<number> {
        return new FormControl(0, {
            nonNullable: true,
            validators: [
                Validators.required,
                Validators.min(0),
                Validators.max(9999),
                Validators.pattern(/^\d+$/),
            ],
        });
    }
}
