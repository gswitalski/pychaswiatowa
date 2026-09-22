import {
    ChangeDetectionStrategy,
    Component,
    inject,
    signal,
    ViewChild,
} from '@angular/core';
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
import { catchError, finalize, forkJoin, map, Observable, of, take } from 'rxjs';
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
    @ViewChild(AdminUserAiCreditsFormComponent)
    private creditsForm?: AdminUserAiCreditsFormComponent;

    private readonly dialogRef = inject(MatDialogRef<ChangeUserRoleDialogComponent>);
    private readonly data = inject<ChangeUserRoleDialogData>(MAT_DIALOG_DATA);
    private readonly router = inject(Router);
    private readonly snackBar = inject(MatSnackBar);
    private readonly adminApi = inject(AdminApiService);

    readonly roleOptions = ROLE_OPTIONS;
    readonly currentRoleLabel: string;
    readonly editedUserId = this.data.user.id;
    private savedRole = this.data.user.role;
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

        const roleChanged = this.form.controls.appRole.value !== this.savedRole;
        const creditsChanged = this.creditsForm?.form.dirty ?? false;
        const creditsInvalid = creditsChanged && (this.creditsForm?.form.invalid ?? false);

        return (!roleChanged && !creditsChanged) || creditsInvalid;
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
        const roleChanged = appRole !== this.savedRole;
        const creditsChanged = this.creditsForm?.form.dirty ?? false;

        if (creditsChanged && !this.creditsForm?.validate()) {
            return;
        }

        this.submitError = null;
        this.isSubmitting = true;
        this.form.disable({ emitEvent: false });
        this.creditsForm?.setSubmitting(true);

        const roleUpdate$ = roleChanged
            ? this.data.updateUserRole(this.data.user.id, appRole).pipe(
                  map((response) => ({ response, error: null })),
                  catchError((error: Error & { status?: number }) =>
                      of({ response: null, error })
                  )
              )
            : of({ response: null, error: null });

        const creditsUpdate$ = creditsChanged
            ? this.adminApi
                  .updateUserAiCredits(
                      this.data.user.id,
                      this.creditsForm!.createCommand()
                  )
                  .pipe(
                      map((response) => ({ response, error: null })),
                      catchError((error: Error & { status?: number }) =>
                          of({ response: null, error })
                      )
                  )
            : of({ response: null, error: null });

        forkJoin({ role: roleUpdate$, credits: creditsUpdate$ })
            .pipe(
                take(1),
                finalize(() => {
                    this.isSubmitting = false;
                    this.form.enable({ emitEvent: false });
                    this.creditsForm?.setSubmitting(false);
                })
            )
            .subscribe({
                next: ({ role, credits }) => {
                    if (role.response) {
                        this.savedRole = appRole;
                    }

                    if (credits.response) {
                        this.aiCredits.set(credits.response);
                        this.creditsForm?.applySavedCredits(credits.response);
                    }

                    if (role.error) {
                        this.handleSubmitError(role.error);
                    }

                    if (credits.error) {
                        this.handleCreditsSubmitError(credits.error);
                    }

                    if (role.error || credits.error) {
                        return;
                    }

                    this.dialogRef.close(role.response ?? undefined);
                },
            });
    }

    onResetCredits(): void {
        if (this.isSubmitting) {
            return;
        }

        this.creditsForm?.resetCredits();
    }

    retryCreditsLoad(): void {
        this.loadCredits();
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

    private handleCreditsSubmitError(error: Error & { status?: number }): void {
        if (error.status === 400) {
            this.creditsForm?.setApiError(
                error.message || 'Sprawdź poprawność wprowadzonych danych.'
            );
            return;
        }

        if (error.status === 403) {
            this.snackBar.open('Brak uprawnień do edycji kredytów.', 'Zamknij', {
                duration: 5000,
            });
            return;
        }

        if (error.status === 404) {
            this.snackBar.open('Użytkownik nie istnieje.', 'Zamknij', {
                duration: 5000,
            });
            this.onCreditsUserNotFound();
            return;
        }

        this.creditsForm?.setApiError(
            error.message || 'Nie udało się zapisać kredytów. Spróbuj ponownie.'
        );
    }
}
