import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
    AuthService,
    RESEND_COOLDOWN_SECONDS,
} from '../../../core/services/auth.service';

interface VerifySentState {
    email: string | null;
    isResending: boolean;
    cooldownRemainingSeconds: number;
    error: string | null;
}

@Component({
    selector: 'pych-register-verify-sent-page',
    standalone: true,
    imports: [
        RouterLink,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
    ],
    templateUrl: './register-verify-sent-page.component.html',
    styleUrl: './register-verify-sent-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterVerifySentPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly destroyRef = inject(DestroyRef);

    private cooldownIntervalId: ReturnType<typeof setInterval> | null = null;

    state = signal<VerifySentState>({
        email: null,
        isResending: false,
        cooldownRemainingSeconds: 0,
        error: null,
    });

    /** Computed: czy przycisk resend jest wyłączony */
    get isResendDisabled(): boolean {
        const s = this.state();
        return s.isResending || s.cooldownRemainingSeconds > 0 || !s.email;
    }

    ngOnInit(): void {
        const email = this.route.snapshot.queryParamMap.get('email');
        this.state.update((s) => ({ ...s, email }));

        // Cleanup interval on destroy
        this.destroyRef.onDestroy(() => {
            this.clearCooldownInterval();
        });
    }

    async resendVerification(): Promise<void> {
        const email = this.state().email;
        if (!email) {
            return;
        }

        this.state.update((s) => ({ ...s, isResending: true, error: null }));

        try {
            const callbackUrl = `${window.location.origin}/auth/callback`;
            const result = await this.authService.resendVerificationEmail(
                email,
                callbackUrl
            );

            if (result.success) {
                this.snackBar.open(
                    'Wysłaliśmy nowy link aktywacyjny na Twój adres e-mail.',
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

    navigateToChangeEmail(): void {
        const email = this.state().email;
        this.router.navigate(['/register'], {
            queryParams: email ? { email } : {},
        });
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



