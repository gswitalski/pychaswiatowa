import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LoginFormComponent } from './components/login-form/login-form.component';
import { AuthService } from '../../core/services/auth.service';
import { SignInRequestDto } from '../../../../shared/contracts/types';

interface LoginState {
    isLoading: boolean;
    error: string | null;
}

@Component({
    selector: 'pych-login-page',
    standalone: true,
    imports: [LoginFormComponent],
    templateUrl: './login-page.component.html',
    styleUrl: './login-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    state = signal<LoginState>({
        isLoading: false,
        error: null,
    });

    async handleLogin(credentials: SignInRequestDto): Promise<void> {
        this.state.update((s) => ({ ...s, isLoading: true, error: null }));

        try {
            await this.authService.signIn(credentials.email, credentials.password);
            this.router.navigate(['/dashboard']);
        } catch (error) {
            const errorMessage = this.parseError(error);
            this.state.update((s) => ({ ...s, error: errorMessage }));
        } finally {
            this.state.update((s) => ({ ...s, isLoading: false }));
        }
    }

    private parseError(error: unknown): string {
        if (error && typeof error === 'object' && 'message' in error) {
            const err = error as { message: string };
            return this.translateErrorMessage(err.message);
        }

        return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie później.';
    }

    private translateErrorMessage(message: string): string {
        const errorMessages: Record<string, string> = {
            'Invalid login credentials': 'Nieprawidłowy e-mail lub hasło.',
            'Email not confirmed': 'Adres e-mail nie został potwierdzony.',
            'Invalid email or password': 'Nieprawidłowy e-mail lub hasło.',
        };

        return errorMessages[message] ?? message;
    }
}

