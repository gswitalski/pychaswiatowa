import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { firstValueFrom } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeRatingService } from './recipe-rating.service';
import { SupabaseService } from './supabase.service';

describe('RecipeRatingService', () => {
    const invoke = vi.fn();
    let service: RecipeRatingService;

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
                RecipeRatingService,
                {
                    provide: SupabaseService,
                    useValue: { functions: { invoke } },
                },
            ],
        }).compileComponents();

        service = TestBed.inject(RecipeRatingService);
    });

    it('wysyła ocenę i zwraca stan z API', async () => {
        const response = {
            recipe_id: 42,
            my_rating: 4,
            average_rating: 4.2,
            ratings_count: 10,
        };
        invoke.mockResolvedValue({ data: response, error: null });

        await expect(firstValueFrom(service.setRating(42, 4))).resolves.toEqual(
            response
        );
        expect(invoke).toHaveBeenCalledWith('recipes/42/rating', {
            method: 'PUT',
            body: { rating: 4 },
        });
    });

    it('wysyła null, aby usunąć ocenę', async () => {
        invoke.mockResolvedValue({
            data: {
                recipe_id: 42,
                my_rating: null,
                average_rating: null,
                ratings_count: 0,
            },
            error: null,
        });

        await firstValueFrom(service.setRating(42, null));
        expect(invoke).toHaveBeenCalledWith('recipes/42/rating', {
            method: 'PUT',
            body: { rating: null },
        });
    });

    it.each([
        [{ message: 'Bad request' }, 400],
        [{ message: 'Unauthorized' }, 401],
        [{ message: 'Forbidden' }, 403],
        [{ message: 'Not found' }, 404],
        [{ message: 'Server error' }, 500],
        [{ message: 'ignored', status: 403 }, 403],
        [{ message: 'ignored', context: { status: 404 } }, 404],
    ])('mapuje status błędu %o', async (error, status) => {
        invoke.mockResolvedValue({ data: null, error });

        await expect(firstValueFrom(service.setRating(42, 4))).rejects.toMatchObject({
            status,
        });
    });

    it('zgłasza błąd 500 przy pustej odpowiedzi sukcesu', async () => {
        invoke.mockResolvedValue({ data: null, error: null });

        await expect(firstValueFrom(service.setRating(42, 4))).rejects.toMatchObject({
            status: 500,
        });
    });
});
