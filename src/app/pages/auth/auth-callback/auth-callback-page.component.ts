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
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileSettingsApiService } from '../../../core/services/profile-settings-api.service';

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
    private readonly profileSettingsApi = inject(ProfileSettingsApiService);

    state = signal<AuthCallbackState>({
        isLoading: true,
        error: null,
    });

    ngOnInit(): void {
        this.processCallback();
    }

    private async processCallback(): Promise<void> {
        const type = this.route.snapshot.queryParamMap.get('type');
        if (type === 'email') {
            await this.processEmailConfirmationCallback();
            return;
        }

        await this.processOAuthCallback();
    }

    private async processEmailConfirmationCallback(): Promise<void> {
        try {
            const errorCode = this.route.snapshot.queryParamMap.get('error_code');
            const errorDescription = this.route.snapshot.queryParamMap.get('error_description');

            if (errorCode || errorDescription) {
                console.error('Auth callback error:', errorCode, errorDescription);
                this.redirectToEmailConfirmationError();
                return;
            }

            const code = this.route.snapshot.queryParamMap.get('code');
            if (code) {
                const result = await this.authService.exchangeCodeForSession(code);

                if (result.success) {
                    await this.handleEmailConfirmationSuccess();
                    return;
                }
            }

            const session = await this.authService.getSession();

            if (session.data.session) {
                await this.handleEmailConfirmationSuccess();
                return;
            }

            this.redirectToEmailConfirmationError();
        } catch {
            this.redirectToEmailConfirmationError();
        }
    }

    private async processOAuthCallback(): Promise<void> {
        const errorCode =
            this.route.snapshot.queryParamMap.get('error_code') ??
            this.route.snapshot.queryParamMap.get('error');
        const errorDescription = this.route.snapshot.queryParamMap.get('error_description');

        if (errorCode === 'access_denied') {
            this.redirectToOAuthError('access_denied');
            return;
        }

        if (errorCode || errorDescription) {
            this.redirectToOAuthError('oauth_error');
            return;
        }

        try {
            const code = this.route.snapshot.queryParamMap.get('code');
            if (code) {
                const result = await this.authService.exchangeCodeForSession(code);
                if (!result.success) {
                    this.redirectToOAuthError('timeout');
                    return;
                }

                await this.handleOAuthSuccess();
                return;
            }

            const session = await this.authService.getSession();
            if (!session.data.session) {
                this.redirectToOAuthError('oauth_error');
                return;
            }

            await this.handleOAuthSuccess();
        } catch {
            this.redirectToOAuthError('timeout');
        }
    }

    private async handleEmailConfirmationSuccess(): Promise<void> {
        await this.authService.signOut();
        this.router.navigate(['/email-confirmed']);
    }

    private async handleOAuthSuccess(): Promise<void> {
        try {
            const profile = await firstValueFrom(
                this.profileSettingsApi.getProfileSettings()
            );
            const target = profile.username.trim()
                ? '/dashboard'
                : '/auth/complete-profile';
            this.router.navigate([target]);
        } catch {
            this.redirectToOAuthError('profile_error');
        }
    }

    private redirectToEmailConfirmationError(): void {
        this.router.navigate(['/email-confirmation-invalid']);
    }

    private redirectToOAuthError(
        error: 'access_denied' | 'oauth_error' | 'timeout' | 'profile_error'
    ): void {
        this.router.navigate(['/login'], { queryParams: { error } });
    }
}



