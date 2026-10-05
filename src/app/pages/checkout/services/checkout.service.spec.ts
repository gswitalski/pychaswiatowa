import 'zone.js';
import 'zone.js/testing';
import '@angular/compiler';
import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { firstValueFrom } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
    CreateCheckoutSessionCommand,
    CheckoutSessionResponseDto,
} from '../../../../../shared/contracts/types';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CHECKOUT_DRAFT_STORAGE_KEY } from '../checkout.constants';
import type { CheckoutErrorCode } from '../models/checkout.model';
import { CheckoutService } from './checkout.service';

describe('CheckoutService', () => {
    const invoke = vi.fn();
    const assign = vi.fn();
    let service: CheckoutService;

    const command: CreateCheckoutSessionCommand = {
        plan_id: 'premium_yearly',
        payment_method: 'card',
        accepted_terms: true,
        accepted_digital_content_waiver: true,
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        sessionStorage.clear();

        await TestBed.configureTestingModule({
            providers: [
                CheckoutService,
                {
                    provide: SupabaseService,
                    useValue: { functions: { invoke } },
                },
                {
                    provide: DOCUMENT,
                    useValue: { location: { assign } },
                },
            ],
        }).compileComponents();

        service = TestBed.inject(CheckoutService);
    });

    it('powinien utworzyć sesję checkout', async () => {
        const response: CheckoutSessionResponseDto = {
            checkout_url: 'https://checkout.stripe.com/c/pay/test',
            session_id: 'cs_test',
            expires_at: '2026-10-01T00:00:00Z',
        };
        invoke.mockResolvedValue({ data: response, error: null });

        await expect(firstValueFrom(service.createSession(command))).resolves.toEqual(response);
        expect(invoke).toHaveBeenCalledWith('checkout/sessions', {
            method: 'POST',
            body: command,
        });
    });

    it.each([
        [400, 'VALIDATION_ERROR'],
        [401, 'UNAUTHORIZED'],
        [403, 'FORBIDDEN_ROLE'],
        [409, 'SUBSCRIPTION_ALREADY_ACTIVE'],
        [429, 'RATE_LIMITED'],
        [502, 'PAYMENT_PROVIDER_ERROR'],
    ] satisfies readonly (readonly [number, CheckoutErrorCode])[])(
        'powinien zmapować status %i na %s',
        async (status, code) => {
            invoke.mockResolvedValue({
                data: null,
                error: createFunctionError(status, code, {
                    'Retry-After': '37',
                }),
            });

            const result = firstValueFrom(service.createSession(command));

            await expect(result).rejects.toMatchObject({
                code,
                status,
                ...(status === 429 ? { retryAfterSeconds: 37 } : {}),
            });
        },
    );

    it('powinien mapować błąd bez kontekstu HTTP jako błąd sieci', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: new Error('Failed to fetch'),
        });

        await expect(firstValueFrom(service.createSession(command))).rejects.toMatchObject({
            code: 'NETWORK_ERROR',
            status: 0,
        });
    });

    it('powinien odrzucić odpowiedź bez checkout_url', async () => {
        invoke.mockResolvedValue({
            data: {
                session_id: 'cs_test',
                expires_at: '2026-10-01T00:00:00Z',
            },
            error: null,
        });

        await expect(firstValueFrom(service.createSession(command))).rejects.toMatchObject({
            code: 'UNKNOWN',
        });
    });

    it('powinien przekierować wyłącznie do zaufanego hosta Stripe', () => {
        service.redirectToProvider('https://checkout.stripe.com/c/pay/test');

        expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/test');
    });

    it.each([
        'http://checkout.stripe.com/c/pay/test',
        'https://evil.example/c/pay/test',
        'not-a-url',
    ])('powinien odrzucić niezaufany URL: %s', (url) => {
        expect(() => service.redirectToProvider(url)).toThrow();
        expect(assign).not.toHaveBeenCalled();
    });

    it('powinien zapisać, odczytać i usunąć draft', () => {
        const draft = {
            planId: 'premium_monthly',
            paymentMethod: 'blik',
        } as const;

        service.saveDraft(draft);

        expect(service.readDraft()).toEqual(draft);
        service.clearDraft();
        expect(service.readDraft()).toBeNull();
    });

    it('powinien zignorować nieprawidłowy draft', () => {
        sessionStorage.setItem(
            CHECKOUT_DRAFT_STORAGE_KEY,
            JSON.stringify({ planId: 'enterprise', paymentMethod: 'crypto' }),
        );

        expect(service.readDraft()).toBeNull();
    });
});

function createFunctionError(
    status: number,
    error: CheckoutErrorCode,
    headers?: Record<string, string>,
): { context: Response } {
    return {
        context: new Response(JSON.stringify({ error }), {
            status,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
        }),
    };
}
