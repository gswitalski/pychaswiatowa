import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Observable, from, switchMap } from 'rxjs';

import type {
    CheckoutSessionResponseDto,
    CreateCheckoutSessionCommand,
    SubscriptionPaymentMethod,
    SubscriptionPlanId,
} from '../../../../../shared/contracts/types';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CHECKOUT_DRAFT_STORAGE_KEY, CHECKOUT_REDIRECT_ALLOWED_HOSTS } from '../checkout.constants';
import type { CheckoutDraft } from '../models/checkout.model';
import {
    createPaymentProviderError,
    createUnknownCheckoutError,
    mapCheckoutError,
} from './checkout-error.mapper';

const ALLOWED_PLAN_IDS: readonly SubscriptionPlanId[] = ['premium_monthly', 'premium_yearly'];
const ALLOWED_PAYMENT_METHODS: readonly SubscriptionPaymentMethod[] = ['card', 'blik'];

@Injectable({
    providedIn: 'root',
})
export class CheckoutService {
    private readonly supabase = inject(SupabaseService);
    private readonly document = inject(DOCUMENT);

    createSession(command: CreateCheckoutSessionCommand): Observable<CheckoutSessionResponseDto> {
        return from(
            this.supabase.functions.invoke<CheckoutSessionResponseDto>('checkout/sessions', {
                method: 'POST',
                body: command,
            }),
        ).pipe(
            switchMap(async (response) => {
                if (response.error) {
                    throw await mapCheckoutError(response.error);
                }

                if (
                    !response.data ||
                    typeof response.data.checkout_url !== 'string' ||
                    !response.data.checkout_url
                ) {
                    throw createUnknownCheckoutError();
                }

                return response.data;
            }),
        );
    }

    redirectToProvider(url: string): void {
        let parsedUrl: URL;

        try {
            parsedUrl = new URL(url);
        } catch (error) {
            this.throwUnsafeRedirect(url, error);
        }

        if (
            parsedUrl.protocol !== 'https:' ||
            !CHECKOUT_REDIRECT_ALLOWED_HOSTS.includes(
                parsedUrl.hostname as (typeof CHECKOUT_REDIRECT_ALLOWED_HOSTS)[number],
            )
        ) {
            this.throwUnsafeRedirect(url);
        }

        this.document.location.assign(parsedUrl.toString());
    }

    saveDraft(draft: CheckoutDraft): void {
        if (!this.isValidDraft(draft)) {
            return;
        }

        try {
            sessionStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
        } catch {
            // Draft jest opcjonalny; zablokowany storage nie blokuje płatności.
        }
    }

    readDraft(): CheckoutDraft | null {
        try {
            const raw = sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
            if (!raw) {
                return null;
            }

            const draft = JSON.parse(raw) as unknown;
            return this.isValidDraft(draft) ? draft : null;
        } catch {
            return null;
        }
    }

    clearDraft(): void {
        try {
            sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
        } catch {
            // Draft jest opcjonalny.
        }
    }

    private isValidDraft(value: unknown): value is CheckoutDraft {
        if (!value || typeof value !== 'object') {
            return false;
        }

        const draft = value as Partial<CheckoutDraft>;
        return (
            ALLOWED_PLAN_IDS.includes(draft.planId as SubscriptionPlanId) &&
            ALLOWED_PAYMENT_METHODS.includes(draft.paymentMethod as SubscriptionPaymentMethod)
        );
    }

    private throwUnsafeRedirect(url: string, cause?: unknown): never {
        console.error('[CheckoutService] Odrzucono niezaufany URL operatora płatności.', {
            url,
            cause,
        });
        throw createPaymentProviderError();
    }
}
