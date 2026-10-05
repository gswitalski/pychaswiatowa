import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { MeDto } from '../../../../shared/contracts/types';
import type { SubscriptionSnapshot } from '../models/subscription.model';
import { MeApiService } from './me-api.service';

interface SubscriptionLoadingRequest {
    generation: number;
    promise: Promise<void>;
}

@Injectable({
    providedIn: 'root',
})
export class SubscriptionStateService {
    private readonly meApi = inject(MeApiService);
    private readonly snapshotState = signal<SubscriptionSnapshot | null>(null);
    private readonly refreshErrorStatusState = signal<number | null>(null);
    private loadingRequest: SubscriptionLoadingRequest | null = null;
    private generation = 0;

    readonly snapshot = this.snapshotState.asReadonly();
    readonly refreshErrorStatus = this.refreshErrorStatusState.asReadonly();
    readonly loaded = computed(() => this.snapshot() !== null);
    readonly status = computed(() => this.snapshot()?.status ?? null);
    readonly planId = computed(() => this.snapshot()?.planId ?? null);
    readonly currentPeriodEnd = computed(() => this.snapshot()?.currentPeriodEnd ?? null);
    readonly autoRenew = computed(() => this.snapshot()?.autoRenew ?? null);
    readonly trialEndsAt = computed(() => this.snapshot()?.trialEndsAt ?? null);
    readonly isTrialing = computed(() => this.status() === 'trialing');
    readonly hasActiveSubscription = computed(() => this.status() === 'active');

    applyMe(me: MeDto): void {
        this.snapshotState.set(this.mapMeToSnapshot(me));
    }

    ensureLoaded(): Promise<void> {
        if (this.loaded()) {
            return Promise.resolve();
        }

        if (this.loadingRequest?.generation === this.generation) {
            return this.loadingRequest.promise;
        }

        const requestGeneration = this.generation;
        this.refreshErrorStatusState.set(null);
        const promise = firstValueFrom(this.meApi.getMe())
            .then((me) => {
                if (this.generation === requestGeneration) {
                    this.applyMe(me);
                }
            })
            .catch((error: unknown) => {
                if (this.generation === requestGeneration) {
                    this.refreshErrorStatusState.set(this.getErrorStatus(error));
                }
                console.error(
                    '[SubscriptionStateService] Nie udało się pobrać stanu subskrypcji:',
                    error,
                );
            })
            .finally(() => {
                if (this.loadingRequest?.promise === promise) {
                    this.loadingRequest = null;
                }
            });

        this.loadingRequest = {
            generation: requestGeneration,
            promise,
        };

        return promise;
    }

    async refresh(): Promise<MeDto | null> {
        const requestGeneration = this.generation;
        this.refreshErrorStatusState.set(null);

        try {
            const me = await firstValueFrom(this.meApi.getMe());

            if (this.generation === requestGeneration) {
                this.applyMe(me);
            }

            return me;
        } catch (error) {
            if (this.generation === requestGeneration) {
                this.refreshErrorStatusState.set(this.getErrorStatus(error));
            }
            console.error(
                '[SubscriptionStateService] Nie udało się odświeżyć stanu subskrypcji:',
                error,
            );
            return null;
        }
    }

    reset(): void {
        this.generation += 1;
        this.loadingRequest = null;
        this.snapshotState.set(null);
        this.refreshErrorStatusState.set(null);
    }

    private mapMeToSnapshot(me: MeDto): SubscriptionSnapshot {
        return {
            status: me.subscription_status,
            planId: me.subscription_plan_id,
            currentPeriodEnd: this.parseDate(me.current_period_end),
            autoRenew: me.auto_renew,
            trialEndsAt: this.parseDate(me.trial_ends_at),
        };
    }

    private parseDate(value: string | null): Date | null {
        if (!value) {
            return null;
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    private getErrorStatus(error: unknown): number | null {
        if (!error || typeof error !== 'object') {
            return null;
        }

        const status = (error as { status?: unknown }).status;
        return typeof status === 'number' ? status : null;
    }
}
