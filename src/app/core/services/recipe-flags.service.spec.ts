import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { firstValueFrom } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeFlagsService } from './recipe-flags.service';
import { SupabaseService } from './supabase.service';

describe('RecipeFlagsService', () => {
    const invoke = vi.fn();
    let service: RecipeFlagsService;

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    });

    beforeEach(async () => {
        invoke.mockReset();

        await TestBed.configureTestingModule({
            providers: [
                RecipeFlagsService,
                {
                    provide: SupabaseService,
                    useValue: { functions: { invoke } },
                },
            ],
        }).compileComponents();

        service = TestBed.inject(RecipeFlagsService);
    });

    it('wysyła częściową aktualizację flag i zwraca pełny stan', async () => {
        const response = {
            recipe_id: 42,
            is_favorite: true,
            is_want_to_try: false,
        };
        invoke.mockResolvedValue({ data: response, error: null });

        const result = await firstValueFrom(
            service.setFlags(42, { is_favorite: true })
        );

        expect(result).toEqual(response);
        expect(invoke).toHaveBeenCalledWith('recipes/42/flags', {
            method: 'PUT',
            body: { is_favorite: true },
        });
    });

    it('przenosi status HTTP błędu odpowiedzi', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: { message: 'Unauthorized', context: { status: 401 } },
        });

        await expect(
            firstValueFrom(service.setFlags(42, { is_want_to_try: true }))
        ).rejects.toMatchObject({
            message: 'Unauthorized',
            status: 401,
        });
    });

    it('mapuje status z komunikatu błędu', async () => {
        invoke.mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
        });

        await expect(
            firstValueFrom(service.setFlags(42, { is_favorite: false }))
        ).rejects.toMatchObject({ status: 404 });
    });

    it('zgłasza błąd serwera, gdy odpowiedź nie zawiera danych', async () => {
        invoke.mockResolvedValue({ data: null, error: null });

        await expect(
            firstValueFrom(service.setFlags(42, { is_favorite: true }))
        ).rejects.toMatchObject({ status: 500 });
    });
});
