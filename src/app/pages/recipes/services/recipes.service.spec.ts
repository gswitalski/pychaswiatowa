import 'zone.js';
import 'zone.js/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { TestBed } from '@angular/core/testing';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { RecipesService } from './recipes.service';

describe('RecipesService.deleteRecipeVariant', () => {
    const invoke = vi.fn();

    beforeAll(() => {
        TestBed.resetTestEnvironment();
        TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
    });

    beforeEach(() => {
        invoke.mockReset();
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [{ provide: SupabaseService, useValue: { functions: { invoke } } }],
        });
    });

    it('traktuje pustą odpowiedź usunięcia jako sukces', async () => {
        invoke.mockResolvedValue({ data: null, error: null });
        const service = TestBed.inject(RecipesService);

        await expect(firstValueFrom(service.deleteRecipeVariant(7, 2))).resolves.toBeUndefined();
        expect(invoke).toHaveBeenCalledWith('recipes/7/variants/2', { method: 'DELETE', body: {} });
    });

    it('zgłasza błąd, gdy usunięcie się nie powiedzie', async () => {
        invoke.mockResolvedValue({ data: null, error: { message: 'Recipe not found', status: 404 } });
        const service = TestBed.inject(RecipesService);

        await expect(firstValueFrom(service.deleteRecipeVariant(7, 2))).rejects.toMatchObject({
            message: 'Recipe not found',
            status: 404,
        });
    });
});
