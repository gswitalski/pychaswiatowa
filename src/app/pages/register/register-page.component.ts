import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RegisterFormComponent } from './components/register-form/register-form.component';
import { AuthService } from '../../core/services/auth.service';
import { ApiError } from '../../../../shared/contracts/types';

interface RegisterState {
    isLoading: boolean;
    error: ApiError | null;
}

@Component({
    selector: 'stbo-register-page',
    standalone: true,
    imports: [RegisterFormComponent],
    templateUrl: './register-page.component.html',
    styleUrl: './register-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    state = signal<RegisterState>({
        isLoading: false,
        error: null,
    });

    async onRegisterSubmit(formData: {
        email: string;
        displayName: string;
        password: string;
    }): Promise<void> {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        try {
            await this.authService.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        username: formData.displayName,
                    },
                },
            });

            this.router.navigate(['/dashboard']);
        } catch (error) {
            const apiError = this.parseError(error);
            this.state.update((s) => ({ ...s, error: apiError }));
        } finally {
            this.state.update((s) => ({ ...s, isLoading: false }));
        }
    }

    private parseError(error: unknown): ApiError {
        if (error && typeof error === 'object' && 'message' in error) {
            const err = error as { message: string; status?: number };
            return {
                message: this.translateErrorMessage(err.message),
                status: err.status ?? 500,
            };
        }

        return {
            message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
            status: 500,
        };
    }

    private translateErrorMessage(message: string): string {
        const errorMessages: Record<string, string> = {
            'User already registered':
                'Użytkownik o tym adresie e-mail już istnieje.',
            'Invalid email': 'Niepoprawny adres e-mail.',
            'Password should be at least 6 characters':
                'Hasło musi mieć co najmniej 6 znaków.',
        };

        return errorMessages[message] ?? message;
    }
}
