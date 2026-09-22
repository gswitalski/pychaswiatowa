import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { finalize, Observable, take } from 'rxjs';
import {
    AppRole,
    UpdateAdminUserAiCreditsResponseDto,
    UpdateAdminUserRoleResponseDto,
} from '../../../../../shared/contracts/types';
import { AdminUsersTableRowVm } from './admin-users.models';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { AdminUserAiCreditsFormComponent } from '../components/admin-user-ai-credits-form/admin-user-ai-credits-form.component';

export interface ChangeUserRoleDialogData {
    user: AdminUsersTableRowVm;
    updateUserRole: (
        userId: string,
        appRole: AppRole
    ) => Observable<UpdateAdminUserRoleResponseDto>;
}

export type ChangeUserRoleDialogCloseResult =
    | UpdateAdminUserRoleResponseDto
    | 'USER_NOT_FOUND';

interface ChangeUserRoleFormModel {
    appRole: FormControl<AppRole>;
}

const ROLE_OPTIONS: readonly { value: AppRole; label: string }[] = [
    { value: 'user', label: 'Użytkownik' },
    { value: 'premium', label: 'Premium' },
    { value: 'admin', label: 'Administrator' },
];

@Component({
    selector: 'pych-change-user-role-dialog',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        AdminUserAiCreditsFormComponent,
    ],
    templateUrl: './change-user-role-dialog.component.html',
    styleUrl: './change-user-role-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangeUserRoleDialogComponent {
    private readonly dialogRef = inject(MatDialogRef<ChangeUserRoleDialogComponent>);
    private readonly data = inject<ChangeUserRoleDialogData>(MAT_DIALOG_DATA);
    private readonly router = inject(Router);
    private readonly snackBar = inject(MatSnackBar);
    private readonly adminApi = inject(AdminApiService);

    readonly roleOptions = ROLE_OPTIONS;
    readonly currentRoleLabel: string;
    readonly editedUserId = this.data.user.id;
    isSubmitting = false;
    submitError: string | null = null;
    readonly aiCredits = signal<UpdateAdminUserAiCreditsResponseDto | null>(null);
    readonly creditsLoading = signal(true);
    readonly creditsLoadError = signal<string | null>(null);

    readonly form = new FormGroup<ChangeUserRoleFormModel>({
        appRole: new FormControl(this.data.user.role, {
            nonNullable: true,
            validators: [Validators.required],
        }),
    });

    constructor() {
        this.currentRoleLabel = this.data.user.roleLabel;
        this.loadCredits();
    }

    get userContextLabel(): string {
        const username = this.data.user.username?.trim();
        const login = this.data.user.login?.trim();
        if (username && login && username !== login) {
            return `${username} (${login})`;
        }
        return username || login || this.data.user.displayId;
    }

    get isSaveDisabled(): boolean {
        if (this.isSubmitting) {
            return true;
        }

        return this.form.controls.appRole.value === this.data.user.role;
    }

    onCancel(): void {
        if (this.isSubmitting) {
            return;
        }

        this.dialogRef.close(undefined);
    }

    onSubmit(): void {
        if (this.isSubmitting || this.isSaveDisabled) {
            return;
        }

        const appRole = this.form.controls.appRole.value;
        this.submitError = null;
        this.isSubmitting = true;
        this.form.disable({ emitEvent: false });

        this.data
            .updateUserRole(this.data.user.id, appRole)
            .pipe(
                take(1),
                finalize(() => {
                    this.isSubmitting = false;
                })
            )
            .subscribe({
                next: (response) => {
                    this.dialogRef.close(response);
                },
                error: (error: Error & { status?: number }) => {
                    this.form.enable({ emitEvent: false });
                    this.handleSubmitError(error);
                },
            });
    }

    retryCreditsLoad(): void {
        this.loadCredits();
    }

    onCreditsSaved(credits: UpdateAdminUserAiCreditsResponseDto): void {
        this.aiCredits.set(credits);
    }

    onCreditsUserNotFound(): void {
        this.dialogRef.close('USER_NOT_FOUND' satisfies ChangeUserRoleDialogCloseResult);
    }

    private loadCredits(): void {
        this.creditsLoading.set(true);
        this.creditsLoadError.set(null);

        this.adminApi.getUserAiCredits(this.data.user.id).pipe(take(1)).subscribe({
            next: (credits) => {
                this.aiCredits.set(credits);
                this.creditsLoading.set(false);
            },
            error: (error: Error & { status?: number }) => {
                this.creditsLoading.set(false);

                if (error.status === 404) {
                    this.onCreditsUserNotFound();
                    return;
                }

                this.creditsLoadError.set(
                    error.message || 'Nie udało się pobrać kredytów AI.'
                );
            },
        });
    }

    private handleSubmitError(error: Error & { status?: number }): void {
        const status = error.status ?? 500;

        if (status === 400) {
            this.form.controls.appRole.setErrors({
                ...(this.form.controls.appRole.errors ?? {}),
                invalidRole: true,
            });
            this.form.controls.appRole.markAsTouched();
            return;
        }

        if (status === 401) {
            this.dialogRef.close(undefined);
            this.router.navigate(['/login'], {
                queryParams: { returnUrl: '/admin/users' },
            });
            return;
        }

        if (status === 403) {
            this.dialogRef.close(undefined);
            this.snackBar.open('Brak uprawnień do zmiany roli użytkownika.', 'Zamknij', {
                duration: 5000,
            });
            this.router.navigate(['/forbidden']);
            return;
        }

        if (status === 404) {
            this.dialogRef.close('USER_NOT_FOUND' satisfies ChangeUserRoleDialogCloseResult);
            return;
        }

        if (status === 409) {
            this.submitError =
                error.message ||
                'Nie można wykonać tej zmiany roli (np. własne konto lub ostatni administrator).';
            return;
        }

        this.submitError =
            error.message || 'Nie udało się zapisać zmiany roli. Spróbuj ponownie później.';
    }
}
