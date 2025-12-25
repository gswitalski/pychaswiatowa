import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

interface AuthCallbackState {
    isLoading: boolean;
    error: string | null;
}

@Component({
    selector: 'pych-auth-callback-page',
    standalone: true,
    imports: [MatCardModule, MatProgressSpinnerModule],
    templateUrl: './auth-callback-page.component.html',
    styleUrl: './auth-callback-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCallbackPageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly authService = inject(AuthService);

    state = signal<AuthCallbackState>({
        isLoading: true,
        error: null,
    });

    ngOnInit(): void {
        this.processCallback();
    }

    private async processCallback(): Promise<void> {
        try {
            // Pobierz code z query params (Supabase PKCE flow)
            const code = this.route.snapshot.queryParamMap.get('code');

            if (!code) {
                // Brak kodu w URL - przekieruj na stronę błędu
                this.redirectToError();
                return;
            }

            // Wymień code na sesję
            const result = await this.authService.exchangeCodeForSession(code);

            if (result.success) {
                // Sukces - wyloguj użytkownika (zgodnie z wymaganiem "bez auto-logowania po rejestracji")
                // i przekieruj na stronę sukcesu
                await this.authService.signOut();
                this.router.navigate(['/email-confirmed']);
            } else {
                this.redirectToError();
            }
        } catch {
            this.redirectToError();
        }
    }

    private redirectToError(): void {
        this.router.navigate(['/email-confirmation-invalid']);
    }
}



