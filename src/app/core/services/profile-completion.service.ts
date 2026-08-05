import { effect, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ProfileSettingsApiService } from './profile-settings-api.service';

export type ProfileCompletionStatus =
    | 'unknown'
    | 'checking'
    | 'complete'
    | 'incomplete';

@Injectable({
    providedIn: 'root',
})
export class ProfileCompletionService {
    private readonly profileSettingsApi = inject(ProfileSettingsApiService);
    private readonly authService = inject(AuthService);

    public readonly status = signal<ProfileCompletionStatus>('unknown');

    constructor() {
        effect(() => {
            this.authService.userId();
            this.status.set('unknown');
        });
    }

    public async ensureChecked(): Promise<boolean> {
        if (this.status() === 'complete') {
            return true;
        }

        if (this.status() === 'incomplete') {
            return false;
        }

        this.status.set('checking');
        try {
            const profile = await firstValueFrom(
                this.profileSettingsApi.getProfileSettings()
            );
            const isComplete = profile.username.trim().length > 0;
            this.status.set(isComplete ? 'complete' : 'incomplete');
            return isComplete;
        } catch {
            this.status.set('incomplete');
            return false;
        }
    }

    public markComplete(): void {
        this.status.set('complete');
    }
}
