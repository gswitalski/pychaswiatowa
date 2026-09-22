import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { AiCreditsService } from './ai-credits.service';
import { SupabaseService } from './supabase.service';
import { AiCreditsResponseDto } from '../../../../shared/contracts/types';

describe('AiCreditsService', () => {
    const invoke = vi.fn();
    let service: AiCreditsService;

    const response: AiCreditsResponseDto = {
        limit_type: 'monthly',
        draft: { total: 10, used: 7, remaining: 3 },
        image: { total: 4, used: 4, remaining: 0 },
        next_reset_at: '2026-10-15T00:00:00.000Z',
    };

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(() => {
        invoke.mockReset();
        TestBed.configureTestingModule({
            providers: [
                AiCreditsService,
                {
                    provide: SupabaseService,
                    useValue: { functions: { invoke } },
                },
            ],
        });
        service = TestBed.inject(AiCreditsService);
    });

    it('inicjalizuje kompaktowy stan z odpowiedzi /me', () => {
        service.bootstrapFromMeResponse({
            draft_remaining: 2,
            image_remaining: 1,
            limit_type: 'lifetime',
            next_reset_at: null,
        });

        expect(service.credits()?.draft.remaining).toBe(2);
        expect(service.credits()?.draft.total).toBeNull();
        expect(service.credits()?.loading).toBe(true);
    });

    it('pobiera pełny stan i mapuje datę resetu', async () => {
        invoke.mockResolvedValue({ data: response, error: null });

        const result = await firstValueFrom(service.loadCredits());

        expect(invoke).toHaveBeenCalledWith('ai/credits', { method: 'GET' });
        expect(result.nextResetAt).toEqual(new Date(response.next_reset_at!));
        expect(service.credits()?.loading).toBe(false);
        expect(service.isExhausted('image')).toBe(true);
        expect(service.isExhausted('draft')).toBe(false);
    });

    it('ustawia stan błędu bez blokowania akcji AI', async () => {
        service.bootstrapFromMeResponse({
            draft_remaining: 0,
            image_remaining: 0,
            limit_type: 'lifetime',
            next_reset_at: null,
        });
        invoke.mockResolvedValue({
            data: null,
            error: { message: 'network error' },
        });

        await new Promise<void>((resolve) => {
            service.loadCredits().subscribe({ complete: resolve });
        });

        expect(service.credits()?.error).toBe(true);
        expect(service.credits()?.loading).toBe(false);
        expect(service.isExhausted('draft')).toBe(false);
    });

    it('odświeża kredyty w tle', async () => {
        invoke.mockResolvedValue({ data: response, error: null });

        service.refreshCredits();
        await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));

        expect(service.credits()?.draft.remaining).toBe(3);
    });
});
