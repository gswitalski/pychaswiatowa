import { Injectable, computed, signal } from '@angular/core';

import type { MeDto, ProfileSettingsDto } from '../../../../shared/contracts/types';

@Injectable({
    providedIn: 'root',
})
export class CurrentUserStateService {
    private activeUserId: string | null = null;
    private readonly usernameState = signal<string | null>(null);

    readonly username = this.usernameState.asReadonly();
    readonly displayName = computed(() => this.usernameState()?.trim() || null);

    switchUser(userId: string | null): void {
        if (userId === this.activeUserId) {
            return;
        }

        this.activeUserId = userId;
        this.usernameState.set(null);
    }

    applyMe(me: Pick<MeDto, 'id' | 'username'>): void {
        this.applyUsername(me.id, me.username);
    }

    applyProfile(profile: Pick<ProfileSettingsDto, 'id' | 'username'>): void {
        this.applyUsername(profile.id, profile.username);
    }

    private applyUsername(userId: string, username: unknown): void {
        if (this.activeUserId === null || userId !== this.activeUserId) {
            return;
        }

        if (typeof username !== 'string') {
            return;
        }

        this.usernameState.set(username);
    }
}
