import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
    FormControl,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
    AuthService,
    RESEND_COOLDOWN_SECONDS,
} from '../../../core/services/auth.service';

interface EmailConfirmationInvalidState {
    isResending: boolean;
    cooldownRemainingSeconds: number;
    error: string | null;
    successMessage: string | null;
}

@Component({
    selector: 'pych-email-confirmation-invalid-page',
    standalone: true,
    imports: [
        RouterLink,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
    ],
    templateUrl: './email-confirmation-invalid-page.component.html',
    styleUrl: './email-confirmation-invalid-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailConfirmationInvalidPageComponent {
    private readonly authService = inject(AuthService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    private cooldownIntervalId: ReturnType<typeof setInterval> | null = null;

    emailControl = new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
    });

    state = signal<EmailConfirmationInvalidState>({
        isResending: false,
        cooldownRemainingSeconds: 0,
        error: null,
        successMessage: null,
    });

    constructor() {
        this.destroyRef.onDestroy(() => {
            this.clearCooldownInterval();
        });
    }

    /** Computed: czy przycisk resend jest wyłączony */
    get isResendDisabled(): boolean {
        const s = this.state();
        return (
            s.isResending ||
            s.cooldownRemainingSeconds > 0 ||
            this.emailControl.invalid
        );
    }

    async resendVerification(): Promise<void> {
        if (this.emailControl.invalid) {
            this.emailControl.markAsTouched();
            return;
        }

        const email = this.emailControl.value;
        this.state.update((s) => ({
            ...s,
            isResending: true,
            error: null,
            successMessage: null,
        }));

        try {
            const callbackUrl = `${window.location.origin}/auth/callback`;
            const result = await this.authService.resendVerificationEmail(
                email,
                callbackUrl
            );

            if (result.success) {
                this.snackBar.open(
                    'Jeśli konto istnieje i wymaga aktywacji, wyślemy nowy link.',
                    'OK',
                    { duration: 5000 }
                );
                this.startCooldown();
            } else {
                this.state.update((s) => ({
                    ...s,
                    error: result.error ?? 'Nie udało się wysłać e-maila.',
                }));
            }
        } catch {
            this.state.update((s) => ({
                ...s,
                error: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
            }));
        } finally {
            this.state.update((s) => ({ ...s, isResending: false }));
        }
    }

    getEmailErrorMessage(): string {
        if (this.emailControl.hasError('required')) {
            return 'Adres e-mail jest wymagany';
        }
        if (this.emailControl.hasError('email')) {
            return 'Niepoprawny format adresu e-mail';
        }
        return '';
    }

    private startCooldown(): void {
        this.clearCooldownInterval();

        this.state.update((s) => ({
            ...s,
            cooldownRemainingSeconds: RESEND_COOLDOWN_SECONDS,
        }));

        this.cooldownIntervalId = setInterval(() => {
            this.state.update((s) => {
                const remaining = s.cooldownRemainingSeconds - 1;
                if (remaining <= 0) {
                    this.clearCooldownInterval();
                    return { ...s, cooldownRemainingSeconds: 0 };
                }
                return { ...s, cooldownRemainingSeconds: remaining };
            });
        }, 1000);
    }

    private clearCooldownInterval(): void {
        if (this.cooldownIntervalId !== null) {
            clearInterval(this.cooldownIntervalId);
            this.cooldownIntervalId = null;
        }
    }
}



