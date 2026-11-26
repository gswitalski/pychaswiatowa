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

describe('RecipesService.getRecipeById', () => {
    const invoke = vi.fn();

    beforeEach(() => {
        invoke.mockReset();
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [{ provide: SupabaseService, useValue: { functions: { invoke } } }],
        });
    });

    it('przekazuje variant do endpointu szczegółów', async () => {
        invoke.mockResolvedValue({ data: { id: 9 }, error: null });
        const service = TestBed.inject(RecipesService);

        await firstValueFrom(service.getRecipeById(7, 9));

        expect(invoke).toHaveBeenCalledWith('recipes/7?variant=9', { method: 'GET' });
    });

    it('nie dodaje pustego parametru variant', async () => {
        invoke.mockResolvedValue({ data: { id: 7 }, error: null });
        const service = TestBed.inject(RecipesService);

        await firstValueFrom(service.getRecipeById(7));

        expect(invoke).toHaveBeenCalledWith('recipes/7', { method: 'GET' });
    });
});

describe('RecipesService.createAiRecipeVariant', () => {
    const invoke = vi.fn();
    const command = {
        variant_name: 'Wegański',
        family_name: 'Zupa',
        visibility: 'PRIVATE' as const,
        description: null,
        ingredients_raw: 'fasola',
        steps_raw: 'ugotuj',
        category_id: null,
        servings: null,
        prep_time_minutes: null,
        total_time_minutes: null,
        diet_type: null,
        cuisine: null,
        difficulty: null,
        is_termorobot: false,
        is_grill: false,
    };

    beforeEach(() => {
        invoke.mockReset();
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [{ provide: SupabaseService, useValue: { functions: { invoke } } }],
        });
    });

    it('wysyła POST na endpoint wariantu AI i zwraca odpowiedź 201', async () => {
        const response = { recipe_id: 12, recipe: { id: 12, slug: 'zupa-weganska' } };
        invoke.mockResolvedValue({ data: response, error: null });

        await expect(firstValueFrom(TestBed.inject(RecipesService).createAiRecipeVariant(7, command)))
            .resolves.toEqual(response);
        expect(invoke).toHaveBeenCalledWith('recipes/7/variants/ai', {
            method: 'POST',
            body: command,
        });
    });

    it.each([400, 404, 409, 500])('mapuje błąd HTTP %s bez utraty statusu', async (status) => {
        invoke.mockResolvedValue({ data: null, error: { message: `error-${status}`, status } });

        await expect(
            firstValueFrom(TestBed.inject(RecipesService).createAiRecipeVariant(7, command)),
        ).rejects.toMatchObject({ message: `error-${status}`, status });
    });
});
